// utils/notificationCron.js
import cron from "node-cron";
import Notification from "../models/Notification.js";
import Journey from "../models/JourneyModel.js";
import {
  sendPickupTemplateBefore10Min,
  sendBufferEndTemplate,
} from "../utils/notificationScheduler.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";

const POLL_CRON = "* * * * *";
if (global.__notificationCronStarted) {
  console.warn(
    "[notificationCron] cron already started in this process — skipping duplicate load"
  );
} else {
  global.__notificationCronStarted = true;

  cron.schedule(
    POLL_CRON,
    async () => {
      try {
        const now = new Date();

        const dueNotifications = await Notification.find({
          triggers: {
            $elemMatch: { status: "pending", triggerTime: { $lte: now } },
          },
        }).limit(500);

        if (!dueNotifications.length) return;
        const journeyIds = [
          ...new Set(
            dueNotifications.map((n) => n.journeyId?.toString()).filter(Boolean)
          ),
        ];
        console.debug(
          `[cron] unique journeyIds (${journeyIds.length}):`,
          journeyIds
        );

        const journeys = await Journey.find({ _id: { $in: journeyIds } })
          .select("_id Asset boardedPassengers Journey_Type Driver")
          .populate({ path: "Asset", select: "isActive" })
          .populate({ path: "Driver", select: "phoneNumber Employee_Name" });

        console.info(
          `[cron] fetched ${journeys.length}/${journeyIds.length} journeys from DB`
        );

        const journeyMap = new Map();
        for (const j of journeys) journeyMap.set(j._id.toString(), j);
        for (const notif of dueNotifications) {
          const notifId = notif._id.toString();
          const journeyId = notif.journeyId?.toString() || null;
          const passengerId = notif.passengerId?.toString() || null;

          const journey = journeyId ? journeyMap.get(journeyId) : null;

          if (!journey || !journey.Asset || !journey.Asset.isActive) {
            let changed = false;
            for (const t of notif.triggers) {
              if (t.status === "pending" && t.triggerTime <= now) {
                t.status = "cancelled";
                changed = true;
                console.info(
                  `[cron] cancelling trigger ${t.type} for notif ${notifId} (journey missing/inactive)`
                );
              }
            }
            try {
              const hasPendingAfter = notif.triggers.some(
                (t) => t.status === "pending"
              );
              if (!hasPendingAfter) {
                await Notification.deleteOne({ _id: notif._id });
                console.info(`[cron] deleted completed notif ${notifId}`);
                continue; // move to next notif
              }

              if (changed) {
                await notif.save();
                console.debug(
                  `[cron] saved cancelled triggers for notif ${notifId}`
                );
              } else {
                console.debug(
                  `[cron] no changes needed for notif ${notifId} (journey missing/inactive)`
                );
              }
            } catch (errPersist) {
              console.error(
                `[cron] failed to persist cancellation for notif ${notifId}:`,
                errPersist && errPersist.stack
                  ? errPersist.stack
                  : errPersist.message || errPersist
              );
            }

            // continue to next notification after handling missing/inactive journey
            continue;
          }

          // prepare set of boarded passenger ids for quick lookup
          const boardedIds = new Set(
            (journey.boardedPassengers || []).map((b) => b.passenger.toString())
          );

          let modified = false;
          // iterate triggers and act on due pending triggers
          for (const t of notif.triggers) {
            if (t.status !== "pending" || t.triggerTime > now) {
              console.debug(
                `[cron] skipping trigger ${t.type} for notif ${notifId} (status=${t.status})`
              );
              continue;
            }

            // cancel if passenger already boarded
            if (passengerId && boardedIds.has(passengerId)) {
              t.status = "cancelled";
              modified = true;
              console.info(
                `[cron] passenger ${passengerId} already boarded — cancelling trigger ${t.type} for notif ${notifId}`
              );
              continue;
            }

            // attempt sending templates
            try {
              console.info(
                `[cron] sending ${t.type} for notif ${notifId} passenger=${passengerId} phone=${notif.phoneNumber}`
              );
              if (t.type === "before10Min") {
                await sendPickupTemplateBefore10Min(
                  notif.phoneNumber,
                  notif.name
                );
              } else if (t.type === "bufferEnd") {
                await sendBufferEndTemplate(notif.phoneNumber, notif.name);
                try {
                  const driverPhone = journey?.Driver?.phoneNumber;
                  if (driverPhone) {
                    const driverMsg = `${notif.name} (${notif.phoneNumber}) is late for pickup, consider moving the cab.`;
                    await sendWhatsAppMessage(driverPhone, driverMsg);
                    console.info(
                      `[cron] notified driver ${driverPhone} for notif ${notifId}`
                    );
                  } else {
                    console.debug(
                      `[cron] no driver phone available to notify for journey ${journeyId}`
                    );
                  }
                } catch (errDriver) {
                  console.error(
                    `[cron] failed to notify driver for notif ${notifId}:`,
                    errDriver && errDriver.stack
                      ? errDriver.stack
                      : errDriver.message || errDriver
                  );
                }
              } else {
                console.warn(
                  `[cron] unknown trigger type ${t.type} for notif ${notifId}`
                );
              }

              t.status = "sent";
              modified = true;
              console.info(`[cron] sent ${t.type} for notif ${notifId}`);
            } catch (errSend) {
              console.error(
                `[cron] Failed to send ${t.type} for notif ${notifId} passenger=${passengerId}:`,
                errSend && errSend.stack
                  ? errSend.stack
                  : errSend.message || errSend
              );
              // mark as cancelled to avoid retry storms for invalid recipient or permanent errors
              t.status = "cancelled";
              modified = true;
            }
          } // end triggers loop

          // Unified persistence / cleanup after handling triggers
          try {
            const hasPending = notif.triggers.some(
              (t) => t.status === "pending"
            );
            if (!hasPending) {
              // all triggers are either sent or cancelled — remove the doc
              await Notification.deleteOne({ _id: notif._id });
              console.info(`[cron] deleted completed notif ${notifId}`);
              continue;
            }

            if (modified) {
              await notif.save();
              console.debug(
                `[cron] saved notification ${notifId} (modified=true)`
              );
            } else {
              // nothing changed this run and there are still pending triggers — ok, leave it
              console.debug(
                `[cron] no changes for notif ${notifId} (pending triggers remain)`
              );
            }
          } catch (errSave) {
            console.error(
              `[cron] failed to persist or delete notif ${notifId}:`,
              errSave && errSave.stack
                ? errSave.stack
                : errSave.message || errSave
            );
          }
        }
      } catch (err) {
        console.error(
          "[cron] Notification cron error:",
          err && err.stack ? err.stack : err.message || err
        );
      }
    },
    { scheduled: true }
  );
}