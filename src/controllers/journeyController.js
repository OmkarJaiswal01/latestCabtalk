import Journey from "../models/JourneyModel.js";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";
import { sendDropConfirmationMessage } from "../utils/dropConfirmationMsg.js";
import { startRideUpdatePassengerController } from "../utils/rideStartUpdatePassenger.js"; 



export const createJourney = async (req, res) => {
  console.log("➡️ createJourney triggered with body:", req.body);
  try {
    const { Journey_Type, vehicleNumber, Journey_shift } = req.body;

    if (!Journey_Type || !vehicleNumber || !Journey_shift) {
      console.warn("⚠️ Missing required fields");
      return res.status(400).json({
        message: "Journey_Type, vehicleNumber and Journey_shift are required.",
      });
    }

    console.log(`🔍 Looking for driver with vehicleNumber: ${vehicleNumber}`);
    const driver = await Driver.findOne({ vehicleNumber });
    if (!driver) {
      console.warn("❌ Driver not found");
      return res
        .status(404)
        .json({ message: "No driver found with this vehicle number." });
    }

    console.log(`🔍 Looking for asset assigned to driver ID: ${driver._id}`);
    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_ID Employee_Name Employee_PhoneNumber",
    });

    if (!asset) {
      console.warn("❌ No asset found for this driver");
      return res
        .status(404)
        .json({ message: "No assigned vehicle found for this driver." });
    }

    console.log("🔎 Checking for existing active journey");
    const existingJourney = await Journey.findOne({ Driver: driver._id });
    if (existingJourney) {
      console.warn("⛔ Active journey already exists");
      await sendWhatsAppMessage(
        driver.phoneNumber,
        "Please end this current ride before starting a new one."
      );
      return res.status(400).json({
        message:
          "Active journey exists. Please end the current ride before starting a new one.",
      });
    }

    console.log("🛠 Creating new journey");
    const newJourney = new Journey({
      Driver: driver._id,
      Asset: asset._id,
      Journey_Type,
      Journey_shift,
      Occupancy: 0,
      SOS_Status: false,
    });

    await newJourney.save();
    console.log("✅ New journey saved:", newJourney._id);

    asset.isActive = true;
    await asset.save();
    console.log("✅ Asset marked active:", asset._id);

    // 🔔 Notify passengers of the journey start
    try {
      console.log("📣 Notifying passengers via startRideUpdatePassengerController");
      const mockReq = {
        body: { vehicleNumber, Journey_shift },
      };
      const mockRes = {
        status: (code) => ({
          json: (data) =>
            console.log(
              `🟢 startRideUpdatePassengerController response [${code}]:`,
              data
            ),
        }),
      };
      await startRideUpdatePassengerController(mockReq, mockRes);
    } catch (err) {
      console.error("🚨 Failed to notify passengers:", err.message);
    }

    const io = req.app.get("io");
    if (io) {
      console.log("📡 Emitting socket event: newJourney");
      io.emit("newJourney", newJourney);
    }

    console.log("✅ Journey creation complete");
    return res.status(201).json({
      message: "Journey created successfully.",
      newJourney,
      updatedAsset: asset,
    });
  } catch (error) {
    console.error("❌ Server error in createJourney:", error.message);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
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
  res.sendStatus(200);
  try {
    if (req.body.text != null) {
      return;
    }
    const { id: eventId, type, waId, listReply } = req.body;
    if (type !== "interactive" || !listReply?.title || !/\d{12}$/.test(listReply.title) ) {
      return;
    }

    const passengerPhone = listReply.title.match(/(\d{12})$/)[0];

    const driver = await Driver.findOne({ phoneNumber: waId });
    if (!driver) {
      return;
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
      .populate(
        "boardedPassengers.passenger",
        "Employee_Name Employee_PhoneNumber"
      );
    if (!journey) {
      return;
    }

    journey.processedWebhookEvents = journey.processedWebhookEvents || [];
    if (journey.processedWebhookEvents.includes(eventId)) {
      return;
    }
    const passenger = await Passenger.findOne({
      Employee_PhoneNumber: passengerPhone,
    });
    if (!passenger) {
      await sendWhatsAppMessage(
        waId,
        "🚫 Passenger not found. Please verify and retry."
      );
      return;
    }
    const thisShift = journey.Asset.passengers.find((shift) =>
      shift.passengers.some((s) => s.passenger._id.equals(passenger._id))
    );
    if (!thisShift) {
      await sendWhatsAppMessage(
        waId,
        "🚫 Passenger not assigned to this vehicle today."
      );
      return;
    }
    if (journey.Occupancy + 1 > journey.Asset.capacity) {
      await sendWhatsAppMessage(
        waId,
        "⚠️ Cannot board. Vehicle at full capacity."
      );
      return;
    }
    const cleanedPhone = passengerPhone.replace(/\D/g, "");
    const alreadyBoarded = journey.boardedPassengers.some((bp) => {
      const bpPhone = (bp.passenger.Employee_PhoneNumber || "").replace(
        /\D/g,
        ""
      );
      return bpPhone === cleanedPhone;
    });
    if (alreadyBoarded) {
      await sendWhatsAppMessage(waId, "✅ Passenger already boarded.");
      return;
    }
    journey.Occupancy += 1;
    journey.boardedPassengers.push({
      passenger: passenger._id,
      boardedAt: new Date(),
    });
    journey.processedWebhookEvents.push(eventId);
    await journey.save();
    if (req.app.get("io")) {
      req.app.get("io").emit("journeyUpdated", journey);
    }
    await sendWhatsAppMessage(waId, "✅ Passenger confirmed. Thank you!");
    const jt = (journey.Journey_Type || "").toLowerCase();
    if (jt === "pickup") {
      await sendPickupConfirmationMessage(
        passenger.Employee_PhoneNumber,
        passenger.Employee_Name
      );
      const boardedSet = new Set(
        journey.boardedPassengers.map((bp) =>
          (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "")
        )
      );
      boardedSet.add(cleanedPhone);

      for (const { passenger: pDoc } of thisShift.passengers) {
        const phoneClean = (pDoc.Employee_PhoneNumber || "").replace(/\D/g, "");
        if (!phoneClean || boardedSet.has(phoneClean)) continue;
        await sendOtherPassengerSameShiftUpdateMessage(
          pDoc.Employee_PhoneNumber,
          pDoc.Employee_Name,
          passenger.Employee_Name
        );
      }
    } else if (jt === "drop") {
      await sendDropConfirmationMessage(
        passenger.Employee_PhoneNumber,
        passenger.Employee_Name
      );
    }
  } catch (err) {
    console.error("handleWatiWebhook error:", err);
  }
});