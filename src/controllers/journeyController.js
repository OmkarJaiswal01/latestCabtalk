import Journey from "../models/JourneyModel.js";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";
import { sendDropConfirmationMessage } from "../utils/dropConfirmationMsg.js";

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
  res.sendStatus(200);
  try {
    console.log("— In handleWatiWebhook, payload:", req.body);
    const { id: eventId, type, waId, listReply } = req.body;
    if (type !== "interactive" || !listReply || !listReply.title || !/\d{12}$/.test(listReply.title)) {
      console.log("Ignored: not a passenger‑selection interactive reply.");
      return;
    }

    const title = listReply.title;
    const passengerPhone = title.match(/(\d{12})$/)[0];
    console.log("List reply title:", title);
    console.log("Extracted phone:", passengerPhone);

    const driver = await Driver.findOne({ phoneNumber: waId });
    if (!driver) {
      console.log("Driver not registered:", waId);
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
      console.log("No active journey for driver:", driver._id);
      return;
    }

    if (journey.processedWebhookEvents.includes(eventId)) {
      console.log("Duplicate event ignored:", eventId);
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
      console.log("Passenger not found:", passengerPhone);
      return;
    }

    const isAssigned = journey.Asset.passengers.some((shift) =>
      shift.passengers.some((pSub) => pSub.passenger._id.equals(passenger._id))
    );
    if (!isAssigned) {
      await sendWhatsAppMessage(
        waId,
        "🚫 Passenger not assigned to this vehicle today."
      );
      console.log("Passenger not assigned to vehicle:", passenger._id);
      return;
    }
    if (journey.Occupancy + 1 > journey.Asset.capacity) {
      await sendWhatsAppMessage(
        waId,
        "⚠️ Cannot board. Vehicle at full capacity."
      );
      console.log(
        "Vehicle at full capacity. Current occupancy:",
        journey.Occupancy
      );
      return;
    }
    if (
      journey.boardedPassengers.some((evt) =>
        evt.passenger.equals(passenger._id)
      )
    ) {
      await sendWhatsAppMessage(waId, "✅ Passenger already boarded.");
      console.log("Passenger already boarded:", passenger._id);
      return;
    }

    journey.Occupancy += 1;
    journey.boardedPassengers.push({
      passenger: passenger._id,
      boardedAt: new Date(),
    });
    journey.processedWebhookEvents.push(eventId);
    await journey.save();

    if (req.app.get("io")) req.app.get("io").emit("journeyUpdated", journey);
      await sendWhatsAppMessage(waId, "✅ Passenger confirmed. Thank you!");
      console.log("Boarded passenger:", passenger._id);

    const jt = (journey.Journey_Type || "").toLowerCase();

    if (jt === "pickup") {
      await sendPickupConfirmationMessage(
        passenger.Employee_PhoneNumber,
        passenger.Employee_Name
      );

      const boardedSet = new Set(
        journey.boardedPassengers.map((bp) => bp.passenger.toString())
      );
      const thisShift = journey.Asset.passengers.find((shift) =>
        shift.passengers.some((pSub) =>
          pSub.passenger._id.equals(passenger._id)
        )
      );
      if (thisShift) {
        for (const { passenger: pDoc } of thisShift.passengers) {
          if (
            pDoc._id.equals(passenger._id) ||
            boardedSet.has(pDoc._id.toString())
          )
            continue;
          await sendOtherPassengerSameShiftUpdateMessage(
            pDoc.Employee_PhoneNumber,
            pDoc.Employee_Name,
            passenger.Employee_Name
          );
        }
      }
      return;
    }

    if (jt === "drop") {
      const dropRes = await sendDropConfirmationMessage(
        passenger.Employee_PhoneNumber,
        passenger.Employee_Name
      );
      if (!dropRes.success) {
        console.error("Drop template failed:", dropRes.error);
      }
      return;
    }
    console.warn(`Unsupported Journey_Type in handleWatiWebhook: ${journey.Journey_Type}`);
    return;
  } catch (err) {
    console.error("handleWatiWebhook error (logged internally):", err);
    return;
  }
});