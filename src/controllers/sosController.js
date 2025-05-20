import SOS from "../models/sosModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { sosUpdatePassengers } from "../utils/sosUpdatePassengers.js";
import { sosUpdateDriver } from "../utils/sosUpdateDriver.js";
import { sosReimbursement } from "../utils/sosReimbursement.js";

export const createSOS = async (req, res) => {
  try {
    const { user_type, phone_no, sos_type } = req.body;

    if (!user_type || !phone_no || !sos_type) {
      return res.status(400).json({
        success: false,
        message: "user_type, phone_no, and sos_type are required.",
      });
    }
    const lowerType = user_type.toLowerCase();
    let brokenAssetId = null;
    let userDetails = { name: "", vehicle_no: "" };

    if (lowerType === "driver") {
      const driver = await Driver.findOne({ phoneNumber: phone_no });
      if (!driver) {
        return res
          .status(404)
          .json({ success: false, message: "Driver not found" });
      }
      userDetails.name = driver.name;
      userDetails.vehicle_no = driver.vehicleNumber;

      let journey = await Journey.findOne({
        Driver: driver._id,
        SOS_Status: false,
      });
      if (journey) {
        journey.SOS_Status = true;
        brokenAssetId = journey.Asset;
        await journey.save();
      } else {
        journey = await Journey.findOne({ Driver: driver._id });
        if (journey) {
          brokenAssetId = journey.Asset;
        }
      }
    } else if (lowerType === "passenger") {
      const passenger = await Passenger.findOne({
        Employee_PhoneNumber: phone_no,
      });
      if (!passenger) {
        return res
          .status(404)
          .json({ success: false, message: "Passenger not found" });
      }
      userDetails.name = passenger.Employee_Name;

      if (passenger.asset) {
        brokenAssetId = passenger.asset;
        const assetDoc = await Asset.findById(brokenAssetId).populate(
          "driver",
          "vehicleNumber"
        );
        if (assetDoc?.driver) {
          userDetails.vehicle_no = assetDoc.driver.vehicleNumber;
        }
      } else {
        const assetDoc = await Asset.findOne({
          passengers: passenger._id,
          isActive: true,
        }).populate("driver", "vehicleNumber");
        if (assetDoc) {
          brokenAssetId = assetDoc._id;
          userDetails.vehicle_no = assetDoc.driver?.vehicleNumber || "";
        }
      }

      if (brokenAssetId) {
        let journey = await Journey.findOne({
          Asset: brokenAssetId,
          SOS_Status: false,
        });
        if (journey) {
          journey.SOS_Status = true;
          await journey.save();
        }
      }
    }

    if (!brokenAssetId) {
      const pendingByPhone = await SOS.findOne({ phone_no, status: "pending" });
      if (pendingByPhone) {
        brokenAssetId = pendingByPhone.asset;
      }
    }

    if (!brokenAssetId) {
      return res.status(400).json({
        success: false,
        message:
          "No active journey or prior SOS found; cannot determine asset.",
      });
    }

    const existingUserSOS = await SOS.findOne({
      phone_no,
      sos_type,
      status: "pending",
    });
    if (existingUserSOS) {
      return res.status(200).json({
        success: true,
        message: `You have already raised a "${sos_type}" SOS.`,
        sos: existingUserSOS,
      });
    }

    const existingAssetSOS = await SOS.findOne({
      asset: brokenAssetId,
      sos_type,
      status: "pending",
    });
    if (
      existingAssetSOS &&
      existingAssetSOS.user_type.toLowerCase() !== lowerType
    ) {
      return res.status(200).json({
        success: true,
        message: `An SOS of type "${sos_type}" is already pending on this vehicle.`,
        sos: existingAssetSOS,
      });
    }

    const sos = new SOS({
      user_type,
      phone_no,
      sos_type,
      asset: brokenAssetId,
      userDetails,
    });
    await sos.save();

    const io = req.app.get("io");
    io.emit("newSOS", sos);

    return res.status(201).json({
      success: true,
      message: "SOS created successfully",
      sos,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getSOS = async (req, res) => {
  try {
    let { date } = req.query;
    const istNow = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    if (!date) date = new Date(istNow).toISOString().split("T")[0];
    const start = new Date(`${date}T00:00:00.000+05:30`);
    const end = new Date(`${date}T23:59:59.999+05:30`);

    const sosList = await SOS.find({
      createdAt: { $gte: start, $lt: end },
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "asset",
        populate: { path: "driver", select: "name vehicleNumber" },
      })
      .populate({
        path: "newAsset",
        populate: { path: "driver", select: "name vehicleNumber" },
      })
      .lean();
    res.status(200).json({ success: true, sos: sosList });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching SOS data" });
  }
};

export const getSOSByID = async (req, res) => {
  try {
    const { id } = req.params;
    const sos = await SOS.findById(id)
      .populate({
        path: "asset",
        populate: { path: "driver", select: "name vehicleNumber" },
      })
      .populate({
        path: "newAsset",
        populate: { path: "driver", select: "name vehicleNumber" },
      });
    if (!sos) {
      return res.status(404).json({ success: false, message: "SOS not found" });
    }
    res.status(200).json({ success: true, sos });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const resolveSOS = async (req, res) => {
  try {
    const { id } = req.params;
    const sos = await SOS.findById(id);
    if (!sos) {
      return res.status(404).json({ success: false, message: "SOS not found" });
    }
    sos.status = "resolved";
    await sos.save();

    const io = req.app.get("io");
    io.emit("sosResolved", sos);

    res.status(200).json({ success: true, message: "SOS resolved", sos });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const transferPassengersForSos = async (req, res) => {
  try {
    const { id } = req.params;
    const { newAssetId } = req.body;

    if (!newAssetId) {
      return res.status(400).json({ success: false, message: "newAssetId is required" });
    }

    const sos = await SOS.findById(id);
    if (!sos) {
      return res.status(404).json({ success: false, message: "SOS not found" });
    }

    if (sos.status !== "pending") {
      return res.status(400).json({ success: false, message: "SOS already resolved" });
    }

    const brokenAssetId = sos.asset.toString();
    if (brokenAssetId === newAssetId) {
      return res.status(400).json({
        success: false,
        message: "newAssetId must differ from the broken asset",
      });
    }

    const [brokenAsset, newAsset] = await Promise.all([
      Asset.findById(brokenAssetId),
      Asset.findById(newAssetId),
    ]);

    if (!brokenAsset) {
      return res.status(404).json({ success: false, message: "Broken asset not found" });
    }
    if (!newAsset) {
      return res.status(404).json({ success: false, message: "New asset not found" });
    }
    if (!brokenAsset.isActive) {
      return res.status(400).json({ success: false, message: "Broken asset is not active" });
    }
    if (newAsset.isActive) {
      return res.status(400).json({ success: false, message: "New asset is already active" });
    }

    const roster = Array.isArray(brokenAsset.passengers) ? brokenAsset.passengers : [];

    await Promise.all([
      Asset.findByIdAndUpdate(newAssetId, { passengers: roster, isActive: true }),
      Asset.findByIdAndUpdate(brokenAssetId, { isActive: false }),
    ]);

    if (roster.length) {
      await Passenger.updateMany(
        { _id: { $in: roster } },
        { asset: newAssetId }
      );
    }

    await Journey.updateMany(
      { Asset: brokenAssetId, SOS_Status: true },
      { Asset: newAssetId }
    );

    sos.status = "resolved";
    sos.newAsset = newAssetId;
    await sos.save();

    const passengerNotification = await sosUpdatePassengers(sos._id);
    const driverNotification = await sosUpdateDriver(sos._id);

    const io = req.app.get("io");
    io.emit("passengersNotified", {
      sosId: id,
      count: passengerNotification.sentTo.length,
    });
    io.emit("driverNotified", {
      sosId: id,
      to: driverNotification.to,
      success: driverNotification.success,
    });

    const populatedNewAsset = await Asset.findById(newAssetId)
      .populate("driver", "name vehicleNumber");

    return res.status(200).json({
      success: true,
      newAsset: populatedNewAsset,
      notifications: {
        passengers: passengerNotification,
        driver: driverNotification,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const sosReimbursementHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sosReimbursement(id);
    if (!result.success) {
      return res.status(500).json({ success: false, ...result });
    }
    await SOS.findByIdAndUpdate(id, { status: "resolved" });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};