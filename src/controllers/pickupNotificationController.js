import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Journey from "../models/JourneyModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";
import {sendPickupTemplateBefore10Min} from "../utils/sendTempleteBeforeTenMinites.js"
import {sendTemplateMoveCab} from "../utils/sendTemplateMoveCab.js"
import {sendWhatsAppMessage} from "../utils/whatsappHelper.js"




export const sendPickupConfirmation = async (req, res) => {
  try {
    const { pickedPassengerPhoneNumber } = req.body;
    if (!pickedPassengerPhoneNumber) {
      return res
        .status(400)
        .json({
          success: false,
          message: "pickedPassengerPhoneNumber is required.",
        });
    }

    const cleanedPhone = pickedPassengerPhoneNumber.replace(/\D/g, "");
    if (!/^91\d{10}$/.test(cleanedPhone)) {
      return res
        .status(400)
        .json({
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
      return res
        .status(404)
        .json({ success: false, message: "Asset not found." });
    }

    let pickedPassenger = null;
    let currentShiftPassengers = [];
    for (const shift of asset.passengers) {
      const match = shift.passengers.find(
        (sp) =>
          sp.passenger?.Employee_PhoneNumber?.replace(/\D/g, "") ===
          cleanedPhone
      );
      if (match) {
        pickedPassenger = match.passenger;
        currentShiftPassengers = shift.passengers.map((sp) => sp.passenger);
        break;
      }
    }
    if (!pickedPassenger) {
      return res
        .status(404)
        .json({
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
      return res
        .status(404)
        .json({ success: false, message: "No journey found for asset." });
    }

    const alreadyBoarded = journey.boardedPassengers.some(
      (bp) =>
        (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "") ===
        cleanedPhone
    );
    if (alreadyBoarded) {
      return res
        .status(400)
        .json({ success: false, message: "Passenger already boarded." });
    }

    journey.boardedPassengers.push({ passenger: pickedPassenger._id });
    await journey.save();

    const confirmation = await sendPickupConfirmationMessage(
      pickedPassenger.Employee_PhoneNumber,
      pickedPassenger.Employee_Name
    );

    const boardedSet = new Set(
      journey.boardedPassengers
        .map((bp) => bp.passenger.Employee_PhoneNumber || "")
        .map((num) => num.replace(/\D/g, ""))
    );
    boardedSet.add(cleanedPhone);

    const notifiedPassengers = [];
    for (const p of currentShiftPassengers) {
      if (!p?.Employee_PhoneNumber) continue;
      const phoneClean = p.Employee_PhoneNumber.replace(/\D/g, "");
      if (boardedSet.has(phoneClean)) continue;

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
      message:
        "Confirmation sent to picked passenger; unboarded shift‑mates updated.",
      pickedPassenger: {
        name: pickedPassenger.Employee_Name,
        phone: pickedPassenger.Employee_PhoneNumber,
        confirmation,
      },
      notifiedPassengers,
      boardedCount: journey.boardedPassengers.length,
    });
  } catch (err) {
    console.error("Pickup error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};


//send before 10 minites send template controller

// export const sendPickupConfirmation = async (req, res) => {
//   try {
//     const { pickedPassengerPhoneNumber } = req.body;
//     if (!pickedPassengerPhoneNumber) {
//       return res.status(400).json({
//         success: false,
//         message: "pickedPassengerPhoneNumber is required.",
//       });
//     }
 
//     const cleanedPhone = pickedPassengerPhoneNumber.replace(/\D/g, "");
//     if (!/^91\d{10}$/.test(cleanedPhone)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid Indian phone number format.",
//       });
//     }
 
//     const asset = await Asset.findOne({
//       "passengers.passengers.passenger": { $exists: true },
//     }).populate({
//       path: "passengers.passengers.passenger",
//       select: "Employee_PhoneNumber Employee_Name bufferEnd",
//     });
 
//     if (!asset) {
//       return res.status(404).json({ success: false, message: "Asset not found." });
//     }
 
//     let pickedPassenger = null;
//     let currentShiftPassengers = [];
//     for (const shift of asset.passengers) {
//       const match = shift.passengers.find(
//         (sp) =>
//           sp.passenger?.Employee_PhoneNumber?.replace(/\D/g, "") === cleanedPhone
//       );
//       if (match) {
//         pickedPassenger = match.passenger;
//         currentShiftPassengers = shift.passengers.map((sp) => sp.passenger);
//         break;
//       }
//     }
 
//     if (!pickedPassenger) {
//       return res.status(404).json({
//         success: false,
//         message: "Picked passenger not found in asset.",
//       });
//     }
 
//     const journey = await Journey.findOne({ Asset: asset._id })
//       .sort({ createdAt: -1 })
//       .populate({
//         path: "boardedPassengers.passenger",
//         select: "Employee_PhoneNumber Employee_Name",
//       });
 
//     if (!journey) {
//       return res.status(404).json({ success: false, message: "No journey found for asset." });
//     }
 
//     const alreadyBoarded = journey.boardedPassengers.some(
//       (bp) =>
//         (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "") === cleanedPhone
//     );
//     if (alreadyBoarded) {
//       return res.status(400).json({ success: false, message: "Passenger already boarded." });
//     }
 
//     journey.boardedPassengers.push({ passenger: pickedPassenger._id });
//     await journey.save();
 
//     const confirmation = await sendPickupConfirmationMessage(
//       pickedPassenger.Employee_PhoneNumber,
//       pickedPassenger.Employee_Name
//     );
 
//     const now = new Date();
 
//     const boardedSet = new Set(
//       journey.boardedPassengers
//         .map((bp) => bp.passenger.Employee_PhoneNumber || "")
//         .map((num) => num.replace(/\D/g, ""))
//     );
//     boardedSet.add(cleanedPhone);
 
//     const notifiedPassengers = [];
 
//     for (const p of currentShiftPassengers) {
//       if (!p?.Employee_PhoneNumber || !p?.bufferEnd) continue;
 
//       const phoneClean = p.Employee_PhoneNumber.replace(/\D/g, "");
//       if (boardedSet.has(phoneClean)) continue;
 
//       const bufferEndTime = new Date(p.bufferEnd);
//       if (isNaN(bufferEndTime.getTime()) || bufferEndTime < now) continue; // skip expired bufferEnd
 
//       const notify = await sendOtherPassengerSameShiftUpdateMessage(
//         p.Employee_PhoneNumber,
//         p.Employee_Name,
//         pickedPassenger.Employee_Name
//       );
 
//       notifiedPassengers.push({
//         name: p.Employee_Name,
//         phone: p.Employee_PhoneNumber,
//         success: notify.success,
//         error: notify.error || null,
//       });
//     }
 
//     return res.status(200).json({
//       success: true,
//       message: "Confirmation sent to picked passenger; unboarded shift‑mates updated.",
//       pickedPassenger: {
//         name: pickedPassenger.Employee_Name,
//         phone: pickedPassenger.Employee_PhoneNumber,
//         confirmation,
//       },
//       notifiedPassengers,
//       boardedCount: journey.boardedPassengers.length,
//     });
//   } catch (err) {
//     console.error("Pickup error:", err);
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error", error: err.message });
//   }
// };


//correct code
// export const sendPickupConfirmation = async (req, res) => {
//   try {
//     console.log("📥 [Step 0] Received pickup confirmation request...");

//     const { pickedPassengerPhoneNumber } = req.body;

//     if (!pickedPassengerPhoneNumber) {
//       console.log("❌ [Step 1] No pickedPassengerPhoneNumber in request.");
//       return res.status(400).json({
//         success: false,
//         message: "pickedPassengerPhoneNumber is required.",
//       });
//     }

//     const cleanedPhone = pickedPassengerPhoneNumber.replace(/\D/g, "");

//     console.log(`📞 [Step 2] Cleaned passenger phone: ${cleanedPhone}`);

//     if (!/^91\d{10}$/.test(cleanedPhone)) {
//       console.log("❌ [Step 2] Invalid phone format.");
//       return res.status(400).json({
//         success: false,
//         message: "Invalid Indian phone number format.",
//       });
//     }

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

//     console.log(`✅ [Step 5] Found picked passenger: ${pickedPassenger.Employee_Name}`);

//     console.log("📦 [Step 6] Fetching latest journey for asset...");
//     const journey = await Journey.findOne({ Asset: asset._id })
//       .sort({ createdAt: -1 })
//       .populate({
//         path: "boardedPassengers.passenger",
//         select: "Employee_PhoneNumber Employee_Name",
//       });

//     if (!journey) {
//       console.log("❌ [Step 6] Journey not found.");
//       return res.status(404).json({ success: false, message: "No journey found for asset." });
//     }

//     console.log("🧾 [Step 7] Checking if passenger already boarded...");
//     const alreadyBoarded = journey.boardedPassengers.some(
//       (bp) =>
//         (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "") === cleanedPhone
//     );

//     if (alreadyBoarded) {
//       console.log("✅ [Step 7] Passenger already boarded.");
//       return res.status(400).json({ success: false, message: "Passenger already boarded." });
//     }

//     console.log("🟢 [Step 8] Boarding passenger...");
//     journey.boardedPassengers.push({ passenger: pickedPassenger._id });
//     await journey.save();

//     console.log("📲 [Step 9] Sending confirmation message to picked passenger...");
//     const confirmation = await sendPickupConfirmationMessage(
//       pickedPassenger.Employee_PhoneNumber,
//       pickedPassenger.Employee_Name
//     );

//     const now = new Date();
//     const boardedSet = new Set(
//       journey.boardedPassengers
//         .map((bp) => bp.passenger.Employee_PhoneNumber || "")
//         .map((num) => num.replace(/\D/g, ""))
//     );
//     boardedSet.add(cleanedPhone);

//     console.log("🔔 [Step 10] Notifying other passengers in the same shift...");
//     const notifiedPassengers = [];

//     for (const sp of currentShiftPassengers) {
//       const p = sp.passenger;
//       if (!p?.Employee_PhoneNumber) continue;

//       const phoneClean = p.Employee_PhoneNumber.replace(/\D/g, "");

//       if (boardedSet.has(phoneClean)) {
//         console.log(`🚫 Skipping ${p.Employee_Name}: Already boarded.`);
//         continue;
//       }

//       const bufferEndTime = sp.bufferEnd ? new Date(sp.bufferEnd) : null;

//       if (!bufferEndTime || isNaN(bufferEndTime.getTime())) {
//         console.warn(`⚠️ Skipping ${p.Employee_Name}: Invalid or missing bufferEnd.`);
//         continue;
//       }

//       if (bufferEndTime <= now) {
//         console.log(`⏱️ Skipping ${p.Employee_Name}: bufferEnd already passed.`);
//         continue;
//       }

//       console.log(`📩 Sending update to ${p.Employee_Name}...`);
//       const notify = await sendOtherPassengerSameShiftUpdateMessage(
//         p.Employee_PhoneNumber,
//         p.Employee_Name,
//         pickedPassenger.Employee_Name
//       );

//       notifiedPassengers.push({
//         name: p.Employee_Name,
//         phone: p.Employee_PhoneNumber,
//         success: notify.success,
//         error: notify.error || null,
//       });
//     }

//     console.log("✅ [Step 11] All eligible notifications sent.");

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
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error", error: err.message });
//   }
// };





export const schedulePickupNotification = async (passenger, bufferStart) => {
  console.log("📦 Scheduling pickup notification...");

  const phoneNumber = passenger?.Employee_PhoneNumber;
  const name = passenger?.Employee_Name;

  if (!phoneNumber || !name || !bufferStart || isNaN(new Date(bufferStart).getTime())) {
    console.warn(`❌ Invalid passenger data. name=${name}, phone=${phoneNumber}, bufferStart=${bufferStart}`);
    return;
  }

  const templateName = 'pick_up_passenger_notification_before_10_minutes__';
  const broadcastName = `pick_up_passenger_notification_before_10_minutes___${formatBroadcastName(bufferStart)}`;

  const pickupDate = new Date(bufferStart);
  const sendTime = new Date(pickupDate.getTime() - 10 * 60 * 1000); // 10 minutes before
  const delay = sendTime.getTime() - Date.now();

  const { hours, minutes, seconds } = convertMillisecondsToTime(delay);

  console.log(`👤 Passenger: ${name}, Phone: ${phoneNumber}`);
  console.log(`🕒 Pickup Time: ${pickupDate.toISOString()}`);
  console.log(`🕑 Notification scheduled for: ${sendTime.toISOString()}`);
  console.log(`⏳ Delay: ${delay} ms (${hours}h ${minutes}m ${seconds}s)`);

  if (delay <= 0) {
    console.log("⚠️ Pickup is too close or in the past. Sending notification immediately.");
    try {
      await sendPickupTemplateBefore10Min(phoneNumber, name, templateName, broadcastName);
      console.log(`✅ Immediate notification sent to ${name} (${phoneNumber})`);
    } catch (err) {
      console.error(`❌ Failed to send immediate notification to ${name}:`, err);
    }
    return;
  }

  setTimeout(async () => {
    try {
      console.log(`🚀 Sending scheduled notification to ${name} at ${new Date().toISOString()}`);
      await sendPickupTemplateBefore10Min(phoneNumber, name, templateName, broadcastName);
      console.log(`✅ Scheduled notification sent to ${name} (${phoneNumber})`);
    } catch (err) {
      console.error(`❌ Failed to send scheduled pickup message to ${name}:`, err);
    }
  }, delay);
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





// send template on buffer End time

// Send template only if passenger hasn't onboarded before bufferEnd
// export const scheduleBufferEndNotification = async (passenger, bufferEnd) => {
//   console.log("📦 [Step 0] Starting bufferEnd notification scheduling...");

//   const phoneNumber = passenger?.Employee_PhoneNumber;
//   const name = passenger?.Employee_Name;

//   // Step 1: Validate input
//   console.log("✅ [Step 1] Validating passenger data...");
//   if (!phoneNumber || !name || !bufferEnd || isNaN(new Date(bufferEnd).getTime())) {
//     console.warn(`❌ [Step 1] Invalid passenger data. name=${name}, phone=${phoneNumber}, bufferEnd=${bufferEnd}`);
//     return;
//   }

//   const now = new Date();
//   const sendTime = new Date(bufferEnd);
//   const delay = sendTime.getTime() - now.getTime();

//   const { hours, minutes, seconds } = convertMillisecondsToTimeBufferEnd(delay);
//   console.log(`📋 Passenger: ${name}, Phone: ${phoneNumber}`);
//   console.log(`📅 bufferEnd Time: ${sendTime.toISOString()}`);
//   console.log(`🕒 Current Time: ${now.toISOString()}`);
//   console.log(`⏳ Time until bufferEnd: ${delay} ms (${hours}h ${minutes}m ${seconds}s)`);

//   const sendTemplateIfStillNotBoarded = async () => {
//     try {
//       // Step 2: Find the journey where this passenger is in the asset.passengers
//       const journey = await Journey.findOne({
//         "Asset.passengers.passengers.passenger": passenger._id,
//       }).populate("boardedPassengers.passenger", "Employee_PhoneNumber");

//       if (!journey) {
//         console.warn(`❌ No active journey found for ${name} (${phoneNumber})`);
//         return;
//       }

//       // Step 3: Check if already boarded
//       const stillNotBoarded = !journey.boardedPassengers.some(bp =>
//         bp.passenger._id.equals(passenger._id)
//       );

//       if (stillNotBoarded) {
//         console.log(`📨 Sending WhatsApp template to ${name} at bufferEnd...`);
//         await sendTemplateMoveCab(phoneNumber, name);
//         console.log(`✅ WhatsApp template sent to ${name} (${phoneNumber})`);
//       } else {
//         console.log(`🛑 Passenger ${name} was already onboarded before bufferEnd. No message sent.`);
//       }
//     } catch (err) {
//       console.error(`❌ Failed to send bufferEnd notification for ${name}:`, err.message);
//     }
//   };

//   if (delay <= 0) {
//     console.log("⚡ bufferEnd is in the past. Sending immediately if not boarded...");
//     await sendTemplateIfStillNotBoarded();
//   } else {
//     console.log("⏲️ Scheduling WhatsApp template to send at bufferEnd...");
//     setTimeout(sendTemplateIfStillNotBoarded, delay);
//   }
// };


// export const scheduleBufferEndNotification = async (passenger, bufferEnd) => {
//   console.log("📦 [Step 0] Scheduling bufferEnd notification...");

//   const phoneNumber = passenger?.Employee_PhoneNumber;
//   const name = passenger?.Employee_Name;

//   // ✅ Step 1: Validate inputs
//   if (!phoneNumber || !name || !bufferEnd || isNaN(new Date(bufferEnd).getTime())) {
//     console.warn(`❌ Invalid input. name=${name}, phone=${phoneNumber}, bufferEnd=${bufferEnd}`);
//     return;
//   }

 

//   const now = new Date();
//   const sendTime = new Date(bufferEnd);
//   const delay = sendTime.getTime() - now.getTime();
  

//   const { hours, minutes, seconds } = convertMillisecondsToTimeBufferEnd(delay);
//   console.log(`📅 bufferEnd for ${name}: ${sendTime.toISOString()}`);
//   console.log(`⏳ Notification in: ${hours}h ${minutes}m ${seconds}s (${delay}ms)`);

//   // 🔄 Step 2: Function to run at bufferEnd
//   const sendIfStillNotBoarded = async () => {
//     try {
//       console.log(`🔍 Checking if ${name} (${phoneNumber}) has boarded...`);

//       const journey = await Journey.findOne({
//         Journey_Type: { $regex: /^pickup$/, $options: "i" },
//       })
//         .sort({ createdAt: -1 })
//         .populate("Driver", "phoneNumber")
//         .populate({
//           path: "Asset",
//           select: "passengers",
//           populate: {
//             path: "passengers.passengers.passenger",
//             model: "Passenger",
//             select: "Employee_Name Employee_PhoneNumber",
//           },
//         })
//         .populate("boardedPassengers.passenger", "Employee_PhoneNumber");

//         const driverPhoneNumber=journey?.Driver?.phoneNumber;

//       // Check if passenger is assigned in asset shifts
//       const passengerAssigned = journey?.Asset?.passengers?.some((shift) =>
//         shift.passengers.some((p) =>
//           p.passenger?._id?.toString() === passenger._id?.toString()
//         )
//       );

//       if (!journey || !passengerAssigned) {
//         console.warn(`❌ No pickup journey found for passenger: ${name}`);
//         return;
//       }

//       const hasBoarded = journey.boardedPassengers?.some(bp =>
//         bp.passenger?._id?.toString() === passenger._id?.toString()
//       );

//       if (!hasBoarded) {
//         console.log(`📨 Passenger ${name} NOT boarded. Sending reminder...`);
//         await sendTemplateMoveCab(phoneNumber, name);
//         await sendWhatsAppMessage(driverPhoneNumber, "⚠️ The passenger is late. You can move the cab now.");
//         console.log(`✅ Reminder sent to ${name} (${phoneNumber})`);
//       } else {
//         console.log(`🛑 Passenger ${name} already boarded. No reminder needed.`);
//       }



//     } catch (err) {
//       console.error(`❌ Error checking boarding for ${name}:`, err.message);
//     }
//   };

//   // ⏲️ Step 3: Schedule or send immediately
//   if (delay <= 0) {
//     console.log("⚠️ bufferEnd already passed. Sending check immediately.");
//     await sendIfStillNotBoarded();
//   } else {
//     console.log(`⏳ Scheduling check in ${delay / 1000}s`);
//     setTimeout(sendIfStillNotBoarded, delay);
//   }
// };

// // 🔧 Utility to convert milliseconds to human-readable time
// function convertMillisecondsToTimeBufferEnd(ms) {
//   const totalSeconds = Math.floor(ms / 1000);
//   const hours = Math.floor(totalSeconds / 3600);
//   const minutes = Math.floor((totalSeconds % 3600) / 60);
//   const seconds = totalSeconds % 60;
//   return { hours, minutes, seconds };
// }


export const scheduleBufferEndNotification = async (passenger, bufferEnd) => {
  console.log("📦 [Step 0] Scheduling bufferEnd notification...");

  const phoneNumber = passenger?.Employee_PhoneNumber;
  const name = passenger?.Employee_Name;

  // ✅ Step 1: Validate inputs
  if (!phoneNumber || !name || !bufferEnd || isNaN(new Date(bufferEnd).getTime())) {
    console.warn(`❌ Invalid input. name=${name}, phone=${phoneNumber}, bufferEnd=${bufferEnd}`);
    return;
  }

  const now = new Date();
  const sendTime = new Date(bufferEnd);
  const delay = sendTime.getTime() - now.getTime();

  const { hours, minutes, seconds } = convertMillisecondsToTimeBufferEnd(delay);
  console.log(`📅 bufferEnd for ${name}: ${sendTime.toISOString()}`);
  console.log(`⏳ Notification in: ${hours}h ${minutes}m ${seconds}s (${delay}ms)`);

  // 🔄 Step 2: Function to run at bufferEnd
  const sendIfStillNotBoarded = async () => {
    try {
      console.log(`🔍 Checking if ${name} (${phoneNumber}) has boarded...`);

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
        console.warn(`❌ No journey found.`);
        return;
      }

      const driverPhoneNumber = journey?.Driver?.phoneNumber;
      console.log("🚗 Driver phone number:", driverPhoneNumber);

      // Check if passenger is assigned in asset shifts
      const passengerAssigned = journey?.Asset?.passengers?.some((shift) =>
        shift.passengers.some((p) =>
          p.passenger?._id?.toString() === passenger._id?.toString()
        )
      );

      if (!passengerAssigned) {
        console.warn(`❌ Passenger not assigned to journey asset.`);
        return;
      }

      const hasBoarded = journey.boardedPassengers?.some(bp =>
        bp.passenger?._id?.toString() === passenger._id?.toString()
      );

      if (!hasBoarded) {
        console.log(`📨 Passenger ${name} NOT boarded. Sending messages...`);

        // Step 1: Notify passenger
        await sendTemplateMoveCab(phoneNumber, name);
        console.log(`✅ Passenger message sent to ${phoneNumber}`);

        // Step 2: Notify driver
        if (!driverPhoneNumber || driverPhoneNumber.length < 10) {
          console.warn(`⚠️ Driver phone number invalid or missing: ${driverPhoneNumber}`);
        } else {
          try {
            const message = "⚠️ The passenger is late. You can move the cab now.";
            await sendWhatsAppMessage(driverPhoneNumber, message);
            console.log(`✅ Driver notified at ${driverPhoneNumber}`);
          } catch (err) {
            console.error("❌ Failed to send message to driver:", err.response?.data || err.message);
          }
        }
      } else {
        console.log(`🛑 Passenger ${name} already boarded. No reminder needed.`);
      }

    } catch (err) {
      console.error(`❌ Error checking boarding for ${name}:`, err.message);
    }
  };

  // ⏲️ Step 3: Schedule or send immediately
  if (delay <= 0) {
    console.log("⚠️ bufferEnd already passed. Sending check immediately.");
    await sendIfStillNotBoarded();
  } else {
    console.log(`⏳ Scheduling check in ${delay / 1000}s`);
    setTimeout(sendIfStillNotBoarded, delay);
  }
};

// 🔧 Utility to convert milliseconds to human-readable time
function convertMillisecondsToTimeBufferEnd(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}



