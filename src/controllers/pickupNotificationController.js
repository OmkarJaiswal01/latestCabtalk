import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";
import {sendPickupTemplateBefore10Min} from "../utils/sendTempleteBeforeTenMinites.js"

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




export const notifyPassengerBeforePickup = async (req, res) => {
  const { phoneNumber, name, pickupTime } = req.body;

  try {
    const templateName = 'pick_up_passenger_notification_before_10_minutes__';
    const broadcastName = `pick_up_passenger_notification_before_10_minutes___${formatBroadcastName(pickupTime)}`;

    const pickupDate = new Date(pickupTime);
    const sendTime = new Date(pickupDate.getTime() - 10 * 60 * 1000); // 10 minutes before
    const delay = sendTime.getTime() - Date.now();

    if (delay <= 0) {
      // Pickup is too close or past — send immediately
      const result = await sendPickupTemplateBefore10Min(
        phoneNumber,
        name,
        templateName,
        broadcastName
      );
      return res.status(200).json({
        success: true,
        message: 'Pickup time is too close. Notification sent immediately.',
        result,
      });
    }

    // Schedule the message
    setTimeout(async () => {
      try {
        await sendPickupTemplateBefore10Min(
          phoneNumber,
          name,
          templateName,
          broadcastName
        );
        console.log(`Notification sent to ${name} at ${new Date().toISOString()}`);
      } catch (err) {
        console.error('Failed to send scheduled message:', err);
      }
    }, delay);

    res.status(200).json({
      success: true,
      message: `Notification scheduled for ${sendTime.toISOString()}`,
      scheduledFor: sendTime,
    });
  } catch (error) {
    console.error("Notify error:", error);
    res.status(500).json({ success: false, message: 'Failed to schedule notification', error });
  }
};

// Helper to format broadcast name
function formatBroadcastName(pickupTime) {
  const dt = new Date(pickupTime);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  const hour = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${day}${month}${year}${hour}${min}`;
}

