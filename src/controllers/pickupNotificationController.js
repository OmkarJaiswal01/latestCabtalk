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

    // Step 1: Find the asset that includes the passenger
    const asset = await Asset.findOne({
      "passengers.passengers.passenger": { $exists: true },
    }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_PhoneNumber Employee_Name",
    });
    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found." });
    }

    // Step 1b: Locate the picked passenger and collect shift list
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
      return res.status(404).json({ success: false, message: "Picked passenger not found in asset." });
    }

    // Step 2: Find the latest journey for this asset
    const journey = await Journey.findOne({ Asset: asset._id })
      .sort({ createdAt: -1 })
      .populate({
        path: "boardedPassengers.passenger",
        select: "Employee_PhoneNumber Employee_Name",
      });
    if (!journey) {
      return res.status(404).json({ success: false, message: "No journey found for asset." });
    }

    // Step 3: Prevent double‐boarding
    const alreadyBoarded = journey.boardedPassengers.some(bp =>
      bp.passenger._id.toString() === pickedPassenger._id.toString()
    );
    if (alreadyBoarded) {
      return res.status(400).json({ success: false, message: "Passenger already boarded." });
    }

    // Step 4: Mark passenger as boarded
    journey.boardedPassengers.push({ passenger: pickedPassenger._id });
    await journey.save();

    // Step 5: Send pickup confirmation to the newly boarded passenger
    const confirmation = await sendPickupConfirmationMessage(
      pickedPassenger.Employee_PhoneNumber,
      pickedPassenger.Employee_Name
    );

    // Step 6: Notify only the *still‐unboarded* passengers in the same shift
    const warnings = [];
    // Build a set of all boarded IDs (including the one we just added)
    const boardedSet = new Set(
      journey.boardedPassengers.map(bp => bp.passenger.toString())
    );

    for (const p of currentShiftPassengers) {
      // Skip:
      //  • any null/undefined slots
      //  • *all* passengers already in boardedSet
      //  • those without a phone number
      if (!p || boardedSet.has(p._id.toString()) || !p.Employee_PhoneNumber) {
        continue;
      }

      const notify = await sendOtherPassengerSameShiftUpdateMessage(
        p.Employee_PhoneNumber,
        p.Employee_Name,
        pickedPassenger.Employee_Name
      );
      warnings.push({
        name: p.Employee_Name,
        phone: p.Employee_PhoneNumber,
        success: notify.success,
        error: notify.error || null,
      });
    }

    // Final response
    return res.status(200).json({
      success: true,
      message: "Confirmation sent to picked passenger and unboarded shift‐mates updated.",
      pickedPassenger: {
        name: pickedPassenger.Employee_Name,
        phone: pickedPassenger.Employee_PhoneNumber,
        confirmation,
      },
      notifiedPassengers: warnings,
      boardedCount: journey.boardedPassengers.length,
    });

  } catch (err) {
    console.error("Pickup error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
