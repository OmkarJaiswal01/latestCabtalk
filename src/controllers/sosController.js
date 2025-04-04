import SOS from "../models/sosModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

// CREATE SOS
export const createSOS = asyncHandler(async (req, res) => {
  const { user_type, phone_no, sos_type } = req.body;
  console.log("Received SOS request with:", { user_type, phone_no, sos_type });

  if (!user_type || !phone_no || !sos_type) {
    console.log("Missing required fields");
    return res.status(400).json({ success: false, message: "user_type, phone_no, and sos_type are required." });
  }

  let userDetails = { name: "", vehicle_no: "", assetId: null };

  if (user_type.toLowerCase() === "driver") {
    const driver = await Driver.findOne({ phoneNumber: phone_no });
    console.log("Driver fetched:", driver);

    if (driver) {
      userDetails.name = driver.name;
      userDetails.vehicle_no = driver.vehicleNumber;

      const activeJourney = await Journey.findOne({ Driver: driver._id, SOS_Status: false });
      console.log("Active journey for driver:", activeJourney);

      if (activeJourney) {
        activeJourney.SOS_Status = true;
        await activeJourney.save();
        console.log("Updated SOS_Status for driver's journey");
      }
    }
  } else if (user_type.toLowerCase() === "passenger") {
    const passenger = await Passenger.findOne({ Employee_PhoneNumber: phone_no });
    console.log("Passenger fetched:", passenger);

    if (passenger) {
      userDetails.name = passenger.Employee_Name;

      if (passenger.asset) {
        userDetails.assetId = passenger.asset;

        const asset = await Asset.findById(passenger.asset).populate("driver", "name vehicleNumber");
        console.log("Asset fetched with driver populated:", asset);

        if (asset && asset.driver) {
          userDetails.vehicle_no = asset.driver.vehicleNumber;
        }
      }

      const activeJourney = await Journey.findOne({ Asset: passenger.asset, SOS_Status: false });
      console.log("Active journey for passenger:", activeJourney);

      if (activeJourney) {
        activeJourney.SOS_Status = true;
        await activeJourney.save();
        console.log("Updated SOS_Status for passenger's journey");
      }
    }
  }

  const sos = await SOS.create({ user_type, phone_no, sos_type, status: "pending", userDetails });
  console.log("SOS record created:", sos);

  const io = req.app.get("io");
  io.emit("newSOS", sos);
  console.log("Emitted newSOS event");

  res.status(201).json({ success: true, message: "SOS created successfully", sos });
});

// GET SOS
export const getSOS = asyncHandler(async (req, res) => {
  try {
    let { date } = req.query;
    console.log("Received GET SOS request for date:", date);

    const istNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    if (!date) {
      date = new Date(istNow).toISOString().split("T")[0];
    }

    const startOfDayIST = new Date(`${date}T00:00:00.000+05:30`);
    const endOfDayIST = new Date(`${date}T23:59:59.999+05:30`);
    console.log("Querying SOS between:", startOfDayIST, "and", endOfDayIST);

    const sosList = await SOS.find({
      createdAt: { $gte: startOfDayIST, $lt: endOfDayIST }
    }).sort({ createdAt: -1 });

    console.log(`Fetched ${sosList.length} SOS entries`);
    res.status(200).json({ success: true, sos: sosList });
  } catch (error) {
    console.error("Error fetching SOS:", error);
    res.status(500).json({ success: false, message: "Error fetching SOS data", error: error.message });
  }
});

// RESOLVE SOS
export const resolveSOS = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("Received resolve SOS request for ID:", id);

  const sos = await SOS.findById(id);
  if (!sos) {
    console.log("SOS not found");
    return res.status(404).json({ success: false, message: "SOS not found" });
  }

  sos.status = "resolved";
  await sos.save();
  console.log("SOS resolved and updated:", sos);

  const io = req.app.get("io");
  io.emit("sosResolved", sos);
  console.log("Emitted sosResolved event");

  res.status(200).json({ success: true, message: "SOS resolved", sos });
});