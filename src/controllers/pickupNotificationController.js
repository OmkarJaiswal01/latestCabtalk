import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Journey from "../models/JourneyModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";
import {sendPickupTemplateBefore10Min} from "../utils/sendTempleteBeforeTenMinites.js"
import {sendTemplateMoveCab} from "../utils/sendTemplateMoveCab.js"
import {sendWhatsAppMessage} from "../utils/whatsappHelper.js"



// ✅ Allowed weekdays
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isPassengerAllowedToday() {
  const today = WEEK_DAYS[new Date().getDay()]; // e.g. "Mon"
  return WEEK_DAYS.includes(today);
}


//new
// export const sendPickupConfirmation = async (req, res) => {
//   console.log("🚀 [START] sendPickupConfirmation API called.");

//   try {
//     console.log("📥 [Step 0] Received pickup confirmation request...");

//     const { pickedPassengerPhoneNumber } = req.body;
//     console.log("➡️ [Step 0] Request body:", req.body);

//     if (!pickedPassengerPhoneNumber) {
//       console.log("❌ [Step 1] No pickedPassengerPhoneNumber in request.");
//       return res.status(400).json({
//         success: false,
//         message: "pickedPassengerPhoneNumber is required.",
//       });
//     }
//     console.log("✅ [Step 1] pickedPassengerPhoneNumber received.");

//     const cleanedPhone = pickedPassengerPhoneNumber.replace(/\D/g, "");
//     console.log(`📞 [Step 2] Cleaned passenger phone: ${cleanedPhone}`);

//     if (!/^91\d{10}$/.test(cleanedPhone)) {
//       console.log("❌ [Step 2] Invalid phone format.");
//       return res.status(400).json({
//         success: false,
//         message: "Invalid Indian phone number format.",
//       });
//     }
//     console.log("✅ [Step 2] Phone format valid.");

//     console.log("🔍 [Step 3] Searching for matching asset...");
//     const asset = await Asset.findOne({
//       "passengers.passengers.passenger": { $exists: true },
//     }).populate({
//       path: "passengers.passengers.passenger",
//       select: "Employee_PhoneNumber Employee_Name",
//     });

//     if (!asset) {
//       console.log("❌ [Step 3] Asset not found.");
//       return res.status(404).json({ success: false, message: "Asset not found." });
//     }
//     console.log("✅ [Step 3] Asset found:", asset._id);

//     console.log("🔎 [Step 4] Looking for passenger in asset shifts...");
//     let pickedPassenger = null;
//     let currentShiftPassengers = [];

//     for (const shift of asset.passengers) {
//       const match = shift.passengers.find(
//         (sp) =>
//           sp.passenger?.Employee_PhoneNumber?.replace(/\D/g, "") === cleanedPhone
//       );
//       if (match) {
//         pickedPassenger = match.passenger;
//         currentShiftPassengers = shift.passengers;
//         break;
//       }
//     }

//     if (!pickedPassenger) {
//       console.log("❌ [Step 4] Picked passenger not found in asset shifts.");
//       return res.status(404).json({
//         success: false,
//         message: "Picked passenger not found in asset.",
//       });
//     }
//     console.log(`✅ [Step 4] Found picked passenger: ${pickedPassenger.Employee_Name}`);

//     console.log("📦 [Step 5] Fetching latest journey for asset...");
//     const journey = await Journey.findOne({ Asset: asset._id })
//       .sort({ createdAt: -1 })
//       .populate({
//         path: "boardedPassengers.passenger",
//         select: "Employee_PhoneNumber Employee_Name",
//       });

//     if (!journey) {
//       console.log("❌ [Step 5] Journey not found.");
//       return res.status(404).json({ success: false, message: "No journey found for asset." });
//     }
//     console.log("✅ [Step 5] Journey found:", journey._id);

//     console.log("🧾 [Step 6] Checking if passenger already boarded...");
//     const alreadyBoarded = journey.boardedPassengers.some(
//       (bp) =>
//         (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "") === cleanedPhone
//     );

