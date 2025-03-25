import mongoose from "mongoose";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const addAsset = asyncHandler(async (req, res) => {
  const { driverId, capacity, isActive } = req.body;
  if (!driverId || !mongoose.Types.ObjectId.isValid(driverId)) {
    return res.status(400).json({
      success: false, message: "Valid Driver ID is required.",
    });}
  if (
    capacity === undefined || capacity === null || isNaN(capacity) || capacity <= 0
  ) {
    return res.status(400).json({
      success: false, message: "Capacity must be a positive number.", });
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be a boolean value.",
    }); }
  const driver = await Driver.findById(driverId);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: "Driver not found.",
    });}
  let asset = await Asset.findOne({ driver: driverId });
  if (asset) {
    if (asset.passengers.length > capacity) {
      return res.status(400).json({
        success: false,
        message:
          "New capacity cannot be less than the number of assigned passengers.",
      }); }
    asset.capacity = capacity;
    if (isActive !== undefined) asset.isActive = isActive;
    await asset.save();

    const io = req.app.get("io"); 
    io.emit("assetUpdated", asset);

    return res.status(200).json({
      success: true,
      message:
        "Asset already exists for this driver. Updated asset capacity successfully.",
      asset,
    });
  }
  asset = await Asset.create({
    driver: driver._id,
    capacity,
    passengers: [],
    isActive: isActive === true,
  });

  const io = req.app.get("io");
  io.emit("newAsset", asset);

  res.status(201).json({
    success: true,
    message: "Asset added successfully.",
    asset,
  });
});
export const getAllAssets = asyncHandler(async (req, res) => {
  const assets = await Asset.find()
    .populate("driver", "name vehicleNumber")
    .populate("passengers", "Employee_ID Employee_Name Employee_PhoneNumber");
  res.status(200).json({
    success: true,
    message: "Assets retrieved successfully.",
    assets,
  });
});
export const addPassengerToAsset = asyncHandler(async (req, res) => {
  const { passengerId } = req.body;
  const { id: assetId } = req.params;
  if (!assetId || !mongoose.Types.ObjectId.isValid(assetId)) {
    return res.status(400).json({
      success: false,
      message: "Valid Asset ID is required in URL parameters.",
    });
  }
  if (!passengerId || !mongoose.Types.ObjectId.isValid(passengerId)) {
    return res.status(400).json({
      success: false,
      message: "Valid Passenger ID is required in request body.",
    });
  }
  const asset = await Asset.findById(assetId);
  if (!asset) {
    return res.status(404).json({ success: false, message: "Asset not found." });
  }
  const passenger = await Passenger.findById(passengerId);
  if (!passenger) {
    return res
      .status(404)
      .json({ success: false, message: "Passenger not found." });
  }
  if (passenger.asset) {
    return res.status(400).json({
      success: false,
      message: "Passenger is already assigned to an asset.",
    });
  }
  if (asset.passengers.some((p) => p.toString() === passengerId)) {
    return res.status(400).json({
      success: false,
      message: "Passenger is already assigned to this asset.",
    });
  }
  if (asset.passengers.length >= asset.capacity) {
    return res.status(400).json({
      success: false,
      message: "Asset capacity full. Cannot add more passengers.",
    });
  }
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    asset.passengers.push(passengerId);
    await asset.save({ session });
    passenger.asset = asset._id;
    await passenger.save({ session });
    await session.commitTransaction();
    session.endSession();
    const io = req.app.get("io");
    io.emit("assetUpdated", asset);

    return res.status(200).json({
      success: true,
      message: "Passenger added to asset successfully.",
      asset,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "Error adding passenger to asset.",
      error: error.message,
    });}});
export const removePassengerFromAsset = asyncHandler(async (req, res) => {
  const { passengerId } = req.body;
  const { id: assetId } = req.params;
  if (!assetId || !mongoose.Types.ObjectId.isValid(assetId)) {
    return res.status(400).json({
      success: false,
      message: "Valid Asset ID is required in URL parameters.",
    });
  }

  if (!passengerId || !mongoose.Types.ObjectId.isValid(passengerId)) {
    return res.status(400).json({
      success: false,
      message: "Valid Passenger ID is required in request body.",
    });}
  const asset = await Asset.findById(assetId);
  if (!asset) {
    return res.status(404).json({
      success: false,
      message: "Asset not found.",
    });
  }
  const passenger = await Passenger.findById(passengerId);
  if (!passenger) {
    return res.status(404).json({
      success: false,
      message: "Passenger not found.",
    });
  }
  if (!asset.passengers.some((p) => p.toString() === passengerId)) {
    return res.status(400).json({
      success: false,
      message: "Passenger is not assigned to this asset.",
    });
  }
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    asset.passengers = asset.passengers.filter(
      (p) => p.toString() !== passengerId
    );
    await asset.save({ session });
    if (passenger.asset && passenger.asset.toString() === assetId) {
      passenger.asset = null;
      await passenger.save({ session });
    }
    await session.commitTransaction();
    session.endSession();
    const io = req.app.get("io");
    io.emit("assetUpdated", asset);
    return res.status(200).json({
      success: true,
      message: "Passenger removed from asset successfully.",
      asset,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "Error removing passenger from asset.",
      error: error.message,
    });
  }
});
export const updateAsset = asyncHandler(async (req, res) => {
  const { capacity, isActive } = req.body;
  const { id: assetId } = req.params;

  // Validate assetId
  if (!assetId || !mongoose.Types.ObjectId.isValid(assetId)) {
    return res.status(400).json({
      success: false,
      message: "Valid Asset ID is required in URL parameters.",
    });
  }
  const asset = await Asset.findById(assetId);
  if (!asset) {
    return res.status(404).json({
      success: false,
      message: "Asset not found.",
    });
  }
  if (capacity !== undefined) {
    if (isNaN(capacity) || capacity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a positive number.",
      });
    }
    if (asset.passengers.length > capacity) {
      return res.status(400).json({
        success: false,
        message:
          "New capacity cannot be less than the number of assigned passengers.",
      });
    }
    asset.capacity = capacity;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value.",
      });
    }
    asset.isActive = isActive;
  }
  await asset.save();
  const io = req.app.get("io");
  io.emit("assetUpdated", asset);

  return res.status(200).json({
    success: true,
    message: "Asset updated successfully.",
    asset,
  });
});

export const deleteAsset = asyncHandler(async (req, res) => {
  const { id: assetId } = req.params;
  if (!assetId || !mongoose.Types.ObjectId.isValid(assetId)) {
    return res.status(400).json({
      success: false,
      message: "Valid Asset ID is required in URL parameters.",
    });
  }
  const asset = await Asset.findById(assetId);
  if (!asset) {
    return res.status(404).json({
      success: false,
      message: "Asset not found.",
    });
  }
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await Passenger.updateMany(
      { asset: assetId },
      { $set: { asset: null } },
      { session }
    );
    await asset.deleteOne({ session });
    await session.commitTransaction();
    session.endSession();
    const io = req.app.get("io");
    io.emit("assetDeleted", assetId);

    return res.status(200).json({
      success: true,
      message: "Asset deleted successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "Error deleting asset.",
      error: error.message,
    });
  }
});