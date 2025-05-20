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
    console.log("Incoming SOS Request:", { user_type, phone_no, sos_type });

    if (!user_type || !phone_no || !sos_type) {
      console.warn("Missing required fields:", {
        user_type,
        phone_no,
        sos_type,
      });
      return res.status(400).json({
        success: false,
        message: "user_type, phone_no, and sos_type are required.",
      });
    }
    const lowerType = user_type.toLowerCase();
    let brokenAssetId = null;
    let userDetails = { name: "", vehicle_no: "" };

    if (lowerType === "driver") {
      console.log("Lookup driver by phone:", phone_no);
      const driver = await Driver.findOne({ phoneNumber: phone_no });
      if (!driver) {
        console.warn("Driver not found:", phone_no);
        return res
          .status(404)
          .json({ success: false, message: "Driver not found" });
      }
      console.log("Driver found:", driver._id, driver.name);
      userDetails.name = driver.name;
      userDetails.vehicle_no = driver.vehicleNumber;

      let journey = await Journey.findOne({
        Driver: driver._id,
        SOS_Status: false,
      });
      if (journey) {
        console.log("Active unfla­gged journey found:", journey._id);
        journey.SOS_Status = true;
        brokenAssetId = journey.Asset;
        await journey.save();
        console.log("Flagged SOS_Status=true, brokenAssetId:", brokenAssetId);
      } else {
        console.log(
          "No unfla­gged journey. Falling back to any journey for driver."
        );

        journey = await Journey.findOne({ Driver: driver._id });
        if (journey) {
          brokenAssetId = journey.Asset;
          console.log("Recovered brokenAssetId from journey:", brokenAssetId);
        }
      }
    } else if (lowerType === "passenger") {
      console.log("Lookup passenger by phone:", phone_no);
      const passenger = await Passenger.findOne({
        Employee_PhoneNumber: phone_no,
      });
      if (!passenger) {
        console.warn("Passenger not found:", phone_no);
        return res
          .status(404)
          .json({ success: false, message: "Passenger not found" });
      }
      console.log("Passenger found:", passenger._id, passenger.Employee_Name);
      userDetails.name = passenger.Employee_Name;

      if (passenger.asset) {
        brokenAssetId = passenger.asset;
        console.log("Initial passenger.asset:", brokenAssetId);
        const assetDoc = await Asset.findById(brokenAssetId).populate(
          "driver",
          "vehicleNumber"
        );
        if (assetDoc?.driver) {
          userDetails.vehicle_no = assetDoc.driver.vehicleNumber;
          console.log(
            "Set vehicle_no from asset.driver:",
            userDetails.vehicle_no
          );
        }
      } else {
        console.log("passenger.asset is null – querying Asset.passengers");
        const assetDoc = await Asset.findOne({
          passengers: passenger._id,
          isActive: true,
        }).populate("driver", "vehicleNumber");
        if (assetDoc) {
          brokenAssetId = assetDoc._id;
          userDetails.vehicle_no = assetDoc.driver?.vehicleNumber || "";
          console.log("Found asset via passengers array:", brokenAssetId);
          console.log(
            "Set vehicle_no from asset.driver:",
            userDetails.vehicle_no
          );
        }
      }

      if (brokenAssetId) {
        let journey = await Journey.findOne({
          Asset: brokenAssetId,
          SOS_Status: false,
        });
        if (journey) {
          console.log(
            "Active unfla­gged journey found for passenger:",
            journey._id
          );
          journey.SOS_Status = true;
          await journey.save();
          console.log(
            "Flagged SOS_Status=true, brokenAssetId still:",
            brokenAssetId
          );
        } else {
          console.log("No unfla­gged journey for this asset.");
        }
      }
    }

    if (!brokenAssetId) {
      console.log(
        "No journey-asset found; checking pending SOS by phone:",
        phone_no
      );
      const pendingByPhone = await SOS.findOne({ phone_no, status: "pending" });
      if (pendingByPhone) {
        brokenAssetId = pendingByPhone.asset;
        console.log("Reused brokenAssetId from pending SOS:", brokenAssetId);
      }
    }

    if (!brokenAssetId) {
      console.warn("Cannot determine asset for SOS; aborting.");
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
      console.log("Duplicate SOS by same user & type:", phone_no, sos_type);
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
      console.log(
        "Duplicate cross-user SOS on same asset & type:",
        brokenAssetId,
        sos_type
      );
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
   console.log("Created new SOS:", sos._id, "shortId:", sos.shortId);

    const io = req.app.get("io");
    io.emit("newSOS", sos);
    console.log("Emitted newSOS event for:", sos._id);

    return res.status(201).json({
      success: true,
      message: "SOS created successfully",
      sos,
    });
  } catch (err) {
    console.error("createSOS error:", err);
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
    console.error("getSOS error:", err);
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
    console.error("getSOSByID error:", err);
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
    console.error("resolveSOS error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const transferPassengersForSos = async (req, res) => {
  try {
    const { id } = req.params;
    const { newAssetId } = req.body;

    console.log("Received request to transfer passengers for SOS ID:", id);
    console.log("New asset ID provided:", newAssetId);

    if (!newAssetId) {
      console.log("Missing newAssetId in request body");
      return res.status(400).json({ success: false, message: "newAssetId is required" });
    }

    const sos = await SOS.findById(id);
    console.log("Fetched SOS:", sos);

    if (!sos) {
      console.log("SOS not found with ID:", id);
      return res.status(404).json({ success: false, message: "SOS not found" });
    }

    if (sos.status !== "pending") {
      console.log("SOS already resolved. Current status:", sos.status);
      return res.status(400).json({ success: false, message: "SOS already resolved" });
    }

    const brokenAssetId = sos.asset.toString();
    console.log("Broken asset ID from SOS:", brokenAssetId);

    if (brokenAssetId === newAssetId) {
      console.log("newAssetId matches the broken asset ID. Aborting transfer.");
      return res.status(400).json({
        success: false,
        message: "newAssetId must differ from the broken asset",
      });
    }

    console.log("Fetching both broken and new asset from DB...");
    const [brokenAsset, newAsset] = await Promise.all([
      Asset.findById(brokenAssetId),
      Asset.findById(newAssetId),
    ]);
    console.log("Broken asset fetched:", brokenAsset);
    console.log("New asset fetched:", newAsset);

    if (!brokenAsset) {
      console.log("Broken asset not found in DB");
      return res.status(404).json({ success: false, message: "Broken asset not found" });
    }

    if (!newAsset) {
      console.log("New asset not found in DB");
      return res.status(404).json({ success: false, message: "New asset not found" });
    }

    if (!brokenAsset.isActive) {
      console.log("Broken asset is not active. Cannot proceed.");
      return res.status(400).json({ success: false, message: "Broken asset is not active" });
    }

    if (newAsset.isActive) {
      console.log("New asset is already active. Cannot assign again.");
      return res.status(400).json({ success: false, message: "New asset is already active" });
    }

    const roster = Array.isArray(brokenAsset.passengers) ? brokenAsset.passengers : [];
    console.log("Passenger roster to transfer:", roster);

    console.log("Updating new asset to active and assigning passengers...");
    await Promise.all([
      Asset.findByIdAndUpdate(newAssetId, { passengers: roster, isActive: true }),
      Asset.findByIdAndUpdate(brokenAssetId, { isActive: false }),
    ]);
    console.log("Assets updated successfully");

    if (roster.length) {
      console.log("Updating passengers with new asset assignment...");
      await Passenger.updateMany(
        { _id: { $in: roster } },
        { asset: newAssetId }
      );
      console.log("Passengers updated with new asset assignment");
    } else {
      console.log("No passengers to update");
    }

    console.log("Updating journeys from broken asset to new asset...");
    await Journey.updateMany(
      { Asset: brokenAssetId, SOS_Status: true },
      { Asset: newAssetId }
    );
    console.log("Journeys updated");
    sos.status = "resolved";
    sos.newAsset = newAssetId;
    console.log("Saving updated SOS with new asset ID...");
    await sos.save();
    console.log("SOS updated and saved");

    console.log("Notifying passengers...");
    const passengerNotification = await sosUpdatePassengers(sos._id);
    console.log("Passenger notification result:", passengerNotification);

    console.log("Notifying driver...");
    const driverNotification = await sosUpdateDriver(sos._id);
    console.log("Driver notification result:", driverNotification);

    console.log("Emitting socket events...");
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
    console.log("Socket events emitted");

    console.log("Fetching populated new asset for response...");
    const populatedNewAsset = await Asset.findById(newAssetId)
      .populate("driver", "name vehicleNumber");

    console.log("Sending final response...");
    return res.status(200).json({
      success: true,
      newAsset: populatedNewAsset,
      notifications: {
        passengers: passengerNotification,
        driver: driverNotification,
      },
    });
  } catch (err) {
    console.error("transferPassengersForSos error:", err);
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
    console.error("sosReimbursementHandler error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};