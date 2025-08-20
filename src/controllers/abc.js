this is assetsController : import mongoose from "mongoose";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import axios from "axios";
 


export const updateAsset = asyncHandler(async (req, res) => {
  const { capacity, isActive } = req.body;
  const { id: assetId } = req.params;
 
  if (!mongoose.Types.ObjectId.isValid(assetId)) {
    return res.status(400).json({ success: false, message: "Invalid asset ID." });
  }
  const asset = await Asset.findById(assetId);
  if (!asset) {
    return res.status(404).json({ success: false, message: "Asset not found." });
  }
  if (capacity !== undefined) {
    if (typeof capacity !== "number" || capacity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a positive number.",
      });
    }
    const totalPax = asset.passengers.reduce(
      (sum, s) => sum + s.passengers.length,
      0
    );
    if (totalPax > capacity) {
      return res.status(400).json({
        success: false,
        message: "New capacity cannot be less than current passenger count.",
      });
    }
    asset.capacity = capacity;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "isActive must be a boolean." });
    }
    asset.isActive = isActive;
  }
  await asset.save();
  req.app.get("io").emit("assetUpdated", asset);
  return res.status(200).json({
    success: true,
    message: "Asset updated successfully.",
    asset,
  });
});


function normalizeDayString(d) {
  if (d == null) return null;
  if (typeof d !== "string") d = String(d);
  d = d.trim().toLowerCase().replace(/\.$/, "");
  const map = {
    mon: "Mon", monday: "Mon",
    tue: "Tue", tuesday: "Tue",
    wed: "Wed", wednesday: "Wed",
    thu: "Thu", thursday: "Thu",
    fri: "Fri", friday: "Fri",
    sat: "Sat", saturday: "Sat",
    sun: "Sun", sunday: "Sun",
  };
  const key = d.slice(0, 3);
  return map[key] || null;
}



export const addMultiplePassengersToAsset = asyncHandler(async (req, res) => {
  try {
    const { passengers, shift } = req.body;
    const { id: assetId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(assetId) ||
      !Array.isArray(passengers) ||
      passengers.length === 0 ||
      typeof shift !== "string" ||
      !shift.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "assetId, non-empty passengers array, and shift are required.",
      });
    }

    // Validate & normalize incoming passenger payloads
    const normalizedPassengers = [];
    for (const p of passengers) {
      if (!p.id || !mongoose.Types.ObjectId.isValid(p.id)) {
        return res.status(400).json({ success: false, message: "Each passenger must include a valid id." });
      }

      // ensure bufferStart/end parseable
      const bs = new Date(p.bufferStart);
      const be = new Date(p.bufferEnd);
      if (isNaN(bs.getTime()) || isNaN(be.getTime())) {
        return res.status(400).json({ success: false, message: "Each passenger must include valid bufferStart and bufferEnd." });
      }

      // normalize wfoDays (accept many formats)
      if (!p.wfoDays || (Array.isArray(p.wfoDays) && p.wfoDays.length === 0)) {
        return res.status(400).json({ success: false, message: "Each passenger must include wfoDays (array of days)." });
      }
      const rawDays = Array.isArray(p.wfoDays) ? p.wfoDays : [p.wfoDays];
      const normDays = rawDays.map((d) => normalizeDayString(d)).filter(Boolean);
      const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      if (normDays.length === 0 || normDays.some((d) => !validDays.includes(d))) {
        return res.status(400).json({ success: false, message: "wfoDays must contain valid days (Mon..Sun)." });
      }

      normalizedPassengers.push({
        id: p.id,
        requiresTransport: p.requiresTransport ?? true,
        bufferStart: bs,
        bufferEnd: be,
        wfoDays: normDays,
      });
    }

    const [asset, passengerDocs] = await Promise.all([
      Asset.findById(assetId),
      Passenger.find({ _id: { $in: normalizedPassengers.map((p) => p.id) } }),
    ]);

    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found." });
    }

    const already = passengerDocs.filter((p) => p.asset);
    if (already.length) {
      return res.status(400).json({
        success: false,
        message: `Some passengers are already assigned to an Asset.`,
        already: already.map((a) => a._id),
      });
    }

    const existingShift = asset.passengers.find((g) => g.shift === shift);
    const shiftCount = existingShift ? existingShift.passengers.length : 0;
    if (shiftCount + normalizedPassengers.length > asset.capacity) {
      return res.status(400).json({ success: false, message: `Shift capacity exceeded.` });
    }

    const newSubs = normalizedPassengers.map((p) => ({
      passenger: p.id,
      requiresTransport: p.requiresTransport,
      bufferStart: p.bufferStart,
      bufferEnd: p.bufferEnd,
      wfoDays: p.wfoDays,
    }));

    const idx = asset.passengers.findIndex((g) => g.shift === shift);
    if (idx >= 0) asset.passengers[idx].passengers.push(...newSubs);
    else asset.passengers.push({ shift, passengers: newSubs });

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await asset.save({ session });
      await Passenger.updateMany(
        { _id: { $in: normalizedPassengers.map((p) => p.id) } },
        { $set: { asset: asset._id } },
        { session }
      );
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const updated = await Asset.findById(assetId)
      .populate("driver", "name vehicleNumber")
      .populate("passengers.passengers.passenger", "Employee_ID Employee_Name Employee_PhoneNumber Employee_Address")
      .lean();

    req.app.get("io").emit("assetUpdated", updated);
    return res.status(200).json({ success: true, message: "Passengers added successfully.", asset: updated });
  } catch (error) {
    console.error("addMultiplePassengersToAsset error:", error);
    return res.status(500).json({ success: false, message: "Server error while adding passengers.", error: error.message });
  }
});



