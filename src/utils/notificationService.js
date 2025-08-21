// // utils/notificationService.js
import crypto from "crypto";
import Journey from "../models/JourneyModel.js";
import Notification from "../models/Notification.js";

function roundUpToNextMinute(date = new Date()) {
  const d = new Date(date);
  if (d.getSeconds() === 0 && d.getMilliseconds() === 0) return d;
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  return d;
}

export async function storeJourneyNotifications(journeyId, passengers) {
  const exists = await Journey.exists({ _id: journeyId });
  if (!exists) {
    console.warn(
      `[notificationService] attempt to store notifications for missing journey ${journeyId}`
    );
    return;
  }

  const docs = [];
  const now = new Date();

  for (const p of passengers) {
    if (!p.passenger) continue;
    const triggers = [];

    if (p.bufferStart) {
      const bufferStartTime = new Date(p.bufferStart);
      if (bufferStartTime > now) {
        const intendedBefore10 = new Date(
          bufferStartTime.getTime() - 10 * 60 * 1000
        );
        let scheduledTime;

        if (intendedBefore10 > now) {
          scheduledTime = intendedBefore10;
        } else {
          scheduledTime = roundUpToNextMinute(now);
        }
        if (scheduledTime < bufferStartTime) {
          triggers.push({
            triggerId: crypto.randomUUID(),
            type: "before10Min",
            intendedTriggerTime: intendedBefore10,
            triggerTime: scheduledTime,
            status: "pending",
          });
        } else {
          console.info(
            `[notificationService] skipped before10Min for passenger ${p.passenger._id} because scheduledTime >= bufferStart`
          );
        }
      }
    }
    if (p.bufferEnd) {
      const bufferEndTime = new Date(p.bufferEnd);
      if (bufferEndTime > now) {
        triggers.push({
          triggerId: crypto.randomUUID(),
          type: "bufferEnd",
          triggerTime: bufferEndTime,
          status: "pending",
        });
      }
    }

    if (triggers.length === 0) continue;

    docs.push({
      journeyId,
      passengerId: p.passenger._id,
      phoneNumber: p.passenger.Employee_PhoneNumber,
      name: p.passenger.Employee_Name,
      triggers,
      createdAt: now,
    });
  }

  if (docs.length) {
    await Notification.insertMany(docs);
  }
}
export async function cancelPendingNotificationsForPassenger(
  passengerId,
  journeyId
) {
  await Notification.updateMany(
    { passengerId, journeyId, "triggers.status": "pending" },
    { $set: { "triggers.$[].status": "cancelled" } }
  );
}