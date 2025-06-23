import Passenger from "../models/Passenger.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";

/**
 * Controller to send pickup confirmation WhatsApp message to picked passenger
 */
export const sendPickupConfirmation = async (req, res) => {
  try {
    const { pickedPassengerPhoneNumber } = req.body;

    if (!pickedPassengerPhoneNumber) {
      return res.status(400).json({ success: false, message: "pickedPassengerPhoneNumber is required." });
    }

    const passenger = await Passenger.findOne({ Employee_PhoneNumber: pickedPassengerPhoneNumber });

    if (!passenger) {
      return res.status(404).json({ success: false, message: "Passenger not found." });
    }

    await sendPickupConfirmationMessage(
      passenger.Employee_PhoneNumber,
      passenger.Employee_Name
    );

    return res.status(200).json({
      success: true,
      message: "Pickup confirmation sent to passenger.",
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