//     if (alreadyBoarded) {
//       console.log("✅ [Step 6] Passenger already boarded.");
//       return res.status(400).json({ success: false, message: "Passenger already boarded." });
//     }
//     console.log("✅ [Step 6] Passenger not boarded yet.");

//     // ✅ Check weekday condition before adding boarding & sending messages
//     if (!isPassengerAllowedToday()) {
//       console.log(`⛔ Passenger ${pickedPassenger.Employee_Name} skipped due to weekday restriction.`);
//       return res.status(200).json({
//         success: true,
//         message: "Passenger skipped due to weekday restriction.",
//         pickedPassenger: {
//           name: pickedPassenger.Employee_Name,
//           phone: pickedPassenger.Employee_PhoneNumber,
//         },
//       });
//     }

//     console.log("🟢 [Step 7] Boarding passenger...");
//     journey.boardedPassengers.push({ passenger: pickedPassenger._id });
//     await journey.save();
//     console.log("✅ [Step 7] Passenger boarded and journey updated.");

//     console.log("📲 [Step 8] Sending confirmation message to picked passenger...");
//     const confirmation = await sendPickupConfirmationMessage(
//       pickedPassenger.Employee_PhoneNumber,
//       pickedPassenger.Employee_Name
//     );
//     console.log("✅ [Step 8] Confirmation sent:", confirmation);

//     const now = new Date();
//     const boardedSet = new Set(
//       journey.boardedPassengers
//         .map((bp) => bp.passenger.Employee_PhoneNumber || "")
//         .map((num) => num.replace(/\D/g, ""))
//     );
//     boardedSet.add(cleanedPhone);

//     console.log("🔔 [Step 9] Notifying other passengers in the same shift...");
//     const notifiedPassengers = [];

//     for (const sp of currentShiftPassengers) {
//       const p = sp.passenger;
//       if (!p?.Employee_PhoneNumber) continue;

// if (!isPassengerAllowedToday()) {
//         console.log(`⛔ Skipping ${p.Employee_Name} due to weekday restriction.`);
//         continue;
//       }
      

//       const phoneClean = p.Employee_PhoneNumber.replace(/\D/g, "");

//       if (boardedSet.has(phoneClean)) {
//         console.log(`🚫 [Step 9] Skipping ${p.Employee_Name}: Already boarded.`);
//         continue;
//       }

//       const bufferEndTime = sp.bufferEnd ? new Date(sp.bufferEnd) : null;

//       if (!bufferEndTime || isNaN(bufferEndTime.getTime())) {
//         console.warn(`⚠️ [Step 9] Skipping ${p.Employee_Name}: Invalid or missing bufferEnd.`);
//         continue;
//       }

//       if (bufferEndTime <= now) {
//         console.log(`⏱️ [Step 9] Skipping ${p.Employee_Name}: bufferEnd already passed.`);
//         continue;
//       }

//       console.log(`📩 [Step 9] Sending update to ${p.Employee_Name}...`);
//       const notify = await sendOtherPassengerSameShiftUpdateMessage(
//         p.Employee_PhoneNumber,
//         p.Employee_Name,
//         pickedPassenger.Employee_Name
//       );

//       console.log(`✅ [Step 9] Notified ${p.Employee_Name}:`, notify);

//       notifiedPassengers.push({
//         name: p.Employee_Name,
//         phone: p.Employee_PhoneNumber,
//         success: notify.success,
//         error: notify.error || null,
//       });
//     }

//     console.log("✅ [Step 9] All eligible notifications sent.");

//     console.log("🎉 [END] Pickup confirmation successful.");
//     return res.status(200).json({
//       success: true,
//       message: "Confirmation sent to picked passenger; shift-mates updated.",
//       pickedPassenger: {
//         name: pickedPassenger.Employee_Name,
//         phone: pickedPassenger.Employee_PhoneNumber,
//         confirmation,
//       },
//       notifiedPassengers,
//       boardedCount: journey.boardedPassengers.length,
//     });
//   } catch (err) {
//     console.error("❌ [ERROR] sendPickupConfirmation:", err);
//     console.log("💀 [END] Execution failed due to error.");
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error", error: err.message });
//   }
// };