export const removePassengerFromAsset = asyncHandler(async (req, res) => {
  const { passengerId } = req.body;
  const { id: assetId } = req.params;
 
  if (!mongoose.Types.ObjectId.isValid(assetId)) {
    return res.status(400).json({
      success: false,
      message: "Valid Asset ID is required in URL parameters.",
    });
  }
  if (!mongoose.Types.ObjectId.isValid(passengerId)) {
    return res.status(400).json({
      success: false,
      message: "Valid Passenger ID is required in request body.",
    });
  }
  const [asset, passenger] = await Promise.all([
    Asset.findById(assetId),
    Passenger.findById(passengerId),
  ]);
  if (!asset) {
    return res.status(404).json({ success: false, message: "Asset not found." });
  }
  if (!passenger) {
    return res.status(404).json({ success: false, message: "Passenger not found." });
  }
  const isAssigned = asset.passengers.some((shiftGroup) =>
    shiftGroup.passengers.some((p) => p.passenger.equals(passengerId))
  );
  if (!isAssigned) {
    return res.status(400).json({
      success: false,
      message: "Passenger is not assigned to this asset.",
    });
  }
  for (const shiftGroup of asset.passengers) {
    shiftGroup.passengers = shiftGroup.passengers.filter(
      (p) => !p.passenger.equals(passengerId)
    );
  }
 
  asset.passengers = asset.passengers.filter(
    (shiftGroup) => shiftGroup.passengers.length > 0
  );
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
 
    await asset.save({ session });
    if (passenger.asset && passenger.asset.equals(assetId)) {
      passenger.asset = null;
      await passenger.save({ session });
    }
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    console.error("removePassengerFromAsset error:", err);
    return res.status(500).json({
      success: false,
      message: "Error removing passenger from asset.",
    });
  } finally {
    session.endSession();
  }
  const io = req.app.get("io");
  io.emit("assetUpdated", asset);
 
  return res.status(200).json({
    success: true,
    message: "Passenger removed from asset successfully.",
    asset,
  });
});

