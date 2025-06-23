import Passenger from "../models/Passenger.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";

/**
 * Controller to send pickup confirmation WhatsApp message to picked passenger
 */


/**
 * Controller: Send pickup confirmation WhatsApp message to picked passenger
 */
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

    const passenger = await Passenger.findOne({
      Employee_PhoneNumber: cleanedPhone,
    });

    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: "Passenger not found in database.",
      });
    }

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

