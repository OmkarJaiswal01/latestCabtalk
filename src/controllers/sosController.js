import axios from "axios";
import mongoose from "mongoose";
import SOS from "../models/sosModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import EndJourney from "../models/endJourneyModel.js";
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
    sos.sosSolution = "Overridden & resolved by Admin";
    await sos.save();

    const io = req.app.get("io");
    io.emit("sosResolved", sos);

    return res.status(200).json({
      success: true,
      message: "SOS resolved",
      sos,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const transferPassengersForSos = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { id } = req.params;
    const { newAssetId } = req.body;

    if (!newAssetId) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "newAssetId is required" });
    }

    const sos = await SOS.findById(id).session(session);
    if (!sos) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "SOS not found" });
    }
    if (sos.status !== "pending") {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "SOS already resolved" });
    }

    const brokenAssetId = sos.asset.toString();
    if (brokenAssetId === newAssetId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "newAssetId must differ from the broken asset",
      });
    }

    const [brokenAsset, newAsset] = await Promise.all([
      Asset.findById(brokenAssetId)
        .populate("driver", "name phoneNumber")
        .session(session),
      Asset.findById(newAssetId)
        .populate("driver", "name phoneNumber vehicleNumber")
        .session(session),
    ]);
    if (!brokenAsset) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Broken asset not found" });
    }
    if (!newAsset) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "New asset not found" });
    }
    if (!brokenAsset.isActive) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Broken asset is not active" });
    }
    if (newAsset.isActive) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "New asset is already active" });
    }
    const roster = Array.isArray(brokenAsset.passengers)
      ? brokenAsset.passengers
      : [];
    await Promise.all([
      Asset.findByIdAndUpdate(
        newAssetId,
        { passengers: roster, isActive: true },
        { session }
      ),
      Asset.findByIdAndUpdate(brokenAssetId, { isActive: false }, { session }),
    ]);

    await updateRideStatus(newAsset.driver.phoneNumber, true);
    await updateRideStatus(brokenAsset.driver.phoneNumber, false);

    if (roster.length) {
      await Passenger.updateMany(
        { _id: { $in: roster } },
        { asset: newAssetId }
      ).session(session);
    }

    const oldJourney = await Journey.findOne({ Asset: brokenAssetId }).session(
      session
    );

    let endedJourneyDoc = null;
    if (oldJourney) {
      const endedJourney = new EndJourney({
        JourneyId: oldJourney._id,
        Driver: oldJourney.Driver,
        Asset: oldJourney.Asset,
        Journey_Type: oldJourney.Journey_Type,
        Occupancy: oldJourney.Occupancy,
        hadSOS: oldJourney.SOS_Status,
        startedAt: oldJourney.createdAt,
        boardedPassengers: oldJourney.boardedPassengers.map((evt) => ({
          passenger: evt.passenger,
          boardedAt: evt.boardedAt,
        })),
        processedWebhookEvents: oldJourney.processedWebhookEvents,
      });
      endedJourneyDoc = await endedJourney.save({ session });

      await Journey.findByIdAndDelete(oldJourney._id).session(session);

      req.app.get("io")?.emit("journeyEnded", endedJourneyDoc);
    } else {
      console.log(
        "[INFO] No active journey found for broken asset:",
        brokenAssetId
      );
    }
    const newJourneyData = {
      Driver: newAsset.driver._id,
      Asset: newAssetId,
      Journey_Type: oldJourney.Journey_Type,
      Occupancy: oldJourney.Occupancy,
      SOS_Status: false,
      boardedPassengers: oldJourney.boardedPassengers,
      processedWebhookEvents: oldJourney.processedWebhookEvents,
      originalStart: oldJourney.createdAt,
      previousJourney: endedJourneyDoc?._id || null,
      triggeredBySOS: sos._id,
    };
    const newJourney = new Journey(newJourneyData);
    await newJourney.save({ session });
    req.app.get("io")?.emit("newJourney", newJourney);
    sos.status = "resolved";
    sos.sosSolution = "Asset Assigned";
    sos.newAsset = newAssetId;
    await sos.save({ session });
    const passengerNotification = await sosUpdatePassengers(
      sos._id,
      newAssetId
    );
    const driverNotification = await sosUpdateDriver(sos._id, newAssetId);

    req.app.get("io")?.emit("passengersNotified", {
      sosId: id,
      count: passengerNotification.sentTo?.length || 0,
    });
    req.app.get("io")?.emit("driverNotified", {
      sosId: id,
      to: driverNotification.to,
      success: driverNotification.success,
    });
    await session.commitTransaction();

    const populatedNewAsset = await Asset.findById(newAssetId).populate(
      "driver",
      "name vehicleNumber"
    );
    return res.status(200).json({
      success: true,
      newAsset: populatedNewAsset,
      notifications: {
        passengers: passengerNotification,
        driver: driverNotification,
      },
    });
  } catch (err) {
    console.error("[ERROR] transferPassengersForSos failed:", err);
    await session.abortTransaction();
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  } finally {
    session.endSession();
  }
};

const updateRideStatus = async (phoneNumber, isActive) => {
  const url = `https://live-mt-server.wati.io/388428/api/v1/updateContactAttributes/${phoneNumber}`;
  const payload = {
    customParams: [
      {
        name: "isactive",
        value: isActive ? "true" : "false",
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
    console.error("[ERROR] WATI update failed:", error.message);
  }
};

export const sosReimbursementHandler = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { id } = req.params;
    const result = await sosReimbursement(id);
    if (!result.success) {
      await session.abortTransaction();
      return res.status(500).json({ success: false, ...result });
    }
    const sos = await SOS.findById(id).session(session);
    if (!sos) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, error: "SOS not found" });
    }
    const journey = await Journey.findOne({ Asset: sos.asset }).session(
      session
    );
    if (journey) {
      const endedJourney = new EndJourney({
        JourneyId: journey._id,
        Driver: journey.Driver,
        Asset: journey.Asset,
        Journey_Type: journey.Journey_Type,
        Occupancy: journey.Occupancy,
        hadSOS: journey.SOS_Status,
        startedAt: journey.createdAt,
        boardedPassengers: journey.boardedPassengers.map((evt) => ({
          passenger: evt.passenger,
          boardedAt: evt.boardedAt,
        })),
        processedWebhookEvents: journey.processedWebhookEvents,
      });
      await endedJourney.save({ session });
      await Journey.findByIdAndDelete(journey._id, { session });
      const asset = await Asset.findById(journey.Asset).session(session);
      if (asset) {
        asset.isActive = false;
        await asset.save({ session });
      } else {
        console.log("[WARN] Asset not found for Journey:", journey.Asset);
      }
      const io = req.app.get("io");
      io?.emit("journeyEnded", endedJourney);
    } else {
      console.log("[INFO] No active journey found for SOS asset");
    }
    await SOS.findByIdAndUpdate(
      id,
      { status: "resolved", sosSolution: "Reimbursement" },
      { session }
    );
    await session.commitTransaction();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    await session.abortTransaction();
    console.error("[ERROR] sosReimbursementHandler:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  } finally {
    session.endSession();
  }
};
