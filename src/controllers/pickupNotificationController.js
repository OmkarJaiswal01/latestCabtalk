import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import {sendOtherPassengerSameShiftUpdateMessage} from "../utils/InformOtherPassenger.js";

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

    console.log("Fetched Assets with Passenger Lists:");
    let foundPassenger = null;
    let currentShift = null;

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      console.log(`Asset ${i + 1}: ID = ${asset._id}`);

      for (let j = 0; j < asset.passengers.length; j++) {
        const shift = asset.passengers[j];
        console.log(`  Shift ${j + 1}:`);

        for (let k = 0; k < shift.passengers.length; k++) {
          const p = shift.passengers[k].passenger;
          const passengerPhone = p?.Employee_PhoneNumber?.replace(/\D/g, "");

          console.log(
            `    Passenger ${k + 1}: Name = ${p.Employee_Name}, Phone = ${passengerPhone}`
          );

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
        message: "Passenger not found in any asset.",
      });
    }

    // 1️⃣ Send "picked" message to the picked passenger
    const pickedResult = await sendPickupConfirmationMessage(
      foundPassenger.Employee_PhoneNumber,
      foundPassenger.Employee_Name,
      "picked"
    );

    if (!pickedResult.success) {
      return res.status(502).json({
        success: false,
        message: "Failed to send message to picked passenger.",
        error: pickedResult.error,
      });
    }

    // 2️⃣ Notify other passengers in the same shift
    const notifications = [];

    for (const shiftPassenger of currentShift) {
      const other = shiftPassenger.passenger;
      if (!other || !other.Employee_PhoneNumber) continue;

      const otherPhone = other.Employee_PhoneNumber.replace(/\D/g, "");
      if (otherPhone !== cleanedPhone) {
        const notifyResult = await sendOtherPassengerSameShiftUpdateMessage(
          otherPhone,
          foundPassenger.Employee_Name, // show picked person's name
          "notify"
        );

        notifications.push({
          name: other.Employee_Name,
          phone: otherPhone,
          success: notifyResult.success,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Template sent to picked passenger and others in same shift.",
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