this is pickupNotificationController:
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
    console.log("📥 [Step 0] Received pickup confirmation request...");

    const { pickedPassengerPhoneNumber } = req.body;

    if (!pickedPassengerPhoneNumber) {
      console.log("❌ [Step 1] No pickedPassengerPhoneNumber in request.");
      return res.status(400).json({
        success: false,
        message: "pickedPassengerPhoneNumber is required.",
      });
    }

    const cleanedPhone = pickedPassengerPhoneNumber.replace(/\D/g, "");

    console.log(`📞 [Step 2] Cleaned passenger phone: ${cleanedPhone}`);

    if (!/^91\d{10}$/.test(cleanedPhone)) {
      console.log("❌ [Step 2] Invalid phone format.");
      return res.status(400).json({
        success: false,
        message: "Invalid Indian phone number format.",
      });
    }

    console.log("🔍 [Step 3] Searching for matching asset...");
    const asset = await Asset.findOne({
      "passengers.passengers.passenger": { $exists: true },
    }).populate({
      path: "passengers.passengers.passenger",
      select: "Employee_PhoneNumber Employee_Name",
    });

    if (!asset) {
      console.log("❌ [Step 3] Asset not found.");
      return res.status(404).json({ success: false, message: "Asset not found." });
    }

    console.log("🔎 [Step 4] Looking for passenger in asset shifts...");
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
      console.log("❌ [Step 4] Picked passenger not found in asset shifts.");
      return res.status(404).json({
        success: false,
        message: "Picked passenger not found in asset.",
      });
    }

    console.log(`✅ [Step 5] Found picked passenger: ${pickedPassenger.Employee_Name}`);

    console.log("📦 [Step 6] Fetching latest journey for asset...");
    const journey = await Journey.findOne({ Asset: asset._id })
      .sort({ createdAt: -1 })
      .populate({
        path: "boardedPassengers.passenger",
        select: "Employee_PhoneNumber Employee_Name",
      });

    if (!journey) {
      console.log("❌ [Step 6] Journey not found.");
      return res.status(404).json({ success: false, message: "No journey found for asset." });
    }

    console.log("🧾 [Step 7] Checking if passenger already boarded...");
    const alreadyBoarded = journey.boardedPassengers.some(
      (bp) =>
        (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "") === cleanedPhone
    );

    if (alreadyBoarded) {
      console.log("✅ [Step 7] Passenger already boarded.");
      return res.status(400).json({ success: false, message: "Passenger already boarded." });
    }

    console.log("🟢 [Step 8] Boarding passenger...");
    journey.boardedPassengers.push({ passenger: pickedPassenger._id });
    await journey.save();

    console.log("📲 [Step 9] Sending confirmation message to picked passenger...");
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

    console.log("🔔 [Step 10] Notifying other passengers in the same shift...");
    const notifiedPassengers = [];

    for (const sp of currentShiftPassengers) {
      const p = sp.passenger;
      if (!p?.Employee_PhoneNumber) continue;

      const phoneClean = p.Employee_PhoneNumber.replace(/\D/g, "");

      if (boardedSet.has(phoneClean)) {
        console.log(`🚫 Skipping ${p.Employee_Name}: Already boarded.`);
        continue;
      }

      const bufferEndTime = sp.bufferEnd ? new Date(sp.bufferEnd) : null;

      if (!bufferEndTime || isNaN(bufferEndTime.getTime())) {
        console.warn(`⚠️ Skipping ${p.Employee_Name}: Invalid or missing bufferEnd.`);
        continue;
      }

      if (bufferEndTime <= now) {
        console.log(`⏱️ Skipping ${p.Employee_Name}: bufferEnd already passed.`);
        continue;
      }

      console.log(`📩 Sending update to ${p.Employee_Name}...`);
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

    console.log("✅ [Step 11] All eligible notifications sent.");

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


export const scheduleBufferEndNotification = async (passenger, bufferEnd) => {
  console.log("📦 [Step 0] Scheduling bufferEnd notification...");

  const phoneNumber = passenger?.Employee_PhoneNumber;
  const name = passenger?.Employee_Name;

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

      const passengerAssigned = journey?.Asset?.passengers?.some((shift) =>
        shift.passengers.some((p) =>
          p.passenger?._id?.toString() === passenger._id?.toString()
        )
      );

      if (!passengerAssigned) {
        console.warn(`❌ Passenger not assigned to journey asset.`);
        return;
      }

      const hasBoarded = journey.boardedPassengers?.some(
        (bp) => bp.passenger?._id?.toString() === passenger._id?.toString()
      );

      if (!hasBoarded) {
        console.log(`📨 Passenger ${name} NOT boarded. Sending messages...`);

        await sendTemplateMoveCab(phoneNumber, name);
        console.log(`✅ Passenger message sent to ${phoneNumber}`);

        if (driverPhoneNumber && driverPhoneNumber.length >= 10) {
          try {
            const message = "⚠️ The passenger is late. You can move the cab now.";
            await sendWhatsAppMessage(driverPhoneNumber, message);
            console.log(`✅ Driver notified at ${driverPhoneNumber}`);
          } catch (err) {
            console.error("❌ Failed to send message to driver:", err.response?.data || err.message);
          }
        }

        // 🆕 CHANGE: Remove passenger from asset after bufferEnd
        for (const shift of journey.Asset.passengers) {
          shift.passengers = shift.passengers.filter(
            (p) => p.passenger?._id?.toString() !== passenger._id?.toString()
          );
        }
        await journey.Asset.save();

        // 🆕 CHANGE: Emit socket event if available
        if (global.io) {
          global.io.emit("assetUpdated", journey.Asset);
          console.log(`📡 assetUpdated event emitted for removed passenger ${name}`);
        }
      } else {
        console.log(`🛑 Passenger ${name} already boarded. No reminder needed.`);
      }
    } catch (err) {
      console.error(`❌ Error checking boarding for ${name}:`, err.message);
    }
  };

  if (delay <= 0) {
    console.log("⚠️ bufferEnd already passed. Sending check immediately.");
    await sendIfStillNotBoarded();
  } else {
    console.log(`⏳ Scheduling check in ${delay / 1000}s`);
    setTimeout(sendIfStillNotBoarded, delay);
  }
};



