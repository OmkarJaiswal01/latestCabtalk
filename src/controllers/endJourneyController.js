import mongoose from "mongoose";
import Journey from "../models/JourneyModel.js";
import EndJourney from "../models/endJourneyModel.js";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";

export const endJourney = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { vehicleNumber } = req.body;
    if (!vehicleNumber) {
      await session.abortTransaction();
      return res.status(400).json({ message: "vehicleNumber is required." });
    }
    const driver = await Driver.findOne({ vehicleNumber }).session(session);
    if (!driver) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({
          message: "Driver with the provided vehicle number not found.",
        });
    }
    const journey = await Journey.findOne({ Driver: driver._id }).session(
      session
    );
    if (!journey) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "No active journey found for this vehicle." });
    }
    const existingEndedJourney = await EndJourney.findOne({
      JourneyId: journey._id,
    }).session(session);
    if (existingEndedJourney) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Journey has already been ended." });
    }
    const endedJourney = new EndJourney({
      JourneyId: journey._id,
      Driver: journey.Driver,
      Asset: journey.Asset,
      Journey_Type: journey.Journey_Type,
      Occupancy: journey.Occupancy,
    });
    await endedJourney.save({ session });
    await Journey.findByIdAndDelete(journey._id, { session });
    const updatedAsset = await Asset.findById(journey.Asset).session(session);
    if (!updatedAsset) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Associated asset not found." });
    }
    updatedAsset.isActive = false;
    await updatedAsset.save({ session });
    await session.commitTransaction();
    return res.status(200).json({
      message: "Journey ended successfully.",
      endedJourney,
    });
  } catch (error) {
    await session.abortTransaction();
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  } finally {
    session.endSession();
  }
};

export const getEndedJourneys = async (req, res) => {
  try {
    let { date } = req.query;
    if (!date) {
      const istNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      date = new Date(istNow).toISOString().split("T")[0]; }
    const startOfDayIST = new Date(`${date}T00:00:00.000Z`);
    const endOfDayIST = new Date(`${date}T23:59:59.999Z`);
    const endedJourneys = await EndJourney.find({
      endedAt: { $gte: startOfDayIST, $lt: endOfDayIST }
    })
      .populate({ path: "Driver", select: "vehicleNumber" })
      .sort({ endedAt: -1 });
    return res.status(200).json({
      message: "Ended journeys retrieved successfully.",
      data: endedJourneys.map(journey => ({
        vehicleNumber: journey.Driver?.vehicleNumber || "Unknown",
        Journey_Type: journey.Journey_Type,
        Occupancy: journey.Occupancy,
        endedAt: journey.endedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};