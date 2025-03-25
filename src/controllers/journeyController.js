import Journey from "../models/JourneyModel.js";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";

export const updateOccupancyByDriver = asyncHandler(async (req, res) => {
  let { driverPhone, passengerCode, action } = req.body;
  if (!driverPhone || !action) {
    return res.status(400).json({
      message: "driverPhone and action are required.",
    });
  }
  action = action.toLowerCase().trim();
  if (action === "yes" && !passengerCode) {
    return res.status(400).json({
      message: "Passenger code is required when boarding.",
    });
  }
  const driver = await Driver.findOne({ phoneNumber: driverPhone });
  if (!driver) {
    return res.status(404).json({ message: "No driver found with this phone number." });
  }
  const journey = await Journey.findOne({ Driver: driver._id }).populate("Asset");
  if (!journey) {
    return res.status(404).json({ message: "No active journey found for this driver." });
  }
  if (action === "no") {
    return res.status(200).json({ message: "Passenger not available. No change in occupancy." });
  }
  if (action !== "yes") {
    return res.status(400).json({ message: "Invalid action provided." });
  }
  const passenger = await Passenger.findOne({ Employee_ID: { $regex: passengerCode + "$" } });
  if (!passenger) {
    await sendWhatsAppMessage(driverPhone, "Provided passenger code is incorrect, Retry.");
    return res.status(404).json({ message: "The provided passenger code is incorrect or does not exist." });
  }
  if (!journey.Asset.passengers.map((id) => id.toString()).includes(passenger._id.toString())) {
    await sendWhatsAppMessage(driverPhone, "Provided passenger code is incorrect, Retry.");
    return res.status(400).json({
      message: "This passenger is not part of the assigned vehicle for today’s trip.",
    });
  }
  if (!journey.boardedPassengers) {
    journey.boardedPassengers = [];
  }
  if (journey.boardedPassengers.includes(passenger._id)) {
    await sendWhatsAppMessage(driverPhone, "This passenger has already boarded.");
    return res.status(400).json({ message: "This passenger has already boarded." });
  }
  if (journey.Asset.capacity !== undefined && journey.Occupancy + 1 > journey.Asset.capacity) {
    await sendWhatsAppMessage(driverPhone, "Cannot board passenger. The vehicle has reached its full capacity.");
    return res.status(400).json({ message: "Cannot board. The vehicle has reached its full capacity." });
  }
  journey.Occupancy += 1;
  journey.boardedPassengers.push(passenger._id);
  await journey.save();
  await sendWhatsAppMessage(driverPhone, "Thank you, the status has been updated successfully🙂");
  const io = req.app.get("io");
  io.emit("journeyUpdated", journey);
  return res.status(200).json({ message: "Passenger status updated successfully.", journey });
});

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