function convertMillisecondsToTimeBufferEnd(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

this is journeyController:




export const createJourney = async (req, res) => {
  console.log("➡️ [START] createJourney triggered");
  console.log("📦 Request Body:", req.body);

  try {
    const { Journey_Type, vehicleNumber, Journey_shift } = req.body;

    console.log("🧪 Validating required fields...");
    if (!Journey_Type || !vehicleNumber || !Journey_shift) {
      console.warn("⚠️ Validation failed: Missing fields");
      return res.status(400).json({
        message: "Journey_Type, vehicleNumber and Journey_shift are required.",
      });
    }
    console.log("✅ Fields validated");

    console.log(`🔍 Searching for driver with vehicleNumber: ${vehicleNumber}`);
    const driver = await Driver.findOne({ vehicleNumber });

    if (!driver) {
      console.warn("❌ Driver not found");
      return res.status(404).json({
        message: "No driver found with this vehicle number.",
      });
    }
    console.log("✅ Driver found:", driver._id);

    console.log(`🔍 Searching for asset assigned to driver ID: ${driver._id}`);
    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_ID Employee_Name Employee_PhoneNumber",
    });

    if (!asset) {
      console.warn("❌ No asset found for this driver");
      return res.status(404).json({
        message: "No assigned vehicle found for this driver.",
      });
    }
    console.log("✅ Asset found:", asset._id);

    console.log("🔎 Checking for existing active journey for this driver...");
    const existingJourney = await Journey.findOne({ Driver: driver._id });

    if (existingJourney) {
      console.warn("⛔ Active journey already exists");
      await sendWhatsAppMessage(
        driver.phoneNumber,
        "Please end this current ride before starting a new one."
      );
      return res.status(400).json({
        message:
          "Active journey exists. Please end the current ride before starting a new one.",
      });
    }
    console.log("✅ No active journey found");

    console.log("🛠 Creating a new journey...");
    const newJourney = new Journey({
      Driver: driver._id,
      Asset: asset._id,
      Journey_Type,
      Journey_shift,
      Occupancy: 0,
      SOS_Status: false,
    });

    await newJourney.save();
    console.log("✅ New journey saved:", newJourney._id);

    console.log("🔧 Updating asset status to active...");
    asset.isActive = true;
    await asset.save();
    console.log("✅ Asset updated:", asset._id);

    // ✅ New section: Schedule WhatsApp notifications for Pickup passengers
    if (Journey_Type.toLowerCase() === "pickup") {
      console.log("📣 Journey type is Pickup – scheduling passenger notifications...");

      for (const shift of asset.passengers) {
        if (shift.shift !== Journey_shift) continue;

        for (const shiftPassenger of shift.passengers) {
          const { passenger, bufferStart, bufferEnd } = shiftPassenger;

          if (!passenger) continue;

          // 1. Schedule Pickup reminder at bufferStart (optional)
          if (bufferStart) {
            try {
              await schedulePickupNotification(passenger, bufferStart);
              console.log(`🟢 Pickup reminder scheduled for ${passenger.Employee_Name}`);
            } catch (err) {
              console.error(`❌ Failed to schedule pickup notification for ${passenger.Employee_Name}:`, err.message);
            }
          }

          // 2. Schedule bufferEnd missed-boarding notification
          if (bufferEnd) {
            try {
              await scheduleBufferEndNotification(passenger, bufferEnd);
              //  await sendWhatsAppMessage(waId, "⚠️ The passenger is late. You can move the cab now.");
             
              console.log(`🕒 Missed-boarding check scheduled for ${passenger.Employee_Name}`);
            } catch (err) {
              console.error(`❌ Failed to schedule bufferEnd check for ${passenger.Employee_Name}:`, err.message);
            }
          }
        }
      }

      // 🔄 Notifying passenger app of shift update
      try {
        const mockReq = {
          body: { vehicleNumber, Journey_shift },
        };
        const mockRes = {
          status: (code) => ({
            json: (data) =>
              console.log(`🟢 Passenger notification response [${code}]:`, data),
          }),
        };
        await startRideUpdatePassengerController(mockReq, mockRes);
        console.log("✅ Assigned passengers notified");

        console.log("📨 Notifying other passengers in same shift...");
        await sendOtherPassengerSameShiftUpdateMessage(Journey_shift, asset._id);
      } catch (err) {
        console.error("🚨 Error during passenger notifications:", err.message);
      }
    } else {
      console.log("ℹ️ Journey type is not Pickup – skipping passenger notification");
    }

    const io = req.app.get("io");
    if (io) {
      console.log("📡 Emitting socket event: newJourney");
      io.emit("newJourney", newJourney);
    } else {
      console.warn("⚠️ Socket IO instance not found");
    }

    console.log("✅ [SUCCESS] Journey creation complete");
    return res.status(201).json({
      message: "Journey created successfully.",
      newJourney,
      updatedAsset: asset,
    });
  } catch (error) {
    console.error("❌ [ERROR] Server error in createJourney:", error.message);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



export const getJourneys = async (req, res) => {
  try {
    const journeys = await Journey.find()
      .populate({
        path: "Driver",
        model: "Driver",
      })
      .populate({
        path: "Asset",
        model: "Asset",
        populate: {
          path: "passengers.passengers.passenger",
          model: "Passenger",
        },
      })
      .populate({
        path: "boardedPassengers.passenger",
        model: "Passenger",
      })
      .populate({
        path: "previousJourney",
        model: "EndJourney",
      })
      .populate({
        path: "triggeredBySOS",
        model: "SOS",
      });

    return res.status(200).json(journeys);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const handleWatiWebhook = asyncHandler(async (req, res) => {
  console.log("📥 [Step 0] Received WATI webhook...");
  res.sendStatus(200); // Respond immediately

  try {
    // Step 1: Ignore non-interactive text replies
    console.log("🔍 [Step 1] Checking if message is an interactive reply...");
    if (req.body.text != null) {
      console.log("🛑 [Step 1] Text message received. Ignored.");
      return;
    }

    const { id: eventId, type, waId, listReply } = req.body;
    if (type !== "interactive" || !listReply?.title || !/\d{12}$/.test(listReply.title)) {
      console.log("🛑 [Step 1] Invalid or non-interactive payload. Ignored.");
      return;
    }

    // Step 2: Extract passenger phone number
    const passengerPhone = listReply.title.match(/(\d{12})$/)[0];
    console.log(`📞 [Step 2] Extracted passenger phone: ${passengerPhone}`);

    // Step 3: Lookup driver
    console.log(`🔎 [Step 3] Looking up driver for waId: ${waId}...`);
    const driver = await Driver.findOne({ phoneNumber: waId });
    if (!driver) {
      console.log("🛑 [Step 3] Driver not found.");
      return;
    }

    // Step 4: Fetch journey
    console.log("🚐 [Step 4] Fetching journey for driver...");
    const journey = await Journey.findOne({ Driver: driver._id })
      .populate({
        path: "Asset",
        select: "passengers capacity",
        populate: {
          path: "passengers.passengers.passenger",
          model: "Passenger",
          select: "Employee_ID Employee_Name Employee_PhoneNumber",
        },
      })
      .populate("boardedPassengers.passenger", "Employee_Name Employee_PhoneNumber");

    if (!journey) {
      console.log("🛑 [Step 4] Journey not found.");
      return;
    }

    // Step 5: Prevent duplicate webhook events
    console.log(`🧾 [Step 5] Checking for duplicate event ID: ${eventId}`);
    journey.processedWebhookEvents = journey.processedWebhookEvents || [];
    if (journey.processedWebhookEvents.includes(eventId)) {
      console.log("🛑 [Step 5] Duplicate event. Skipping.");
      return;
    }

    // Step 6: Find passenger
    console.log(`🧍 [Step 6] Looking up passenger by phone: ${passengerPhone}`);
    const passenger = await Passenger.findOne({ Employee_PhoneNumber: passengerPhone });
    if (!passenger) {
      console.log("🚫 [Step 6] Passenger not found.");
      await sendWhatsAppMessage(waId, "🚫 Passenger not found. Please verify and retry.");
      return;
    }

    // Step 7: Validate passenger in shift
    console.log(`📋 [Step 7] Validating passenger assignment in shift...`);
    const thisShift = journey.Asset.passengers.find((shift) =>
      shift.passengers.some((s) => s.passenger._id.equals(passenger._id))
    );

    if (!thisShift) {
      console.log("🚫 [Step 7] Passenger not assigned to vehicle.");
      await sendWhatsAppMessage(waId, "🚫 Passenger not assigned to this vehicle today.");
      return;
    }

    // Step 8: Capacity check
    console.log(`🚧 [Step 8] Checking vehicle capacity (${journey.Occupancy}/${journey.Asset.capacity})`);
    if (journey.Occupancy + 1 > journey.Asset.capacity) {
      console.log("⚠️ [Step 8] Vehicle full. Boarding denied.");
      await sendWhatsAppMessage(waId, "⚠️ Cannot board. Vehicle at full capacity.");
      return;
    }

    // Step 9: Already boarded?
    const cleanedPhone = passengerPhone.replace(/\D/g, "");
    const alreadyBoarded = journey.boardedPassengers.some((bp) => {
      const bpPhone = (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "");
      return bpPhone === cleanedPhone;
    });

    if (alreadyBoarded) {
      console.log("✅ [Step 9] Passenger already boarded.");
      await sendWhatsAppMessage(waId, "✅ Passenger already boarded.");
      return;
    }

    // Step 10: Board passenger
    console.log(`🟢 [Step 10] Boarding passenger: ${passenger.Employee_Name}`);
    journey.Occupancy += 1;
    journey.boardedPassengers.push({
      passenger: passenger._id,
      boardedAt: new Date(),
    });
    journey.processedWebhookEvents.push(eventId);
    await journey.save();
    console.log("✅ [Step 10] Passenger boarded and journey updated.");

    // Step 11: Emit socket update
    if (req.app.get("io")) {
      console.log("📡 [Step 11] Emitting journey update to socket...");
      req.app.get("io").emit("journeyUpdated", journey);
    }

    // Step 12: Confirm with driver
    console.log("📲 [Step 12] Sending confirmation to driver...");
    await sendWhatsAppMessage(waId, "✅ Passenger confirmed. Thank you!");

    const jt = (journey.Journey_Type || "").toLowerCase();

    // Step 13: Pickup-specific logic
    if (jt === "pickup") {
      console.log("🛻 [Step 13] Journey type is pickup. Proceeding with pickup logic...");

      await sendPickupConfirmationMessage(passenger.Employee_PhoneNumber, passenger.Employee_Name);

      // Notify other shift passengers
      const boardedSet = new Set(
        journey.boardedPassengers.map((bp) =>
          (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "")
        )
      );
      boardedSet.add(cleanedPhone);

      for (const shiftPassenger of thisShift.passengers) {
        const pDoc = shiftPassenger.passenger;
        const phoneClean = (pDoc.Employee_PhoneNumber || "").replace(/\D/g, "");

        if (!phoneClean || boardedSet.has(phoneClean)) {
          console.log(`⏩ Skipping ${pDoc.Employee_Name}: Already boarded or missing phone.`);
          continue;
        }

        const bufferEnd = shiftPassenger.bufferEnd ? new Date(shiftPassenger.bufferEnd) : null;
        if (!bufferEnd || isNaN(bufferEnd.getTime())) {
          console.warn(`⚠️ Skipping ${pDoc.Employee_Name}: Invalid or missing bufferEnd.`);
          continue;
        }

        const now = new Date();
        if (bufferEnd <= now) {
          console.log(`⏱️ Skipping ${pDoc.Employee_Name}: bufferEnd already passed.`);
          continue;
        }

        console.log(`🔔 [Step 13] Notifying ${pDoc.Employee_Name} about ${passenger.Employee_Name} boarding...`);
        await sendOtherPassengerSameShiftUpdateMessage(
          pDoc.Employee_PhoneNumber,
          pDoc.Employee_Name,
          passenger.Employee_Name
        );
      }

      // Step 14: Schedule bufferEnd reminder
      const shiftData = thisShift.passengers.find((p) =>
        p.passenger._id.equals(passenger._id)
      );
      const bufferEnd = shiftData?.bufferEnd;

      if (bufferEnd) {
        console.log(`⏳ Scheduling bufferEnd for ${passenger.Employee_Name}`);
        await scheduleBufferEndNotification(passenger, bufferEnd);
      } else {
        console.warn(`⚠️ No bufferEnd for ${passenger.Employee_Name}`);
      }
    }

    // Step 15: Drop journey
    if (jt === "drop") {
      console.log("🛬 [Step 15] Journey type is drop. Sending drop confirmation...");
      await sendDropConfirmationMessage(passenger.Employee_PhoneNumber, passenger.Employee_Name);
    }
  } catch (err) {
    console.error("❌ [ERROR] handleWatiWebhook:", err);
  }
});
this is assets model : import mongoose from "mongoose";
import { getNextSequence } from "./counterModel.js";
const passengerSubSchema = new mongoose.Schema(
  {
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Passenger",
      required: true,
    },
    requiresTransport: {
      type: Boolean,
      default: true,
    },
    bufferStart: {
      type: Date,
      required: true,
      index: true,
    },
    bufferEnd: {
      type: Date,
      required: true,
      index: true,
    },
    wfoDays: {
      type: [String],
      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      default: [],
    },
  },
  { _id: false }
);
const shiftPassengerSchema = new mongoose.Schema(
  {
    shift: {
      type: String,
      required: true,
    },
    passengers: {
      type: [passengerSubSchema],
      default: [],
    },
  },
  { _id: false }
);
const assetSchema = new mongoose.Schema(
  {
    shortId: {
      type: String,
      unique: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
    },
    passengers: {
      type: [shiftPassengerSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    handlesMultipleShifts: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);
assetSchema.pre("save", async function (next) {
  if (!this.shortId) {
    const seq = await getNextSequence("Asset");
    this.shortId = `AST-${String(seq).padStart(3, "0")}`;
  }
  next();
});
export default mongoose.model("Asset", assetSchema);
 
in this code i want when passenger is on wfoDays then not any update template will trigger to passenger 