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
import { storeJourneyNotifications } from "../utils/notificationService.js";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Normalize wfoDays to 3-letter lowercase format
 */
const normalizeDays = (days) => {
  if (!Array.isArray(days)) return [];
  return days.map((d) => d.trim().slice(0, 3).toLowerCase());
};

/**
 * Create Journey
 */
export const createJourney = asyncHandler(async (req, res) => {
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
    select: "Employee_ID Employee_Name Employee_PhoneNumber wfoDays",
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
      "Please end this current ride before starting a new one."
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

  if (Journey_Type.toLowerCase() === "pickup") {
    const today = WEEK_DAYS[new Date().getDay()].toLowerCase();

    const passengersForShift = [];

    for (const shift of asset.passengers) {
      if (shift.shift !== Journey_shift) continue;

      for (const sp of shift.passengers) {
        const passenger = sp.passenger;
        if (!passenger) continue;

        const normalizedDays = normalizeDays(passenger.wfoDays);
        const isScheduledToday =
          passenger.wfoDays == null || normalizedDays.includes(today);

        if (!isScheduledToday) continue;

        passengersForShift.push(sp);
      }
    }

    // store journey notifications
    try {
      await storeJourneyNotifications(newJourney._id, passengersForShift);
    } catch (err) {
      console.error("Failed to store journey notifications:", err);
    }

    // update passengers app
    try {
      await startRideUpdatePassengerController(
        { body: { vehicleNumber, Journey_shift } },
        { status: () => ({ json: () => {} }) }
      );
    } catch (err) {
      console.error("startRideUpdatePassengerController error:", err);
    }
  }

  const io = req.app.get("io");
  if (io) io.emit("newJourney", newJourney);

  return res.status(201).json({
    message: "Journey created successfully.",
    newJourney,
    updatedAsset: asset,
  });
});

/**
 * Get Journeys
 */
export const getJourneys = async (req, res) => {
  try {
    const journeys = await Journey.find()
      .populate({ path: "Driver", model: "Driver" })
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
    if (req.body.text != null) return;

    const { id: eventId, type, waId, listReply } = req.body;
    if (type !== "interactive" || !listReply?.title || !/\d{12}$/.test(listReply.title))
      return;

    const passengerPhone = listReply.title.match(/(\d{12})$/)[0];
    const driver = await Driver.findOne({ phoneNumber: waId });
    if (!driver) return;

    const journey = await Journey.findOne({ Driver: driver._id })
      .populate({
        path: "Asset",
        select: "passengers capacity",
        populate: {
          path: "passengers.passengers.passenger",
          model: "Passenger",
          select: "Employee_ID Employee_Name Employee_PhoneNumber wfoDays",
        },
      })
      .populate(
        "boardedPassengers.passenger",
        "Employee_Name Employee_PhoneNumber"
      );

    if (!journey) return;

    journey.processedWebhookEvents = journey.processedWebhookEvents || [];
    if (journey.processedWebhookEvents.includes(eventId)) return;

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
      const bpPhone =(bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "");
      return bpPhone === cleanedPhone;
    });

    if (alreadyBoarded) {
      await sendWhatsAppMessage(waId, "✅ Passenger already boarded.");
      return;
    }

    // Update journey state
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
    const today = WEEK_DAYS[new Date().getDay()].toLowerCase();

    if (jt === "pickup") {
      // Confirm pickup ONLY if scheduled today
      const normalizedDays = normalizeDays(passenger.wfoDays);
      const isScheduledToday =
        passenger.wfoDays == null || normalizedDays.includes(today);

      if (isScheduledToday) {
        await sendPickupConfirmationMessage(
          passenger.Employee_PhoneNumber,
          passenger.Employee_Name
        );
      }

      const boardedSet = new Set(
        journey.boardedPassengers.map((bp) =>
          (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "")
        )
      );
      boardedSet.add(cleanedPhone);

      // Notify other passengers (ONLY scheduled today)
      for (const shiftPassenger of thisShift.passengers) {
        const pDoc = shiftPassenger.passenger;
        if (!pDoc?.Employee_PhoneNumber) continue;

        const normalizedDays = normalizeDays(pDoc.wfoDays);
        const isScheduledTodayOther =
          pDoc.wfoDays == null || normalizedDays.includes(today);

        if (!isScheduledTodayOther) continue;

        const phoneClean = (pDoc.Employee_PhoneNumber || "").replace(/\D/g, "");
        if (!phoneClean || boardedSet.has(phoneClean)) continue;

        try {
          await sendOtherPassengerSameShiftUpdateMessage(
            pDoc.Employee_PhoneNumber,
            pDoc.Employee_Name
          );
        } catch (err) {
          console.error(
            "Failed to notify other passenger",
            pDoc.Employee_PhoneNumber,
            err
          );
        }
      }
    }

    if (jt === "drop") {
      // Confirm drop ONLY if scheduled today
      const normalizedDays = normalizeDays(passenger.wfoDays);
      const isScheduledToday =
        passenger.wfoDays == null || normalizedDays.includes(today);

      if (isScheduledToday) {
        await sendDropConfirmationMessage(
          passenger.Employee_PhoneNumber,
          passenger.Employee_Name
        );
      }
    }
  } catch (err) {
    console.error("handleWatiWebhook error:", err);
  }
});
