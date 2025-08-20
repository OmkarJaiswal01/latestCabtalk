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
import {schedulePickupNotification} from "../controllers/pickupNotificationController.js"
import {scheduleBufferEndNotification} from "../controllers/pickupNotificationController.js"



export const createJourney = async (req, res) => {
  console.log("➡️ [Step 0] [START] createJourney triggered");
  console.log("📦 [Step 0] Request Body:", JSON.stringify(req.body, null, 2));

  try {
    // Step 1: Validate request fields
    console.log("🧪 [Step 1] Validating required fields...");
    const { Journey_Type, vehicleNumber, Journey_shift } = req.body;

    if (!Journey_Type || !vehicleNumber || !Journey_shift) {
      console.warn("⚠️ [Step 1] Validation failed: Missing fields");
      return res.status(400).json({
        message: "Journey_Type, vehicleNumber and Journey_shift are required.",
      });
    }
    console.log("✅ [Step 1] Required fields validated:", {
      Journey_Type,
      vehicleNumber,
      Journey_shift,
    });

    // Step 2: Lookup driver
    console.log(`🔍 [Step 2] Searching for driver with vehicleNumber: ${vehicleNumber}`);
    const driver = await Driver.findOne({ vehicleNumber });

    if (!driver) {
      console.warn("❌ [Step 2] Driver not found for vehicleNumber:", vehicleNumber);
      return res.status(404).json({
        message: "No driver found with this vehicle number.",
      });
    }
    console.log("✅ [Step 2] Driver found:", driver._id);

    // Step 3: Lookup asset
    console.log(`🔍 [Step 3] Searching for asset assigned to driver ID: ${driver._id}`);
    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_ID Employee_Name Employee_PhoneNumber",
    });

    if (!asset) {
      console.warn("❌ [Step 3] No asset found for this driver");
      return res.status(404).json({
        message: "No assigned vehicle found for this driver.",
      });
    }
    console.log("✅ [Step 3] Asset found:", asset._id);

    // Step 4: Check for existing active journey
    console.log("🔎 [Step 4] Checking for existing active journey for this driver...");
    const existingJourney = await Journey.findOne({ Driver: driver._id });

    if (existingJourney) {
      console.warn("⛔ [Step 4] Active journey already exists for driver:", driver._id);
      await sendWhatsAppMessage(
        driver.phoneNumber,
        "Please end this current ride before starting a new one."
      );
      return res.status(400).json({
        message:
          "Active journey exists. Please end the current ride before starting a new one.",
      });
    }
    console.log("✅ [Step 4] No active journey found");

    // Step 5: Create new journey
    console.log("🛠 [Step 5] Creating a new journey document...");
    const newJourney = new Journey({
      Driver: driver._id,
      Asset: asset._id,
      Journey_Type,
      Journey_shift,
      Occupancy: 0,
      SOS_Status: false,
    });

    await newJourney.save();
    console.log("✅ [Step 5] New journey saved:", newJourney._id);

    // Step 6: Update asset
    console.log("🔧 [Step 6] Updating asset status to active...");
    asset.isActive = true;
    await asset.save();
    console.log("✅ [Step 6] Asset updated:", asset._id);

    // Step 7: Pickup-specific passenger notifications
    if (Journey_Type.toLowerCase() === "pickup") {
      console.log("📣 [Step 7] Journey type is Pickup – scheduling passenger notifications...");

      for (const shift of asset.passengers) {
        if (shift.shift !== Journey_shift) continue;

        for (const shiftPassenger of shift.passengers) {
          const { passenger, bufferStart, bufferEnd } = shiftPassenger;

          if (!passenger) {
            console.log("⏩ [Step 7] Skipping empty passenger slot");
            continue;
          }

          // 7a: Schedule Pickup reminder
          if (bufferStart) {
            try {
              await schedulePickupNotification(passenger, bufferStart);
              console.log(`🟢 [Step 7a] Pickup reminder scheduled for ${passenger.Employee_Name} at ${bufferStart}`);
            } catch (err) {
              console.error(`❌ [Step 7a] Failed to schedule pickup notification for ${passenger.Employee_Name}:`, err.message);
            }
          }

          // 7b: Schedule bufferEnd missed-boarding notification
          if (bufferEnd) {
            try {
              await scheduleBufferEndNotification(passenger, bufferEnd);
              console.log(`🕒 [Step 7b] Missed-boarding check scheduled for ${passenger.Employee_Name} at ${bufferEnd}`);
            } catch (err) {
              console.error(`❌ [Step 7b] Failed to schedule bufferEnd check for ${passenger.Employee_Name}:`, err.message);
            }
          }
        }
      }

      // 7c: Notify passenger app
      console.log("🔄 [Step 7c] Notifying passenger app of shift update...");
      try {
        const mockReq = { body: { vehicleNumber, Journey_shift } };
        const mockRes = {
          status: (code) => ({
            json: (data) =>
              console.log(`🟢 [Step 7c] Passenger notification response [${code}]:`, data),
          }),
        };
        await startRideUpdatePassengerController(mockReq, mockRes);
        console.log("✅ [Step 7c] Assigned passengers notified");

        console.log("📨 [Step 7d] Notifying other passengers in same shift...");
        await sendOtherPassengerSameShiftUpdateMessage(Journey_shift, asset._id);
        console.log("✅ [Step 7d] Same-shift passengers notified");
      } catch (err) {
        console.error("🚨 [Step 7c/7d] Error during passenger notifications:", err.message);
      }
    } else {
      console.log("ℹ️ [Step 7] Journey type is not Pickup – skipping passenger notifications");
    }

    // Step 8: Emit socket event
    console.log("📡 [Step 8] Emitting socket event: newJourney...");
    const io = req.app.get("io");
    if (io) {
      io.emit("newJourney", newJourney);
      console.log("✅ [Step 8] Socket event emitted");
    } else {
      console.warn("⚠️ [Step 8] Socket IO instance not found");
    }

    // Step 9: Return response
    console.log("✅ [Step 9] [SUCCESS] Journey creation complete");
    return res.status(201).json({
      message: "Journey created successfully.",
      newJourney,
      updatedAsset: asset,
    });
  } catch (error) {
    console.error("❌ [ERROR] createJourney failed:", error);
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
  console.log("📥 [Step 0] Received WATI webhook...");
  console.log("📝 [Step 0] Raw payload:", JSON.stringify(req.body, null, 2));

  res.sendStatus(200); // Respond immediately

  try {
    // Step 1: Ignore non-interactive text replies
    console.log("🔍 [Step 1] Checking if message is an interactive reply...");
    if (req.body.text != null) {
      console.log("🛑 [Step 1] Text message received. Ignored.", { text: req.body.text });
      return;
    }

    const { id: eventId, type, waId, listReply } = req.body;
    console.log("📦 [Step 1] Extracted payload fields:", { eventId, type, waId, listReply });

    if (type !== "interactive" || !listReply?.title || !/\d{12}$/.test(listReply.title)) {
      console.log("🛑 [Step 1] Invalid or non-interactive payload. Ignored.");
      return;
    }

    // Step 2: Extract passenger phone number
    console.log("📥 [Step 2] listReply payload:", listReply);
    const passengerPhone = listReply.title.match(/(\d{12})$/)[0];
    console.log(`📞 [Step 2] Extracted passenger phone: ${passengerPhone}`);

    // Step 3: Lookup driver
    console.log(`🔎 [Step 3] Looking up driver for waId: ${waId}...`);
    const driver = await Driver.findOne({ phoneNumber: waId });
    if (!driver) {
      console.log("🛑 [Step 3] Driver not found for waId:", waId);
      return;
    }
    console.log("✅ [Step 3] Driver found:", driver._id, driver.phoneNumber);

    // Step 4: Fetch journey
    console.log("🚐 [Step 4] Fetching journey for driver:", driver._id);
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
      .populate("boardedPassengers.passenger", "Employee_Name Employee_PhoneNumber");

    if (!journey) {
      console.log("🛑 [Step 4] Journey not found for driver:", driver._id);
      return;
    }
    console.log("✅ [Step 4] Journey found:", journey._id, "Occupancy:", journey.Occupancy);

    // Step 5: Prevent duplicate webhook events
    console.log(`🧾 [Step 5] Checking for duplicate event ID: ${eventId}`);
    journey.processedWebhookEvents = journey.processedWebhookEvents || [];
    if (journey.processedWebhookEvents.includes(eventId)) {
      console.log("🛑 [Step 5] Duplicate event detected. Skipping event:", eventId);
      return;
    }
    console.log("✅ [Step 5] Event not duplicate, proceeding...");

    // Step 6: Find passenger
    console.log(`🧍 [Step 6] Looking up passenger by phone: ${passengerPhone}`);
    const passenger = await Passenger.findOne({ Employee_PhoneNumber: passengerPhone });
    if (!passenger) {
      console.log("🚫 [Step 6] Passenger not found in DB for phone:", passengerPhone);
      await sendWhatsAppMessage(waId, "🚫 Passenger not found. Please verify and retry.");
      return;
    }
    console.log("✅ [Step 6] Passenger found:", passenger._id, passenger.Employee_Name);

    // Step 7: Validate passenger in shift
    console.log(`📋 [Step 7] Validating passenger assignment in Asset.passengers...`);
    const thisShift = journey.Asset.passengers.find((shift) =>
      shift.passengers.some((s) => s.passenger._id.equals(passenger._id))
    );

    if (!thisShift) {
      console.log("🚫 [Step 7] Passenger not assigned to vehicle today.");
      await sendWhatsAppMessage(waId, "🚫 Passenger not assigned to this vehicle today.");
      return;
    }
    console.log("✅ [Step 7] Passenger is assigned to this vehicle shift.");

    // Step 8: Capacity check
    console.log(`🚧 [Step 8] Checking vehicle capacity (${journey.Occupancy}/${journey.Asset.capacity})`);
    if (journey.Occupancy + 1 > journey.Asset.capacity) {
      console.log("⚠️ [Step 8] Vehicle full. Boarding denied.");
      await sendWhatsAppMessage(waId, "⚠️ Cannot board. Vehicle at full capacity.");
      return;
    }
    console.log("✅ [Step 8] Capacity check passed.");

    // Step 9: Already boarded?
    const cleanedPhone = passengerPhone.replace(/\D/g, "");
    const alreadyBoarded = journey.boardedPassengers.some((bp) => {
      const bpPhone = (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "");
      return bpPhone === cleanedPhone;
    });

    if (alreadyBoarded) {
      console.log("✅ [Step 9] Passenger already boarded:", passenger.Employee_Name);
      await sendWhatsAppMessage(waId, "✅ Passenger already boarded.");
      return;
    }
    console.log("✅ [Step 9] Passenger not boarded yet. Proceeding...");

    // Step 10: Board passenger
    console.log(`🟢 [Step 10] Boarding passenger: ${passenger.Employee_Name}`);
    journey.Occupancy += 1;
    journey.boardedPassengers.push({
      passenger: passenger._id,
      boardedAt: new Date(),
    });
    journey.processedWebhookEvents.push(eventId);
    await journey.save();
    console.log("✅ [Step 10] Passenger boarded. Journey updated in DB.");

    // Step 11: Emit socket update
    if (req.app.get("io")) {
      console.log("📡 [Step 11] Emitting journey update to socket...");
      req.app.get("io").emit("journeyUpdated", journey);
    } else {
      console.log("⚠️ [Step 11] Socket.io not available in app context.");
    }

    // Step 12: Confirm with driver
    console.log("📲 [Step 12] Sending confirmation to driver...");
    await sendWhatsAppMessage(waId, "✅ Passenger confirmed. Thank you!");
    console.log("✅ [Step 12] Driver confirmation sent.");

    const jt = (journey.Journey_Type || "").toLowerCase();
    console.log("🧭 Journey type:", jt);

    // Step 13: Pickup-specific logic
    if (jt === "pickup") {
      console.log("🛻 [Step 13] Journey type is pickup. Running pickup logic...");

      await sendPickupConfirmationMessage(passenger.Employee_PhoneNumber, passenger.Employee_Name);

      // Notify other shift passengers
      const boardedSet = new Set(
        journey.boardedPassengers.map((bp) =>
          (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "")
        )
      );
      boardedSet.add(cleanedPhone);

      for (const shiftPassenger of thisShift.passengers) {
        const pDoc = shiftPassenger.passenger;
        const phoneClean = (pDoc.Employee_PhoneNumber || "").replace(/\D/g, "");

        if (!phoneClean || boardedSet.has(phoneClean)) {
          console.log(`⏩ Skipping ${pDoc.Employee_Name}: Already boarded or missing phone.`);
          continue;
        }

        const bufferEnd = shiftPassenger.bufferEnd ? new Date(shiftPassenger.bufferEnd) : null;
        if (!bufferEnd || isNaN(bufferEnd.getTime())) {
          console.warn(`⚠️ Skipping ${pDoc.Employee_Name}: Invalid or missing bufferEnd.`);
          continue;
        }

        const now = new Date();
        if (bufferEnd <= now) {
          console.log(`⏱️ Skipping ${pDoc.Employee_Name}: bufferEnd already passed.`);
          continue;
        }

        console.log(`🔔 [Step 13] Notifying ${pDoc.Employee_Name} about ${passenger.Employee_Name} boarding...`);
        await sendOtherPassengerSameShiftUpdateMessage(
          pDoc.Employee_PhoneNumber,
          pDoc.Employee_Name,
          passenger.Employee_Name
        );
      }

      // Step 14: Schedule bufferEnd reminder
      const shiftData = thisShift.passengers.find((p) =>
        p.passenger._id.equals(passenger._id)
      );
      const bufferEnd = shiftData?.bufferEnd;

      if (bufferEnd) {
        console.log(`⏳ [Step 14] Scheduling bufferEnd notification for ${passenger.Employee_Name} at ${bufferEnd}`);
        await scheduleBufferEndNotification(passenger, bufferEnd);
      } else {
        console.warn(`⚠️ [Step 14] No bufferEnd for ${passenger.Employee_Name}`);
      }
    }

    // Step 15: Drop journey
    if (jt === "drop") {
      console.log("🛬 [Step 15] Journey type is drop. Sending drop confirmation...");
      await sendDropConfirmationMessage(passenger.Employee_PhoneNumber, passenger.Employee_Name);
      console.log("✅ [Step 15] Drop confirmation sent.");
    }

    console.log("🎉 [DONE] handleWatiWebhook completed successfully.");
  } catch (err) {
    console.error("❌ [ERROR] handleWatiWebhook:", err);
  }
});
