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
      .populate("Driver", "vehicleNumber name")
      .populate({
        path: "Asset",
        populate: { path: "passengers", model: "Passenger" }
      })
      .populate({
        path: "boardedPassengers.passenger",
        model: "Passenger",
        select: "name Employee_PhoneNumber"
      });

    if (!journeys || journeys.length === 0) {
      return res.status(200).json([]);
    }
    const result = journeys.map(j => ({
      _id: j._id,
      driver: j.Driver,
      asset: j.Asset,
      Journey_Type: j.Journey_Type,
      Occupancy: j.Occupancy,
      SOS_Status: j.SOS_Status,
      boardingEvents: j.boardedPassengers.map(evt => ({
        passenger: evt.passenger,
        boardedAt: evt.boardedAt
      })),
      startedAt: j.createdAt,
      updatedAt: j.updatedAt
    }));
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const handleWatiWebhook = asyncHandler(async (req, res) => {
  try {
    const { id: eventId, type, waId, listReply } = req.body;
    if (type !== "interactive" || !listReply) {
      return res.status(200).json({ message: "Ignored: Not an interactive message or missing listReply." });
    }
    const driver = await Driver.findOne({ phoneNumber: waId });
    if (!driver) {
      return res.status(200).json({ message: "Driver not registered." });
    }
    const journey = await Journey.findOne({ Driver: driver._id }).populate("Asset", "passengers capacity").populate("boardedPassengers.passenger", "name Employee_PhoneNumber");
    if (!journey) {
      return res.status(200).json({ message: "No active journey found." });
    }
    if (journey.processedWebhookEvents.includes(eventId)) {
      return res.status(200).json({ message: "Duplicate event ignored." });
    }
    const passengerDetails = listReply.title || "";
    const match = passengerDetails.match(/\d{10,}/);
    if (!match) {
      await sendWhatsAppMessage(waId, "⚠️ Passenger details not found. Please verify and retry.");
      return res.status(200).json({ message: "Invalid passenger details in listReply." });
    }
    const passengerPhone = match[0];
    const passenger = await Passenger.findOne({ Employee_PhoneNumber: passengerPhone });
    if (!passenger) {
      await sendWhatsAppMessage(waId, "⚠️ Passenger details not found. Please verify and retry.");
      return res.status(200).json({ message: "Passenger not found." });
    }
    const isAssigned = journey.Asset.passengers.some(
      (pId) => pId.toString() === passenger._id.toString()
    );
    if (!isAssigned) {
      await sendWhatsAppMessage(waId, "🚫 Passenger not assigned to this vehicle today.");
      return res.status(200).json({ message: "Passenger not assigned to this vehicle." });
    }
    if (journey.Occupancy + 1 > journey.Asset.capacity) {
      await sendWhatsAppMessage(waId, "⚠️ Cannot board. Vehicle at full capacity.");
      return res.status(200).json({ message: "Vehicle at full capacity." });
    }
    const already = journey.boardedPassengers.some(evt => {
      const boardedId = (evt.passenger._id || evt.passenger).toString();
      return boardedId === passenger._id.toString();
    });
    if (already) {
      await sendWhatsAppMessage(waId, "✅ Passenger already boarded.");
      return res.status(200).json({ message: "Passenger already boarded." });
    }
    journey.Occupancy += 1;
    journey.boardedPassengers.push({ passenger: passenger._id, boardedAt: new Date() });
    journey.processedWebhookEvents.push(eventId);
    await journey.save();
    if (req.app.get("io")) {
      req.app.get("io").emit("journeyUpdated", journey);
    }
    await sendWhatsAppMessage(waId, "✅ Passenger confirmed. Thank you!");
    const updated = await Journey.findById(journey._id)
      .populate("boardedPassengers.passenger", "name Employee_PhoneNumber");
    return res.status(200).json({
      message: "Journey updated successfully.",
      boardingEvents: updated.boardedPassengers.map(evt => ({
        passenger: evt.passenger,
        boardedAt: evt.boardedAt
      }))
    });
  } catch (error) {
    console.error("handleWatiWebhook error:", error);
    return res.status(500).json({ message: "Server error in handleWatiWebhook.", error: error.message });
  }
});