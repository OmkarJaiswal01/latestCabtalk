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
      return res.status(404).json({ message: "No driver found with this vehicle number." });
    }

    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_ID Employee_Name Employee_PhoneNumber",
    });

    if (!asset) {
      return res.status(404).json({ message: "No assigned vehicle found for this driver." });
    }

    const existingJourney = await Journey.findOne({ Driver: driver._id });
    if (existingJourney) {
      return res.status(400).json({
        message: "Active journey exists. Please end the current ride before starting a new one.",
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

    // Find passengers for this shift
    const shiftGroup = asset.passengers.find((group) => group.shift === Journey_shift);

    if (shiftGroup && shiftGroup.passengers.length > 0) {
      console.log(`Sending messages to ${shiftGroup.passengers.length} passengers`);

      for (const entry of shiftGroup.passengers) {
        const passenger = entry.passenger;
        const name = passenger?.Employee_Name || "Passenger";
        const rawPhone = passenger?.Employee_PhoneNumber || "";
        const phone = rawPhone.replace(/\D/g, ""); // Remove non-digit characters

        if (phone) {
          try {
            await axios.post(
              `https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage?whatsappNumber=${phone}`,
              {
                broadcast_name: `ride_started_${Date.now()}`,
                template_name: "ride_started_update_passengers",
                parameters: [{ name: "name", value: name }],
              },
              {
                headers: {
                  "content-type": "application/json", // ✅ FIXED content type
                  Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YmM2MmFkNC04NTQ3LTRkYzItOTc0Ni0wNmRkMjZiODYzNmMiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDYvMzAvMjAyNSAwNzozNzoxNSIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.dr6x_b4olu0EL6oJcEENiD2nMYrlQx5MWlQTJBttcqg`,
                },
              }
            );
            console.log(`✅ Message sent to ${name} (${phone})`);
          } catch (err) {
            console.error(`❌ Failed to send message to ${phone}:`, err?.response?.data || err.message);
          }
        } else {
          console.warn(`⚠️ No valid phone number for passenger: ${name}`);
        }
      }
    } else {
      console.log(`No passengers found for shift: ${Journey_shift}`);
    }

    const io = req.app.get("io");
    if (io) io.emit("newJourney", newJourney);

    return res.status(201).json({
      message: "Journey created and passengers notified successfully.",
      newJourney,
      updatedAsset: asset,
    });
  } catch (error) {
    console.error("createJourney error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
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