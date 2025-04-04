import Journey from "../models/JourneyModel.js";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";

export const createJourney = async (req, res) => {
  try {
    const { Journey_Type, vehicleNumber } = req.body;
    if (!Journey_Type || !vehicleNumber) {
      return res.status(400).json({ message: "Journey_Type and vehicleNumber are required." });
    }
    const driver = await Driver.findOne({ vehicleNumber });
    if (!driver) {
      return res.status(404).json({ message: "No driver found with this vehicle number." });
    }
    const asset = await Asset.findOne({ driver: driver._id }).populate("passengers");
    if (!asset) {
      return res.status(404).json({ message: "No assigned vehicle found for this driver." });
    }
    const existingJourney = await Journey.findOne({ Driver: driver._id });
    if (existingJourney) {
      await sendWhatsAppMessage(
        driver.phoneNumber,
        "You already have an active ride. Please end the current ride before starting a new one."
      );
      return res.status(400).json({
        message: "Active journey exists. Please end the current ride before starting a new one."
      });
    }
    const newJourney = new Journey({
      Driver: driver._id, Asset: asset._id, Journey_Type, Occupancy: 0, SOS_Status: false,
    });
    await newJourney.save();
    asset.isActive = true;
    await asset.save();
    const io = req.app.get("io");
    io.emit("newJourney", newJourney);
    return res.status(201).json({
      message: "Journey created successfully.", newJourney, updatedAsset: asset,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getJourneys = async (req, res) => {
  try {
    const journeys = await Journey.find()
      .populate("Driver")
      .populate({
        path: "Asset",
        populate: { path: "passengers", model: "Passenger" },
      });
    if (!journeys || journeys.length === 0) {
      return res.status(200).json([]);
    }
    return res.status(200).json(journeys);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const handleWatiWebhook = asyncHandler(async (req, res) => {
  try {
    console.log("===== Incoming WATI Webhook =====");
    console.log("Request Body:", req.body);

    const { id: eventId, type, waId, listReply } = req.body;

    // If the event is not interactive or listReply is missing, acknowledge receipt
    if (type !== "interactive" || !listReply) {
      console.log("Ignored message: Either not interactive or missing listReply.");
      return res.status(200).json({ message: "Ignored: Not an interactive message or missing listReply." });
    }

    // Use the event ID for idempotency check.
    // Use waId as the driver's phone number to fetch the driver
    const driver = await Driver.findOne({ phoneNumber: waId });
    if (!driver) {
      console.log("Driver not found for phone number:", waId);
      return res.status(200).json({ message: "Driver not registered." });
    }
    console.log("Driver found:", driver);

    // Find the active journey for this driver and populate the assigned asset
    const journey = await Journey.findOne({ Driver: driver._id }).populate("Asset");
    if (!journey) {
      console.log("No active journey found for driver:", driver._id);
      return res.status(200).json({ message: "No active journey found for this driver." });
    }
    console.log("Active journey found:", journey);

    // Check if this event has already been processed
    if (journey.processedWebhookEvents.includes(eventId)) {
      console.log("Duplicate event detected. Skipping processing for event ID:", eventId);
      return res.status(200).json({ message: "Duplicate event ignored." });
    }

    // Extract passenger phone number from the list reply title
    const passengerDetails = listReply.title;
    const passengerPhoneMatch = passengerDetails.match(/\d{10,}/);
    if (!passengerPhoneMatch) {
      console.log("Passenger phone number not found in listReply:", passengerDetails);
      return res.status(200).json({ message: "Invalid passenger details in listReply." });
    }
    const passengerPhone = passengerPhoneMatch[0];
    console.log("Extracted Passenger Phone:", passengerPhone);

    // Find the passenger based on the extracted phone number
    const passenger = await Passenger.findOne({ Employee_PhoneNumber: passengerPhone });
    if (!passenger) {
      console.log("Passenger not found in system for phone number:", passengerPhone);
      await sendWhatsAppMessage(waId, "⚠️ Passenger details not found. Please verify and retry.");
      return res.status(200).json({ message: "Passenger not found in system." });
    }
    console.log("Passenger found:", passenger);

    // Ensure the passenger is assigned to this asset
    const isAssigned = journey.Asset.passengers.some(
      (p) => p.toString() === passenger._id.toString()
    );
    if (!isAssigned) {
      console.log("Passenger not assigned to the asset for journey:", journey._id);
      await sendWhatsAppMessage(waId, "🚫 This passenger is not assigned to your vehicle today.");
      return res.status(200).json({ message: "Passenger not assigned to this vehicle." });
    }
    console.log("Passenger is assigned to the asset.");

    // Check if the passenger has already boarded
    const hasBoarded = journey.boardedPassengers.some(
      (p) => p.toString() === passenger._id.toString()
    );
    if (hasBoarded) {
      console.log("Passenger already boarded for journey:", journey._id);
      await sendWhatsAppMessage(waId, "✅ This passenger has already boarded.");
      return res.status(200).json({ message: "Passenger already boarded." });
    }

    // Check if adding this passenger exceeds the vehicle's capacity
    if (journey.Occupancy + 1 > journey.Asset.capacity) {
      console.log("Vehicle at full capacity for journey:", journey._id);
      await sendWhatsAppMessage(waId, "⚠️ Cannot board. Vehicle at full capacity.");
      return res.status(200).json({ message: "Vehicle capacity reached." });
    }

    // Update the journey: increase occupancy and mark the passenger as boarded
    journey.Occupancy += 1;
    journey.boardedPassengers.push(passenger._id);
    // Store the event ID to prevent duplicate processing in the future
    journey.processedWebhookEvents.push(eventId);
    await journey.save();
    console.log("Journey updated successfully:", journey);

    // Emit a real-time update via Socket.io (if configured)
    const io = req.app.get("io");
    if (io) {
      io.emit("journeyUpdated", journey);
    }

    // Confirm boarding via WhatsApp message
    await sendWhatsAppMessage(waId, "✅ Passenger boarding confirmed. Thank you! 🚖");

    res.status(200).json({ message: "Journey updated successfully.", journey });
  } catch (error) {
    console.error("🚨 Error in handleWatiWebhook:", error);
    res.status(200).json({ message: "Internal server error." });
  }
});