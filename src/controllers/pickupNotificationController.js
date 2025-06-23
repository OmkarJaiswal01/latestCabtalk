import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";

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

    // Fetch all assets with populated passenger data
    const assets = await Asset.find({
      "passengers.passengers.passenger": { $exists: true },
    })
      .populate({
        path: "passengers.passengers.passenger",
        model: "Passenger",
        select: "Employee_Name Employee_PhoneNumber",
      })
      .lean();

    if (!assets || assets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No assets with passengers found.",
      });
    }

    // ✅ Console log all passengers in all assets
    console.log("Fetched Assets with Passenger Lists:");
    assets.forEach((asset, assetIndex) => {
      console.log(`\nAsset ${assetIndex + 1}: ID = ${asset._id}`);
      asset.passengers.forEach((shift, shiftIndex) => {
        console.log(`  Shift ${shiftIndex + 1}:`);
        shift.passengers.forEach((entry, entryIndex) => {
          const p = entry.passenger;
          if (p) {
            console.log(
              `    Passenger ${entryIndex + 1}: Name = ${p.Employee_Name}, Phone = ${p.Employee_PhoneNumber}`
            );
          } else {
            console.log(`    Passenger ${entryIndex + 1}: Not populated`);
          }
        });
      });
    });

    // Flatten all passengers across all assets
    const allPassengers = assets.flatMap((asset) =>
      asset.passengers.flatMap((shift) =>
        shift.passengers.map((ps) => ps.passenger)
      )
    );

    // Find the passenger by phone number
    const passenger = allPassengers.find(
      (p) =>
        p?.Employee_PhoneNumber?.replace(/\D/g, "") === cleanedPhone
    );

    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: "Passenger not found in any asset.",
      });
    }

    // Send WhatsApp pickup confirmation
    const result = await sendPickupConfirmationMessage(
      passenger.Employee_PhoneNumber,
      passenger.Employee_Name
    );

    if (!result.success) {
      return res.status(502).json({
        success: false,
        message: "Failed to send WhatsApp message via WATI.",
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pickup confirmation WhatsApp message sent successfully.",
      to: result.to,
      watiResponse: result.data,
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
