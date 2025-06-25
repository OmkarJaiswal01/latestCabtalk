import Journey from "../models/JourneyModel.js";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";

export const createJourney = async (req, res) => {
  try {
    const { Journey_Type, vehicleNumber, Journey_shift } = req.body;
    if (!Journey_Type || !vehicleNumber || !Journey_shift) {
      return res.status(400).json({
        message: "Journey_Type, vehicleNumber and Journey_shift are required.",
      });
    }
    const driver = await Driver.findOne({ vehicleNumber });
    if (!driver) {
      return res
        .status(404)
        .json({ message: "No driver found with this vehicle number." });
    }
    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_ID Employee_Name Employee_PhoneNumber",
    });

    if (!asset) {
      return res
        .status(404)
        .json({ message: "No assigned vehicle found for this driver." });
    }
    const existingJourney = await Journey.findOne({ Driver: driver._id });
    if (existingJourney) {
      await sendWhatsAppMessage(
        driver.phoneNumber,
        "You already have an active ride. Please end the current ride before starting a new one."
      );
      return res.status(400).json({
        message:
          "Active journey exists. Please end the current ride before starting a new one.",
      });
    }
    const newJourney = new Journey({
      Driver: driver._id,
      Asset: asset._id,
      Journey_Type,
      Journey_shift,
      Occupancy: 0,
      SOS_Status: false,
    });
    await newJourney.save();
    asset.isActive = true;
    await asset.save();
    const io = req.app.get("io");
    if (io) io.emit("newJourney", newJourney);
    return res.status(201).json({
      message: "Journey created successfully.",
      newJourney,
      updatedAsset: asset,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
export const getJourneys = async (req, res) => {
  try {
    const journeys = await Journey.find()
      .populate({
        path: "Driver",
        model: "Driver",
      })
      .populate({
        path: "Asset",
        model: "Asset",
        populate: {
          path: "passengers.passengers.passenger",
          model: "Passenger",
        },
      })
      .populate({
        path: "boardedPassengers.passenger",
        model: "Passenger",
      })
      .populate({
        path: "previousJourney",
        model: "EndJourney",
      })
      .populate({
        path: "triggeredBySOS",
        model: "SOS",
      });

    return res.status(200).json(journeys);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
export const handleWatiWebhook = asyncHandler(async (req, res) => {
  try {
    console.log("— In handleWatiWebhook, payload:", req.body);
    const { id: eventId, type, waId, listReply } = req.body;
    if (type !== "interactive" || !listReply) {
      return res.status(200).json({ message: "Ignored: Not an interactive message or missing listReply." });
    }
    const driver = await Driver.findOne({ phoneNumber: waId });
    if (!driver) {
      return res.status(200).json({ message: "Driver not registered." });
    }
    const journey = await Journey.findOne({ Driver: driver._id })
      .populate({
        path: "Asset",
        select: "passengers capacity",
        populate: {
          path: "passengers.passengers.passenger",
          model: "Passenger",
          select: "Employee_ID Employee_Name Employee_PhoneNumber",
        },
      })
      .populate("boardedPassengers.passenger", "Employee_Name Employee_PhoneNumber");
    if (!journey) {
      return res.status(200).json({ message: "No active journey found." });
    }
    if (journey.processedWebhookEvents.includes(eventId)) {
      return res.status(200).json({ message: "Duplicate event ignored." });
    }
    const title = listReply.title || "";
    const match = title.match(/(\d{12})$/);
    if (!match) {
      console.log("Ignored interactive reply without 10-digit phone.");
      return res.status(200).json({ message: "Ignored: no valid passenger selection." });
    }
    const passengerPhone = match[0];
    const passenger = await Passenger.findOne({ Employee_PhoneNumber: passengerPhone });
    if (!passenger) {
      await sendWhatsAppMessage(waId, "🚫 Passenger not found. Please verify and retry.");
      return res.status(200).json({ message: "Passenger not found." });
    }
    const isAssigned = journey.Asset.passengers.some(shift =>
      shift.passengers.some(pSub => pSub.passenger._id.toString() === passenger._id.toString())
    );
    if (!isAssigned) {
      await sendWhatsAppMessage(waId, "🚫 Passenger not assigned to this vehicle today.");
      return res.status(200).json({ message: "Passenger not assigned to this vehicle." });
    }

    if (journey.Occupancy + 1 > journey.Asset.capacity) {
      await sendWhatsAppMessage(waId, "⚠️ Cannot board. Vehicle at full capacity.");
      return res.status(200).json({ message: "Vehicle at full capacity." });
    }

    if (journey.boardedPassengers.some(evt => evt.passenger.toString() === passenger._id.toString())) {
      await sendWhatsAppMessage(waId, "✅ Passenger already boarded.");
      return res.status(200).json({ message: "Passenger already boarded." });
    }
    journey.Occupancy += 1;
    journey.boardedPassengers.push({ passenger: passenger._id, boardedAt: new Date() });
    journey.processedWebhookEvents.push(eventId);
    await journey.save();
    if (req.app.get("io")) req.app.get("io").emit("journeyUpdated", journey);
    await sendWhatsAppMessage(waId, "✅ Passenger confirmed. Thank you!");
    const updated = await Journey.findById(journey._id).populate(
      "boardedPassengers.passenger",
      "Employee_Name Employee_PhoneNumber"
    );
    return res.status(200).json({
      message: "Journey updated successfully.",
      boardingEvents: updated.boardedPassengers.map(evt => ({
        passenger: evt.passenger,
        boardedAt: evt.boardedAt,
      })),
    });
  } catch (error) {
    console.error("handleWatiWebhook error:", error);
    return res.status(500).json({ message: "Server error in handleWatiWebhook.", error: error.message });
  }
});