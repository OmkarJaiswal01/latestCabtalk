import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";
import { storeJourneyNotifications } from "../utils/notificationService.js";

// ✅ helper to normalize days
const normalizeDays = (days) => {
  if (!Array.isArray(days)) return [];
  return days.map((d) => d.toString().trim().toLowerCase().slice(0, 3));
};

// ✅ get today (short format, lowercase)
const getTodayShort = () =>
  new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).toLowerCase();

export const sendPickupConfirmation = async (req, res) => {
  try {
    const { pickedPassengerPhoneNumber } = req.body;
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

    // ✅ Find asset that has this passenger
    const asset = await Asset.findOne({
      "passengers.passengers.passenger": { $exists: true },
    }).populate({
      path: "passengers.passengers.passenger",
      select: "Employee_PhoneNumber Employee_Name wfoDays",
    });

    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found." });
    }

    let pickedPassenger = null;
    let currentShiftPassengers = [];
    let shiftBlock = null;

    for (const shift of asset.passengers) {
      const match = shift.passengers.find(
        (sp) => sp.passenger?.Employee_PhoneNumber?.replace(/\D/g, "") === cleanedPhone
      );
      if (match) {
        pickedPassenger = match.passenger;
        currentShiftPassengers = shift.passengers.map((sp) => sp.passenger);
        shiftBlock = shift.passengers;
        break;
      }
    }

    if (!pickedPassenger) {
      return res.status(404).json({
        success: false,
        message: "Picked passenger not found in asset.",
      });
    }

    // ✅ Check schedule for picked passenger
    const today = getTodayShort();
    const pickedDays = normalizeDays(pickedPassenger.wfoDays);
    const pickedScheduled = pickedPassenger.wfoDays == null || pickedDays.includes(today);

    if (!pickedScheduled) {
      return res.status(200).json({
        success: false,
        message: `Passenger ${pickedPassenger.Employee_Name} is not scheduled today (${today}).`,
      });
    }

    // ✅ Find active journey
    const journey = await Journey.findOne({ Asset: asset._id })
      .sort({ createdAt: -1 })
      .populate("boardedPassengers.passenger", "Employee_PhoneNumber Employee_Name");

    if (!journey) {
      return res.status(404).json({ success: false, message: "No journey found for asset." });
    }

    // ✅ Check already boarded
    const alreadyBoarded = journey.boardedPassengers.some(
      (bp) =>
        (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "") === cleanedPhone
    );
    if (alreadyBoarded) {
      return res.status(400).json({ success: false, message: "Passenger already boarded." });
    }

    // ✅ Mark boarded
    journey.boardedPassengers.push({
      passenger: pickedPassenger._id,
      boardedAt: new Date(),
    });
    await journey.save();

    // ✅ Store updated journey notifications
    try {
      if (shiftBlock) {
        await storeJourneyNotifications(journey._id, shiftBlock);
      }
    } catch (err) {
      console.error("storeJourneyNotifications error:", err);
    }

    // ✅ Confirm to picked passenger (since scheduled today)
    const confirmation = await sendPickupConfirmationMessage(
      pickedPassenger.Employee_PhoneNumber,
      pickedPassenger.Employee_Name
    );

    // ✅ Notify other shift passengers (only those scheduled today)
    const boardedSet = new Set(
      journey.boardedPassengers.map((bp) =>
        (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "")
      )
    );
    boardedSet.add(cleanedPhone);

    const notifiedPassengers = [];
    for (const p of currentShiftPassengers) {
      if (!p?.Employee_PhoneNumber) continue;

      // skip already boarded
      const phoneClean = p.Employee_PhoneNumber.replace(/\D/g, "");
      if (boardedSet.has(phoneClean)) continue;

      // check schedule
      const normalized = normalizeDays(p.wfoDays);
      const isScheduled = p.wfoDays == null || normalized.includes(today);
      if (!isScheduled) continue;

      try {
        const notify = await sendOtherPassengerSameShiftUpdateMessage(
          p.Employee_PhoneNumber,
          p.Employee_Name
        );
        notifiedPassengers.push({
          name: p.Employee_Name,
          phone: p.Employee_PhoneNumber,
          success: notify.success,
          error: notify.error || null,
        });
      } catch (err) {
        console.error("Failed to notify passenger:", p.Employee_PhoneNumber, err);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Confirmation sent to picked passenger; unboarded scheduled shift-mates updated.",
      pickedPassenger: {
        name: pickedPassenger.Employee_Name,
        phone: pickedPassenger.Employee_PhoneNumber,
        confirmation,
      },
      notifiedPassengers,
      boardedCount: journey.boardedPassengers.length,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
