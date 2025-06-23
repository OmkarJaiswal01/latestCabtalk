import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";

export const sendPickupConfirmation = async (req, res) => {
  try {
    const { pickedPassengerPhoneNumber } = req.body;
    console.log("Incoming body:", req.body);

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

    const assets = await Asset.find({
      "passengers.passengers.passenger": { $exists: true },
    }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber",
    });

    if (!assets || assets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No assets with passengers found.",
      });
    }

    let foundPassenger = null;
    let currentShift = null;

    for (const asset of assets) {
      for (const shift of asset.passengers) {
        for (const shiftPassenger of shift.passengers) {
          const p = shiftPassenger.passenger;
          const passengerPhone = p?.Employee_PhoneNumber?.replace(/\D/g, "");
          if (passengerPhone === cleanedPhone) {
            foundPassenger = p;
            currentShift = shift.passengers;
            break;
          }
        }
        if (foundPassenger) break;
      }
      if (foundPassenger) break;
    }

    if (!foundPassenger || !currentShift) {
      return res.status(404).json({
        success: false,
        message: "Picked passenger not found in any asset shift.",
      });
    }

    // ✅ 1. Send confirmation to the picked passenger
    const pickedResult = await sendPickupConfirmationMessage(
      foundPassenger.Employee_PhoneNumber,
      foundPassenger.Employee_Name
    );

    if (!pickedResult.success) {
      return res.status(502).json({
        success: false,
        message: "Failed to send message to picked passenger.",
        error: pickedResult.error,
      });
    }

    // ✅ 2. Send notification to remaining passengers in the same shift
    const notifications = [];

    for (const shiftPassenger of currentShift) {
      const other = shiftPassenger.passenger;
      if (!other || !other.Employee_PhoneNumber) continue;

      const otherPhone = other.Employee_PhoneNumber.replace(/\D/g, "");
      const otherName = other.Employee_Name;

      if (otherPhone !== cleanedPhone) {
        const notifyResult = await sendOtherPassengerSameShiftUpdateMessage(
          otherPhone,
          otherName, // 👈 name of other passenger (recipient)
          foundPassenger.Employee_Name // 👈 name of picked passenger
        );

        notifications.push({
          name: otherName,
          phone: otherPhone,
          success: notifyResult.success,
          error: notifyResult.error || null,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Message sent to picked passenger and notified others in shift.",
      pickedPassenger: {
        name: foundPassenger.Employee_Name,
        phone: foundPassenger.Employee_PhoneNumber,
        result: pickedResult,
      },
      notifiedPassengers: notifications,
    });
  } catch (error) {
    console.error("Pickup confirmation error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