export const sendPickupConfirmation = async (req, res) => {
  console.log("🚀 [START] sendPickupConfirmation API called.");

  try {
    console.log("📥 [Step 0] Received pickup confirmation request...");

    const { pickedPassengerPhoneNumber } = req.body;
    console.log("➡️ [Step 0] Request body:", req.body);

    if (!pickedPassengerPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: "pickedPassengerPhoneNumber is required.",
      });
    }

    const cleanedPhone = pickedPassengerPhoneNumber.replace(/\D/g, "");
    if (!/^91\d{10}$/.test(cleanedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Indian phone number format.",
      });
    }

    const asset = await Asset.findOne({
      "passengers.passengers.passenger": { $exists: true },
    }).populate({
      path: "passengers.passengers.passenger",
      select: "Employee_PhoneNumber Employee_Name",
    });

    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found." });
    }

    let pickedPassenger = null;
    let currentShiftPassengers = [];

    for (const shift of asset.passengers) {
      const match = shift.passengers.find(
        (sp) =>
          sp.passenger?.Employee_PhoneNumber?.replace(/\D/g, "") === cleanedPhone
      );
      if (match) {
        pickedPassenger = match.passenger;
        currentShiftPassengers = shift.passengers;
        break;
      }
    }

    if (!pickedPassenger) {
      return res.status(404).json({
        success: false,
        message: "Picked passenger not found in asset.",
      });
    }

    const journey = await Journey.findOne({ Asset: asset._id })
      .sort({ createdAt: -1 })
      .populate({
        path: "boardedPassengers.passenger",
        select: "Employee_PhoneNumber Employee_Name",
      });

    if (!journey) {
      return res.status(404).json({ success: false, message: "No journey found for asset." });
    }

    const alreadyBoarded = journey.boardedPassengers.some(
      (bp) =>
        (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "") === cleanedPhone
    );

    if (alreadyBoarded) {
      return res.status(400).json({ success: false, message: "Passenger already boarded." });
    }

    // ✅ Check weekday condition before adding boarding & sending messages
    if (!isPassengerAllowedToday()) {
      console.log(`⛔ Passenger ${pickedPassenger.Employee_Name} skipped due to weekday restriction.`);
      return res.status(200).json({
        success: true,
        message: "Passenger skipped due to weekday restriction.",
        pickedPassenger: {
          name: pickedPassenger.Employee_Name,
          phone: pickedPassenger.Employee_PhoneNumber,
        },
      });
    }

    journey.boardedPassengers.push({ passenger: pickedPassenger._id });
    await journey.save();

    const confirmation = await sendPickupConfirmationMessage(
      pickedPassenger.Employee_PhoneNumber,
      pickedPassenger.Employee_Name
    );

    const now = new Date();
    const boardedSet = new Set(
      journey.boardedPassengers
        .map((bp) => bp.passenger.Employee_PhoneNumber || "")
        .map((num) => num.replace(/\D/g, ""))
    );
    boardedSet.add(cleanedPhone);

    const notifiedPassengers = [];
    for (const sp of currentShiftPassengers) {
      const p = sp.passenger;
      if (!p?.Employee_PhoneNumber) continue;

      if (!isPassengerAllowedToday()) {
        console.log(`⛔ Skipping ${p.Employee_Name} due to weekday restriction.`);
        continue;
      }

      const phoneClean = p.Employee_PhoneNumber.replace(/\D/g, "");
      if (boardedSet.has(phoneClean)) continue;

      const bufferEndTime = sp.bufferEnd ? new Date(sp.bufferEnd) : null;
      if (!bufferEndTime || bufferEndTime <= now) continue;

      const notify = await sendOtherPassengerSameShiftUpdateMessage(
        p.Employee_PhoneNumber,
        p.Employee_Name,
        pickedPassenger.Employee_Name
      );

      notifiedPassengers.push({
        name: p.Employee_Name,
        phone: p.Employee_PhoneNumber,
        success: notify.success,
        error: notify.error || null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Confirmation sent to picked passenger; shift-mates updated.",
      pickedPassenger: {
        name: pickedPassenger.Employee_Name,
        phone: pickedPassenger.Employee_PhoneNumber,
        confirmation,
      },
      notifiedPassengers,
      boardedCount: journey.boardedPassengers.length,
    });
  } catch (err) {
    console.error("❌ [ERROR] sendPickupConfirmation:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};


// latest
// export const schedulePickupNotification = async (passenger, bufferStart) => {
//   console.log("📦 Scheduling pickup notification...");

//   const phoneNumber = passenger?.Employee_PhoneNumber;
//   const name = passenger?.Employee_Name;

//   if (!phoneNumber || !name || !bufferStart || isNaN(new Date(bufferStart).getTime())) {
//     console.warn(`❌ Invalid passenger data. name=${name}, phone=${phoneNumber}, bufferStart=${bufferStart}`);
//     return;
//   }

//   const templateName = 'pick_up_passenger_notification_before_10_minutes__';
//   const broadcastName = `pick_up_passenger_notification_before_10_minutes___${formatBroadcastName(bufferStart)}`;

//   const pickupDate = new Date(bufferStart);
//   const sendTime = new Date(pickupDate.getTime() - 10 * 60 * 1000); // 10 minutes before
//   const delay = sendTime.getTime() - Date.now();

//   const { hours, minutes, seconds } = convertMillisecondsToTime(delay);

//   console.log(`👤 Passenger: ${name}, Phone: ${phoneNumber}`);
//   console.log(`🕒 Pickup Time: ${pickupDate.toISOString()}`);
//   console.log(`🕑 Notification scheduled for: ${sendTime.toISOString()}`);
//   console.log(`⏳ Delay: ${delay} ms (${hours}h ${minutes}m ${seconds}s)`);

//   if (delay <= 0) {
//     console.log("⚠️ Pickup is too close or in the past. Sending notification immediately.");
//     try {
//       await sendPickupTemplateBefore10Min(phoneNumber, name, templateName, broadcastName);
//       console.log(`✅ Immediate notification sent to ${name} (${phoneNumber})`);
//     } catch (err) {
//       console.error(`❌ Failed to send immediate notification to ${name}:`, err);
//     }
//     return;
//   }

//   setTimeout(async () => {
//     try {
//       console.log(`🚀 Sending scheduled notification to ${name} at ${new Date().toISOString()}`);
//       await sendPickupTemplateBefore10Min(phoneNumber, name, templateName, broadcastName);
//       console.log(`✅ Scheduled notification sent to ${name} (${phoneNumber})`);
//     } catch (err) {
//       console.error(`❌ Failed to send scheduled pickup message to ${name}:`, err);
//     }
//   }, delay);
// };

export const schedulePickupNotification = async (passenger, bufferStart) => {
  console.log("🚀 [START] schedulePickupNotification called.");

  console.log("📦 [Step 0] Preparing pickup notification scheduling...");

  const phoneNumber = passenger?.Employee_PhoneNumber;
  const name = passenger?.Employee_Name;

  console.log(`➡️ [Step 0] Passenger data received: name=${name}, phone=${phoneNumber}, bufferStart=${bufferStart}`);

  // Step 1: Validate passenger & bufferStart
  if (!phoneNumber || !name || !bufferStart || isNaN(new Date(bufferStart).getTime())) {
    console.warn(`❌ [Step 1] Invalid passenger data. name=${name}, phone=${phoneNumber}, bufferStart=${bufferStart}`);
    console.log("💀 [END] schedulePickupNotification stopped due to invalid data.");
    return;
  }
  console.log("✅ [Step 1] Passenger data is valid.");

  if (!isPassengerAllowedToday()) {
    console.log(`⛔ Skipping pickup notification for ${name} (weekday restriction).`);
    return;
  }

  // Step 2: Prepare template & broadcast
  const templateName = 'pick_up_passenger_notification_before_10_minutes__';
  const broadcastName = `pick_up_passenger_notification_before_10_minutes___${formatBroadcastName(bufferStart)}`;
  console.log(`📝 [Step 2] Template & broadcast prepared. template=${templateName}, broadcast=${broadcastName}`);

  // Step 3: Calculate pickup & send times
  const pickupDate = new Date(bufferStart);
  const sendTime = new Date(pickupDate.getTime() - 10 * 60 * 1000); // 10 minutes before
  const delay = sendTime.getTime() - Date.now();

  const { hours, minutes, seconds } = convertMillisecondsToTime(delay);

  console.log(`📅 [Step 3] Pickup Time: ${pickupDate.toISOString()}`);
  console.log(`⏰ [Step 3] Notification scheduled for: ${sendTime.toISOString()}`);
  console.log(`⏳ [Step 3] Delay: ${delay} ms (${hours}h ${minutes}m ${seconds}s)`);

  // Step 4: Immediate send if delay <= 0
  if (delay <= 0) {
    console.log("⚠️ [Step 4] Pickup is too close or in the past. Sending notification immediately.");
    try {
      await sendPickupTemplateBefore10Min(phoneNumber, name, templateName, broadcastName);
      console.log(`✅ [Step 4] Immediate notification sent to ${name} (${phoneNumber})`);
    } catch (err) {
      console.error(`❌ [Step 4] Failed to send immediate notification to ${name}:`, err);
    }
    console.log("🏁 [END] schedulePickupNotification finished (immediate send).");
    return;
  }

  // Step 5: Scheduled send
  console.log(`📌 [Step 5] Scheduling notification for ${name} after ${delay} ms.`);
  setTimeout(async () => {
    try {
      console.log(`🚀 [Step 5] Sending scheduled notification to ${name} at ${new Date().toISOString()}`);
      await sendPickupTemplateBefore10Min(phoneNumber, name, templateName, broadcastName);
      console.log(`✅ [Step 5] Scheduled notification sent to ${name} (${phoneNumber})`);
    } catch (err) {
      console.error(`❌ [Step 5] Failed to send scheduled pickup message to ${name}:`, err);
    }
  }, delay);

  console.log("🏁 [END] schedulePickupNotification finished (scheduled).");
};




function formatBroadcastName(pickupTime) {
  const dt = new Date(pickupTime);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  const hour = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${day}${month}${year}${hour}${min}`;
}

function convertMillisecondsToTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}






export const scheduleBufferEndNotification = async (passenger, bufferEnd) => {
  console.log("🚀 [START] scheduleBufferEndNotification called.");

  console.log("📦 [Step 0] Scheduling bufferEnd notification...");

  const phoneNumber = passenger?.Employee_PhoneNumber;
  const name = passenger?.Employee_Name;

  console.log(`➡️ [Step 0] Passenger data received: name=${name}, phone=${phoneNumber}, bufferEnd=${bufferEnd}`);

 if (!isPassengerAllowedToday()) {
    console.log(`⛔ Skipping bufferEnd notification for ${name} (weekday restriction).`);
    return;
  }
  
  // ✅ Step 1: Validate inputs
  if (!phoneNumber || !name || !bufferEnd || isNaN(new Date(bufferEnd).getTime())) {
    console.warn(`❌ [Step 1] Invalid input. name=${name}, phone=${phoneNumber}, bufferEnd=${bufferEnd}`);
    console.log("💀 [END] scheduleBufferEndNotification stopped due to invalid data.");
    return;
  }
  console.log("✅ [Step 1] Input data validated successfully.");

  // Step 2: Calculate timing
  const now = new Date();
  const sendTime = new Date(bufferEnd);
  const delay = sendTime.getTime() - now.getTime();

  const { hours, minutes, seconds } = convertMillisecondsToTimeBufferEnd(delay);
  console.log(`📅 [Step 2] bufferEnd for ${name}: ${sendTime.toISOString()}`);
  console.log(`⏳ [Step 2] Notification in: ${hours}h ${minutes}m ${seconds}s (${delay}ms)`);

  // 🔄 Step 3: Function to run at bufferEnd
  const sendIfStillNotBoarded = async () => {
    console.log(`🚦 [Step 3] Triggered bufferEnd check for ${name} (${phoneNumber})`);

    try {
      console.log(`🔍 [Step 3.1] Fetching latest journey...`);

      const journey = await Journey.findOne({
        Journey_Type: { $regex: /^pickup$/, $options: "i" },
      })
        .sort({ createdAt: -1 })
        .populate("Driver", "phoneNumber")
        .populate({
          path: "Asset",
          select: "passengers",
          populate: {
            path: "passengers.passengers.passenger",
            model: "Passenger",
            select: "Employee_Name Employee_PhoneNumber",
          },
        })
        .populate("boardedPassengers.passenger", "Employee_PhoneNumber");

      if (!journey) {
        console.warn(`❌ [Step 3.1] No journey found.`);
        return;
      }
      console.log(`✅ [Step 3.1] Journey found: ${journey._id}`);

      const driverPhoneNumber = journey?.Driver?.phoneNumber;
      console.log(`🚗 [Step 3.2] Driver phone number: ${driverPhoneNumber || "N/A"}`);

      // Step 3.3: Check passenger assignment
      const passengerAssigned = journey?.Asset?.passengers?.some((shift) =>
        shift.passengers.some((p) =>
          p.passenger?._id?.toString() === passenger._id?.toString()
        )
      );

      if (!passengerAssigned) {
        console.warn(`❌ [Step 3.3] Passenger ${name} not assigned to journey asset.`);
        return;
      }
      console.log(`✅ [Step 3.3] Passenger ${name} is assigned to journey asset.`);

      // Step 3.4: Check if boarded
      const hasBoarded = journey.boardedPassengers?.some(bp =>
        bp.passenger?._id?.toString() === passenger._id?.toString()
      );

      if (!hasBoarded) {
        console.log(`📨 [Step 3.4] Passenger ${name} NOT boarded. Sending messages...`);

        // Notify passenger
        try {
          await sendTemplateMoveCab(phoneNumber, name);
          console.log(`✅ [Step 3.5] Passenger message sent to ${phoneNumber}`);
        } catch (err) {
          console.error(`❌ [Step 3.5] Failed to notify passenger ${name}:`, err.message);
        }

        // Notify driver
        if (!driverPhoneNumber || driverPhoneNumber.length < 10) {
          console.warn(`⚠️ [Step 3.6] Driver phone number invalid or missing: ${driverPhoneNumber}`);
        } else {
          try {
            const message = "⚠️ The passenger is late. You can move the cab now.";
            await sendWhatsAppMessage(driverPhoneNumber, message);
            console.log(`✅ [Step 3.6] Driver notified at ${driverPhoneNumber}`);
          } catch (err) {
            console.error("❌ [Step 3.6] Failed to send message to driver:", err.response?.data || err.message);
          }
        }
      } else {
        console.log(`🛑 [Step 3.4] Passenger ${name} already boarded. No reminder needed.`);
      }

      console.log(`🎯 [Step 3] bufferEnd check complete for ${name}.`);
    } catch (err) {
      console.error(`❌ [Step 3] Error checking boarding for ${name}:`, err.message);
    }
  };

  // ⏲️ Step 4: Schedule or send immediately
  if (delay <= 0) {
    console.log("⚠️ [Step 4] bufferEnd already passed. Sending check immediately.");
    await sendIfStillNotBoarded();
  } else {
    console.log(`📌 [Step 4] Scheduling bufferEnd check in ${delay / 1000}s`);
    setTimeout(sendIfStillNotBoarded, delay);
  }

  console.log("🏁 [END] scheduleBufferEndNotification setup complete.");
};


// 🔧 Utility to convert milliseconds to human-readable time
function convertMillisecondsToTimeBufferEnd(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}


