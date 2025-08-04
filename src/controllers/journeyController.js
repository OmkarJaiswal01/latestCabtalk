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
import {sendPassengerUpdate} from "../controllers/pickupNotificationController.js"



export const createJourney = async (req, res) => {
  console.log("➡️ [START] createJourney triggered");
  console.log("📦 Request Body:", req.body);

  try {
    const { Journey_Type, vehicleNumber, Journey_shift } = req.body;

    console.log("🧪 Validating required fields...");
    if (!Journey_Type || !vehicleNumber || !Journey_shift) {
      console.warn("⚠️ Validation failed: Missing fields");
      return res.status(400).json({
        message: "Journey_Type, vehicleNumber and Journey_shift are required.",
      });
    }
    console.log("✅ Fields validated");

    console.log(`🔍 Searching for driver with vehicleNumber: ${vehicleNumber}`);
    const driver = await Driver.findOne({ vehicleNumber });

    if (!driver) {
      console.warn("❌ Driver not found");
      return res.status(404).json({
        message: "No driver found with this vehicle number.",
      });
    }
    console.log("✅ Driver found:", driver._id);

    console.log(`🔍 Searching for asset assigned to driver ID: ${driver._id}`);
    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_ID Employee_Name Employee_PhoneNumber",
    });

    if (!asset) {
      console.warn("❌ No asset found for this driver");
      return res.status(404).json({
        message: "No assigned vehicle found for this driver.",
      });
    }
    console.log("✅ Asset found:", asset._id);

    console.log("🔎 Checking for existing active journey for this driver...");
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
    console.log("✅ No active journey found");

    console.log("🛠 Creating a new journey...");
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

    console.log("🔧 Updating asset status to active...");
    asset.isActive = true;
    await asset.save();
    console.log("✅ Asset updated:", asset._id);

    // ✅ New section: Schedule WhatsApp notifications for Pickup passengers
    if (Journey_Type.toLowerCase() === "pickup") {
      console.log("📣 Journey type is Pickup – scheduling passenger notifications...");

      for (const shift of asset.passengers) {
        if (shift.shift !== Journey_shift) continue;

        for (const shiftPassenger of shift.passengers) {
          const { passenger, bufferStart, bufferEnd } = shiftPassenger;

          if (!passenger) continue;

          // 1. Schedule Pickup reminder at bufferStart (optional)
          if (bufferStart) {
            try {
              await schedulePickupNotification(passenger, bufferStart);
              console.log(`🟢 Pickup reminder scheduled for ${passenger.Employee_Name}`);
            } catch (err) {
              console.error(`❌ Failed to schedule pickup notification for ${passenger.Employee_Name}:`, err.message);
            }
          }

          // 2. Schedule bufferEnd missed-boarding notification
          if (bufferEnd) {
            try {
              await scheduleBufferEndNotification(passenger, bufferEnd);
              //  await sendWhatsAppMessage(waId, "⚠️ The passenger is late. You can move the cab now.");
             
              console.log(`🕒 Missed-boarding check scheduled for ${passenger.Employee_Name}`);
            } catch (err) {
              console.error(`❌ Failed to schedule bufferEnd check for ${passenger.Employee_Name}:`, err.message);
            }
          }


//move update other passenger
// if (bufferEnd) {
//   const delay = new Date(bufferEnd).getTime() - Date.now();

//   console.log(`🕓 bufferEnd for ${passenger.Employee_Name}: ${new Date(bufferEnd).toLocaleString()}`);
//   console.log(`⏱️ Calculated delay for missed-cab message: ${delay}ms (${Math.round(delay / 1000)} seconds)`);

//   if (delay > 0) {
//     console.log(`📅 Scheduling missed-cab message for ${passenger.Employee_Name}...`);

//     setTimeout(async () => {
//       console.log(`🚨 [Triggered] Missed-cab check for ${passenger.Employee_Name} at ${new Date().toLocaleString()}`);

//       try {
//         await sendPassengerUpdate(
//           {
//             body: {
//               phoneNumber: passenger.Employee_PhoneNumber,
//               name: passenger.Employee_Name,
//             },
//           },
//           {
//             status: () => ({
//               json: () => {},
//             }),
//           }
//         );

//         console.log(`✅ [Success] Missed-cab WhatsApp message sent for ${passenger.Employee_Name}`);
//       } catch (err) {
//         console.error(`❌ [Error] Failed to send missed-cab update for ${passenger.Employee_Name}:`, err.message);
//       }
//     }, delay);

//     console.log(`⏳ [Scheduled] Missed-cab message will be sent in ${Math.round(delay / 1000)} seconds for ${passenger.Employee_Name}`);
//   } else {
//     console.warn(`⚠️ bufferEnd is in the past for ${passenger.Employee_Name}. Skipping missed-cab scheduling.`);
//   }
// }

        }


       


      }

      // 🔄 Notifying passenger app of shift update
      try {
        const mockReq = {
          body: { vehicleNumber, Journey_shift },
        };
        const mockRes = {
          status: (code) => ({
            json: (data) =>
              console.log(`🟢 Passenger notification response [${code}]:`, data),
          }),
        };
        await startRideUpdatePassengerController(mockReq, mockRes);
        console.log("✅ Assigned passengers notified");

        console.log("📨 Notifying other passengers in same shift...");
        await sendOtherPassengerSameShiftUpdateMessage(Journey_shift, asset._id);
      } catch (err) {
        console.error("🚨 Error during passenger notifications:", err.message);
      }
    } else {
      console.log("ℹ️ Journey type is not Pickup – skipping passenger notification");
    }

    const io = req.app.get("io");
    if (io) {
      console.log("📡 Emitting socket event: newJourney");
      io.emit("newJourney", newJourney);
    } else {
      console.warn("⚠️ Socket IO instance not found");
    }

    console.log("✅ [SUCCESS] Journey creation complete");
    return res.status(201).json({
      message: "Journey created successfully.",
      newJourney,
      updatedAsset: asset,
    });
  } catch (error) {
    console.error("❌ [ERROR] Server error in createJourney:", error.message);
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
  res.sendStatus(200); // Respond immediately

  try {
    // Step 1: Ignore non-interactive text replies
    console.log("🔍 [Step 1] Checking if message is an interactive reply...");
    if (req.body.text != null) {
      console.log("🛑 [Step 1] Text message received. Ignored.");
      return;
    }

    const { id: eventId, type, waId, listReply } = req.body;
    if (type !== "interactive" || !listReply?.title || !/\d{12}$/.test(listReply.title)) {
      console.log("🛑 [Step 1] Invalid or non-interactive payload. Ignored.");
      return;
    }

    // Step 2: Extract passenger phone number
    const passengerPhone = listReply.title.match(/(\d{12})$/)[0];
    console.log(`📞 [Step 2] Extracted passenger phone: ${passengerPhone}`);

    // Step 3: Lookup driver
    console.log(`🔎 [Step 3] Looking up driver for waId: ${waId}...`);
    const driver = await Driver.findOne({ phoneNumber: waId });
    if (!driver) {
      console.log("🛑 [Step 3] Driver not found.");
      return;
    }

    // Step 4: Fetch journey
    console.log("🚐 [Step 4] Fetching journey for driver...");
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
      console.log("🛑 [Step 4] Journey not found.");
      return;
    }

    // Step 5: Prevent duplicate webhook events
    console.log(`🧾 [Step 5] Checking for duplicate event ID: ${eventId}`);
    journey.processedWebhookEvents = journey.processedWebhookEvents || [];
    if (journey.processedWebhookEvents.includes(eventId)) {
      console.log("🛑 [Step 5] Duplicate event. Skipping.");
      return;
    }

    // Step 6: Find passenger
    console.log(`🧍 [Step 6] Looking up passenger by phone: ${passengerPhone}`);
    const passenger = await Passenger.findOne({ Employee_PhoneNumber: passengerPhone });
    if (!passenger) {
      console.log("🚫 [Step 6] Passenger not found.");
      await sendWhatsAppMessage(waId, "🚫 Passenger not found. Please verify and retry.");
      return;
    }

    // Step 7: Validate passenger in shift
    console.log(`📋 [Step 7] Validating passenger assignment in shift...`);
    const thisShift = journey.Asset.passengers.find((shift) =>
      shift.passengers.some((s) => s.passenger._id.equals(passenger._id))
    );

    if (!thisShift) {
      console.log("🚫 [Step 7] Passenger not assigned to vehicle.");
      await sendWhatsAppMessage(waId, "🚫 Passenger not assigned to this vehicle today.");
      return;
    }

    // Step 8: Capacity check
    console.log(`🚧 [Step 8] Checking vehicle capacity (${journey.Occupancy}/${journey.Asset.capacity})`);
    if (journey.Occupancy + 1 > journey.Asset.capacity) {
      console.log("⚠️ [Step 8] Vehicle full. Boarding denied.");
      await sendWhatsAppMessage(waId, "⚠️ Cannot board. Vehicle at full capacity.");
      return;
    }

    // Step 9: Already boarded?
    const cleanedPhone = passengerPhone.replace(/\D/g, "");
    const alreadyBoarded = journey.boardedPassengers.some((bp) => {
      const bpPhone = (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "");
      return bpPhone === cleanedPhone;
    });

    if (alreadyBoarded) {
      console.log("✅ [Step 9] Passenger already boarded.");
      await sendWhatsAppMessage(waId, "✅ Passenger already boarded.");
      return;
    }

    // Step 10: Board passenger
    console.log(`🟢 [Step 10] Boarding passenger: ${passenger.Employee_Name}`);
    journey.Occupancy += 1;
    journey.boardedPassengers.push({
      passenger: passenger._id,
      boardedAt: new Date(),
    });
    journey.processedWebhookEvents.push(eventId);
    await journey.save();
    console.log("✅ [Step 10] Passenger boarded and journey updated.");

    // Step 11: Emit socket update
    if (req.app.get("io")) {
      console.log("📡 [Step 11] Emitting journey update to socket...");
      req.app.get("io").emit("journeyUpdated", journey);
    }

    // Step 12: Confirm with driver
    console.log("📲 [Step 12] Sending confirmation to driver...");
    await sendWhatsAppMessage(waId, "✅ Passenger confirmed. Thank you!");

    const jt = (journey.Journey_Type || "").toLowerCase();

    // Step 13: Pickup-specific logic
    if (jt === "pickup") {
      console.log("🛻 [Step 13] Journey type is pickup. Proceeding with pickup logic...");

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
        //sendOtherPassengerSameShiftUpdateMessage
        await sendPassengerUpdate(
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
        console.log(`⏳ Scheduling bufferEnd for ${passenger.Employee_Name}`);
        await scheduleBufferEndNotification(passenger, bufferEnd);
      } else {
        console.warn(`⚠️ No bufferEnd for ${passenger.Employee_Name}`);
      }
    }

    // Step 15: Drop journey
    if (jt === "drop") {
      console.log("🛬 [Step 15] Journey type is drop. Sending drop confirmation...");
      await sendDropConfirmationMessage(passenger.Employee_PhoneNumber, passenger.Employee_Name);
    }
  } catch (err) {
    console.error("❌ [ERROR] handleWatiWebhook:", err);
  }
});
