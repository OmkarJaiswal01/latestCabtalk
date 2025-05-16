import SOS from "../models/sosModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";

export const createSOS = async (req, res) => {
  try {
    const { user_type, phone_no, sos_type } = req.body;
    console.log("Incoming SOS Request:", { user_type, phone_no, sos_type });

    // 1. Validate required fields
    if (!user_type || !phone_no || !sos_type) {
      console.warn("Missing required fields:", { user_type, phone_no, sos_type });
      return res.status(400).json({
        success: false,
        message: "user_type, phone_no, and sos_type are required."
      });
    }

    const lowerType   = user_type.toLowerCase();
    let userDetails   = { name: "", vehicle_no: "" };
    let brokenAssetId = null;

    // 2. Try to find and flag an active journey

    if (lowerType === "driver") {
      console.log("Looking up driver by phone number:", phone_no);
      const driver = await Driver.findOne({ phoneNumber: phone_no });

      if (driver) {
        console.log("Driver found:", driver._id, driver.name);
        userDetails.name       = driver.name;
        userDetails.vehicle_no = driver.vehicleNumber;

        const activeJourney = await Journey.findOne({
          Driver:     driver._id,
          SOS_Status: false
        });

        if (activeJourney) {
          console.log("Active journey found for driver:", activeJourney._id);
          activeJourney.SOS_Status = true;
          brokenAssetId            = activeJourney.Asset;
          await activeJourney.save();
          console.log("Flagged SOS_Status=true, brokenAssetId:", brokenAssetId);
        } else {
          console.log("No unfla­gged journey for driver.");
        }
      } else {
        console.warn("Driver not found for phone:", phone_no);
      }

    } else if (lowerType === "passenger") {
      console.log("Looking up passenger by phone number:", phone_no);
      const passenger = await Passenger.findOne({ Employee_PhoneNumber: phone_no });

      if (passenger) {
        console.log("Passenger found:", passenger._id, passenger.Employee_Name);
        userDetails.name = passenger.Employee_Name;

        const activeJourney = await Journey.findOne({
          Asset:      passenger.asset,
          SOS_Status: false
        });

        if (activeJourney) {
          console.log("Active journey found for passenger:", activeJourney._id);
          activeJourney.SOS_Status = true;
          brokenAssetId            = passenger.asset;
          await activeJourney.save();
          console.log("Flagged SOS_Status=true, brokenAssetId:", brokenAssetId);

          // populate vehicle number from asset
          const asset = await Asset.findById(brokenAssetId).populate("driver", "vehicleNumber");
          if (asset?.driver) {
            userDetails.vehicle_no = asset.driver.vehicleNumber;
            console.log("Set vehicle_no from asset driver:", userDetails.vehicle_no);
          }
        } else {
          console.log("No unfla­gged journey for passenger.");
        }
      } else {
        console.warn("Passenger not found for phone:", phone_no);
      }
    }

    // 3. Fallback: if still no brokenAssetId, reuse from any existing pending SOS
    if (!brokenAssetId) {
      console.log("No active journey → checking for existing pending SOS for phone:", phone_no);
      const pendingSOS = await SOS.findOne({
        phone_no,
        status: "pending"
      });

      if (pendingSOS) {
        brokenAssetId = pendingSOS.asset;
        console.log("Reused brokenAssetId from pending SOS:", brokenAssetId);

        // (Optional) re-populate vehicle_no if missing
        if (!userDetails.vehicle_no) {
          const asset = await Asset.findById(brokenAssetId).populate("driver", "vehicleNumber");
          if (asset?.driver) {
            userDetails.vehicle_no = asset.driver.vehicleNumber;
            console.log("Set vehicle_no from asset driver:", userDetails.vehicle_no);
          }
        }
      }
    }

    // 4. Abort if we still don’t have an asset
    if (!brokenAssetId) {
      console.warn("Failed to identify broken asset. Aborting SOS creation.");
      return res.status(400).json({
        success: false,
        message: "Cannot determine which asset raised this SOS. Ensure the user has an active journey or prior SOS."
      });
    }

    // 5. Block only if a pending SOS of the same type already exists for this asset
    const existingSameTypeSOS = await SOS.findOne({
      asset:    brokenAssetId,
      status:   "pending",
      sos_type: sos_type
    });

    if (existingSameTypeSOS) {
      console.log(`Pending SOS of type "${sos_type}" already exists on asset ${brokenAssetId}.`);
      return res.status(200).json({
        success: true,
        message: `An SOS of type "${sos_type}" already exists for this asset.`,
        sos: existingSameTypeSOS
      });
    }

    // 6. Create a new SOS
    const sos = await SOS.create({
      user_type,
      phone_no,
      sos_type,
      status:    "pending",
      asset:     brokenAssetId,
      userDetails
    });
    console.log("New SOS created:", sos._id);

    // 7. Emit socket event
    const io = req.app.get("io");
    io.emit("newSOS", sos);
    console.log("Emitted 'newSOS' socket event for SOS:", sos._id);

    return res.status(201).json({
      success: true,
      message: "SOS created successfully",
      sos
    });

  } catch (err) {
    console.error("createSOS error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

export const getSOS = async (req, res) => {
  try {
    let { date } = req.query;
    const istNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata",});
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
    res.status(500).json({ success: false, message: "Error fetching SOS data" });
  }
};
export const getSOSByID = async (req, res) => {
  try {
    const { id } = req.params;
    const sos = await SOS.findById(id).populate({
        path: "asset",
        populate: { path: "driver", select: "name vehicleNumber" },
      }).populate({
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

    if (!newAssetId) {
      return res
        .status(400)
        .json({ success: false, message: "newAssetId is required" });
    }

    const sos = await SOS.findById(id);
    if (!sos) {
      return res.status(404).json({ success: false, message: "SOS not found" });
    }
    if (sos.status !== "pending") {
      return res
        .status(400)
        .json({ success: false, message: "SOS already resolved" });
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
      return res
        .status(404)
        .json({ success: false, message: "Broken asset not found" });
    }
    if (!newAsset) {
      return res
        .status(404)
        .json({ success: false, message: "New asset not found" });
    }
    if (!brokenAsset.isActive) {
      return res
        .status(400)
        .json({ success: false, message: "Broken asset is not active" });
    }
    if (newAsset.isActive) {
      return res
        .status(400)
        .json({ success: false, message: "New asset is already active" });
    }

    const roster = Array.isArray(brokenAsset.passengers)
      ? brokenAsset.passengers
      : [];

    await Promise.all([
      Asset.findByIdAndUpdate(newAssetId, {
        passengers: roster,
        isActive: true,
      }),
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

    const populated = await Asset.findById(newAssetId).populate(
      "driver",
      "name vehicleNumber"
    );

    res.status(200).json({ success: true, newAsset: populated });
  } catch (err) {
    console.error("transferPassengersForSos error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};