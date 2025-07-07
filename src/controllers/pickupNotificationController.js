import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";

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