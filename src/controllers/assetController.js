import mongoose from "mongoose";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import axios from "axios";

const updateDriverWatiStatus = async (phoneNumber, activeDriver = true) => {
  const url = `https://live-mt-server.wati.io/388428/api/v1/updateContactAttributes/${phoneNumber}`;
  const payload = {
    customParams: [
      {
        name: "active_Driver",
        value: activeDriver ? "true" : "false",
      },
    ],
  };
  try {
    await axios.post(url, payload, {
      headers: {
        "content-type": "application/json-patch+json",
        Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`,
      },
    });
  } catch (error) {
    console.error("Error updating WATI driver attribute:", error.message);
  }
};
export const getAvailableAssets = async (req, res) => {
  try {
    const assets = await Asset.find({
      isActive: false,
      $expr: {
        $eq: [
          {
            $reduce: {
              input: "$passengers",
              initialValue: 0,
              in: { $add: ["$$value", { $size: "$$this.passengers" }] },
            },
          },
          0,
        ],
      },
    })
      .select("shortId capacity driver")
      .populate("driver", "name vehicleNumber")
      .lean();
    return res.status(200).json({ success: true, assets });
  } catch (err) {
    console.error("getAvailableAssets error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
export const addAsset = asyncHandler(async (req, res) => {
  const { driverId, capacity, isActive } = req.body;
  if (!driverId || !mongoose.Types.ObjectId.isValid(driverId)) {
    return res
      .status(400)
      .json({ success: false, message: "Valid Driver ID is required." });
  }
  if (typeof capacity !== "number" || capacity <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Capacity must be a positive number." });
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return res
      .status(400)
      .json({ success: false, message: "isActive must be a boolean." });
  }
  const driver = await Driver.findById(driverId);
  if (!driver) {
    return res
      .status(404)
      .json({ success: false, message: "Driver not found." });
  }
  let asset = await Asset.findOne({ driver: driverId });
  if (asset) {
    const totalPax = asset.passengers.reduce(
      (sum, s) => sum + s.passengers.length,
      0
    );
    if (totalPax > capacity) {
      return res.status(400).json({
        success: false,
        message:
          "New capacity cannot be less than the number of assigned passengers.",
      });
    }
    asset.capacity = capacity;
    if (isActive !== undefined) asset.isActive = isActive;
    await asset.save();

    req.app.get("io").emit("assetUpdated", asset);
    await updateDriverWatiStatus(driver.phoneNumber, true);

    return res.status(200).json({
      success: true,
      message: "Asset exists—capacity updated.",
      asset,
    });
  }
  asset = await Asset.create({
    driver: driver._id,
    capacity,
    passengers: [],
    isActive: !!isActive,
  });

  req.app.get("io").emit("newAsset", asset);
  await updateDriverWatiStatus(driver.phoneNumber, true);

  return res.status(201).json({
    success: true,
    message: "Asset added successfully.",
    asset,
  });
});
export const getAllAssets = asyncHandler(async (req, res) => {
  const assets = await Asset.find()
    .populate("driver", "name vehicleNumber")
    .populate(
      "passengers.passengers.passenger",
      "Employee_ID Employee_Name Employee_PhoneNumber"
    );
  res.status(200).json({
    success: true,
    message: "Assets retrieved successfully.",
    assets,
  });
});
export const updateAsset = asyncHandler(async (req, res) => {
  const { capacity, isActive } = req.body;
  const { id: assetId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(assetId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid asset ID." });
  }

  const asset = await Asset.findById(assetId);
  if (!asset) {
    return res
      .status(404)
      .json({ success: false, message: "Asset not found." });
  }

  if (capacity !== undefined) {
    if (typeof capacity !== "number" || capacity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a positive number.",
      });
    }
    // recalc total passengers
    const totalPax = asset.passengers.reduce(
      (sum, s) => sum + s.passengers.length,
      0
    );
    if (totalPax > capacity) {
      return res.status(400).json({
        success: false,
        message: "New capacity cannot be less than current passenger count.",
      });
    }
    asset.capacity = capacity;
  }

  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "isActive must be a boolean." });
    }
    asset.isActive = isActive;
  }

  await asset.save();
  req.app.get("io").emit("assetUpdated", asset);
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
    const driver = await Driver.findById(asset.driver);
    if (driver) {
      await updateDriverWatiStatus(driver.phoneNumber, false);
    }
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
export const addMultiplePassengersToAsset = asyncHandler(async (req, res) => {
  try {
    const { passengerIds, shift } = req.body;
    const { id: assetId } = req.params;

    // 1. Validate inputs
    if (
      !mongoose.Types.ObjectId.isValid(assetId) ||
      !Array.isArray(passengerIds) ||
      passengerIds.length === 0 ||
      passengerIds.some((id) => !mongoose.Types.ObjectId.isValid(id)) ||
      typeof shift !== "string" ||
      !shift.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid assetId, non‑empty passengerIds array, and shift are required.",
      });
    }

    // 2. Load asset & passenger docs
    const [asset, passengers] = await Promise.all([
      Asset.findById(assetId),
      Passenger.find({ _id: { $in: passengerIds } }),
    ]);
    if (!asset) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found." });
    }

    // 3. Double‑assignment guard
    const already = passengers.filter((p) => p.asset);
    if (already.length) {
      return res.status(400).json({
        success: false,
        message: `Already assigned to an Asset`,
      });
    }

    const existingShift = asset.passengers.find((grp) => grp.shift === shift);
    const shiftCount = existingShift ? existingShift.passengers.length : 0;
    if (shiftCount + passengerIds.length > asset.capacity) {
      return res.status(400).json({
        success: false,
        message: `Shift capacity exceeded`,
      });
    }

    const newSubs = passengerIds.map((pid) => ({
      passenger: pid,
      requiresTransport: true,
    }));

    // 6. Insert into existing shift or create new
    const idx = asset.passengers.findIndex((grp) => grp.shift === shift);
    if (idx >= 0) {
      asset.passengers[idx].passengers.push(...newSubs);
    } else {
      asset.passengers.push({ shift, passengers: newSubs });
    }

    // 7. Persist under transaction
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await asset.save({ session });
      await Passenger.updateMany(
        { _id: { $in: passengerIds } },
        { $set: { asset: asset._id } },
        { session }
      );
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    // 8. Return populated asset
    const updated = await Asset.findById(assetId)
      .populate("driver", "name vehicleNumber")
      .populate(
        "passengers.passengers.passenger",
        "Employee_ID Employee_Name Employee_PhoneNumber"
      );

    req.app.get("io").emit("assetUpdated", updated);
    return res.status(200).json({
      success: true,
      message: "Passengers added successfully.",
      asset: updated,
    });
  } catch (error) {
    console.error("addMultiplePassengersToAsset error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding passengers.",
    });
  }
});
export const removePassengerFromAsset = asyncHandler(async (req, res) => {
  const { passengerId } = req.body;
  const { id: assetId } = req.params;

  // 1. Validate IDs
  if (!mongoose.Types.ObjectId.isValid(assetId)) {
    return res.status(400).json({
      success: false,
      message: "Valid Asset ID is required in URL parameters.",
    });
  }
  if (!mongoose.Types.ObjectId.isValid(passengerId)) {
    return res.status(400).json({
      success: false,
      message: "Valid Passenger ID is required in request body.",
    });
  }

  // 2. Load asset & passenger docs
  const [asset, passenger] = await Promise.all([
    Asset.findById(assetId),
    Passenger.findById(passengerId),
  ]);

  if (!asset) {
    return res.status(404).json({ success: false, message: "Asset not found." });
  }
  if (!passenger) {
    return res.status(404).json({ success: false, message: "Passenger not found." });
  }

  // 3. Check if assigned anywhere in the asset
  const isAssigned = asset.passengers.some((shiftGroup) =>
    shiftGroup.passengers.some((p) => p.passenger.equals(passengerId))
  );
  if (!isAssigned) {
    return res.status(400).json({
      success: false,
      message: "Passenger is not assigned to this asset.",
    });
  }

  // 4. Remove the passenger from each shift group
  for (const shiftGroup of asset.passengers) {
    shiftGroup.passengers = shiftGroup.passengers.filter(
      (p) => !p.passenger.equals(passengerId)
    );
  }
  // 5. Drop any shift groups that are now empty
  asset.passengers = asset.passengers.filter(
    (shiftGroup) => shiftGroup.passengers.length > 0
  );

  // 6. Persist both asset and passenger update in a transaction
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    await asset.save({ session });

    if (passenger.asset && passenger.asset.equals(assetId)) {
      passenger.asset = null;
      await passenger.save({ session });
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    console.error("removePassengerFromAsset error:", err);
    return res.status(500).json({
      success: false,
      message: "Error removing passenger from asset.",
    });
  } finally {
    session.endSession();
  }

  // 7. Emit update and respond
  const io = req.app.get("io");
  io.emit("assetUpdated", asset);

  return res.status(200).json({
    success: true,
    message: "Passenger removed from asset successfully.",
    asset,
  });
});

