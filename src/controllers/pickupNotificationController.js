// controllers/pickupNotificationController.js

import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";

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

    // Step 1: Load asset & populate passengers
    const asset = await Asset.findOne({
      "passengers.passengers.passenger": { $exists: true }
    }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_PhoneNumber Employee_Name"
    });
    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found." });
    }

    // Step 1b: Find picked passenger and current shift list
    let pickedPassenger = null;
    let currentShiftPassengers = [];
    for (const shift of asset.passengers) {
      const found = shift.passengers.find(sp =>
        sp.passenger?.Employee_PhoneNumber?.replace(/\D/g, "") === cleanedPhone
      );
      if (found) {
        pickedPassenger = found.passenger;
        currentShiftPassengers = shift.passengers.map(sp => sp.passenger);
        break;
      }
    }
    if (!pickedPassenger) {
      return res.status(404).json({
        success: false,
        message: "Picked passenger not found in asset."
      });
    }

    // Step 2: Get latest journey for this asset
    const journey = await Journey.findOne({ Asset: asset._id })
      .sort({ createdAt: -1 })
      .populate({
        path: "boardedPassengers.passenger",
        select: "Employee_PhoneNumber Employee_Name"
      });
    if (!journey) {
      return res.status(404).json({
        success: false,
        message: "No journey found for asset."
      });
    }

    // Step 3: Prevent double boarding
    const alreadyBoardedByPhone = journey.boardedPassengers.some(bp => {
      const bpPhone = (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "");
      return bpPhone === cleanedPhone;
    });
    if (alreadyBoardedByPhone) {
      return res.status(400).json({
        success: false,
        message: "Passenger already boarded."
      });
    }

    // Step 4: Mark as boarded & save
    journey.boardedPassengers.push({ passenger: pickedPassenger._id });
    await journey.save();

    // Step 5: Send confirmation to the boarded passenger
    const confirmation = await sendPickupConfirmationMessage(
      pickedPassenger.Employee_PhoneNumber,
      pickedPassenger.Employee_Name
    );

    // Step 6: Notify only the still-unboarded shift passengers
       // … after Step 5 …
    // Step 6: Notify only the still-unboarded shift passengers
    const warnings = [];
   const boardedSet = new Set(
     journey.boardedPassengers
       .map(bp => bp.passenger.Employee_PhoneNumber || "")
       .map(num => num.replace(/\D/g, ""))
  );
+   // build a set of ALL boarded phones, including the one we just added
// +   const boardedSet = new Set(
// +     journey.boardedPassengers
// +       .map(bp => bp.passenger.Employee_PhoneNumber || "")
// +       .map(num => num.replace(/\D/g, ""))
// +   );
+   // make sure to include the just‑boarded passenger’s number
+   boardedSet.add(cleanedPhone);

    for (const p of currentShiftPassengers) {
      if (!p || !p.Employee_PhoneNumber) continue;

      const phoneClean = p.Employee_PhoneNumber.replace(/\D/g, "");
      // skip everyone whose number is already boarded
      if (boardedSet.has(phoneClean)) continue;

      const notify = await sendOtherPassengerSameShiftUpdateMessage(
        p.Employee_PhoneNumber,
        p.Employee_Name,
        pickedPassenger.Employee_Name
      );
      warnings.push({
        name: p.Employee_Name,
        phone: p.Employee_PhoneNumber,
        success: notify.success,
        error: notify.error || null
      });
    }


    return res.status(200).json({
      success: true,
      message: "Confirmation sent to picked passenger; unboarded shift‑mates updated.",
      pickedPassenger: {
        name: pickedPassenger.Employee_Name,
        phone: pickedPassenger.Employee_PhoneNumber,
        confirmation
      },
      notifiedPassengers: warnings,
      boardedCount: journey.boardedPassengers.length
    });
  } catch (err) {
    console.error("Pickup error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
