import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";

export const sendPickupConfirmation = async (req, res) => {
  try {
    const { pickedPassengerPhoneNumber, journeyId } = req.body;

    if (!pickedPassengerPhoneNumber || !journeyId) {
      return res.status(400).json({
        success: false,
        message: "pickedPassengerPhoneNumber and journeyId are required.",
      });
    }

    const cleanedPhone = pickedPassengerPhoneNumber.replace(/\D/g, "");
    if (!/^91\d{10}$/.test(cleanedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Indian phone number format.",
      });
    }

    const journey = await Journey.findById(journeyId).populate({
      path: "boardedPassengers.passenger",
      select: "Employee_PhoneNumber Employee_Name",
    });

    if (!journey) {
      return res.status(404).json({ success: false, message: "Journey not found" });
    }

    const asset = await Asset.findById(journey.Asset).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_PhoneNumber Employee_Name",
    });

    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    let pickedPassenger = null;
    let currentShiftPassengers = [];

    for (const shift of asset.passengers) {
      for (const shiftP of shift.passengers) {
        const p = shiftP.passenger;
        if (p?.Employee_PhoneNumber?.replace(/\D/g, "") === cleanedPhone) {
          pickedPassenger = p;
          currentShiftPassengers = shift.passengers.map(sp => sp.passenger);
          break;
        }
      }
      if (pickedPassenger) break;
    }

    if (!pickedPassenger) {
      return res.status(404).json({ success: false, message: "Picked passenger not found" });
    }

    // ✅ Check if passenger is already boarded
    const alreadyBoarded = journey.boardedPassengers.some(bp =>
      bp.passenger.toString() === pickedPassenger._id.toString()
    );

    if (alreadyBoarded) {
      return res.status(400).json({ success: false, message: "Passenger already boarded." });
    }

    // ✅ Add to boardedPassengers
    journey.boardedPassengers.push({ passenger: pickedPassenger._id });
    await journey.save();

    // ✅ Send confirmation to picked passenger
    const confirmation = await sendPickupConfirmationMessage(
      pickedPassenger.Employee_PhoneNumber,
      pickedPassenger.Employee_Name
    );

    // ✅ Send warning to remaining passengers in same shift
    const warnings = [];

    for (const p of currentShiftPassengers) {
      if (!p || p._id.toString() === pickedPassenger._id.toString()) continue;

      const isBoarded = journey.boardedPassengers.some(bp =>
        bp.passenger.toString() === p._id.toString()
      );

      if (!isBoarded) {
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
    }

    return res.status(200).json({
      success: true,
      message: "Confirmation sent to picked passenger and others updated.",
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
