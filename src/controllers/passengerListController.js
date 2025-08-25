// new
// passengerListController.js
import axios from "axios";
import Driver from "../models/driverModel.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";

// Utility: format passenger title
function formatTitle(name, phoneNumber) {
  const MAX = 24;
  const SEP = " 📞 ";
  let title = `${name}${SEP}${phoneNumber}`;
  const overflow = title.length - MAX;
  if (overflow > 0) {
    title = `${name.slice(0, name.length - overflow)}${SEP}${phoneNumber}`;
  }
  return title;
}

// Utility: UTC → IST string (for display/logs only) 
function toISTString(date) {
  if (!date) return "";
  return new Date(date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

// ✅ Weekday map in lowercase 3-letter format
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const sendPassengerList = async (req, res) => {
  console.log("🚀 [START] sendPassengerList API called.");

  try {
    const { phoneNumber } = req.body;
    console.log("👉 Step 1: Input phoneNumber =", phoneNumber);

    if (!phoneNumber) {
      console.log("❌ Phone number missing");
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    // Step 2: Find driver
    const driver = await Driver.findOne({ phoneNumber });
    console.log("👉 Step 2: Driver found =", driver?._id || "❌ none");
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found." });
    }

    // Step 3: Find asset
    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber Employee_Address",
    });
    console.log("👉 Step 3: Asset found =", asset?._id || "❌ none");
    if (!asset) {
      return res.status(404).json({ success: false, message: "No asset assigned to this driver." });
    }

    // Step 4: Find journey
    const journey = await Journey.findOne({ Driver: driver._id });
    console.log("👉 Step 4: Journey found =", journey?._id || "❌ none");
    if (!journey) {
      return res.status(500).json({ success: false, message: "Journey record missing." });
    }

    // Step 5: Get shift block
    // Step 5: Get shift block (case-insensitive)
console.log("👉 Asset shift blocks available =", asset.passengers.map(b => b.shift));
console.log("👉 Journey_shift =", journey.Journey_shift);

const shiftBlock = asset.passengers.find(
      (b) =>
        String(b.shift || "")
          .trim()
          .toLowerCase() ===
        String(journey.Journey_shift || "").trim().toLowerCase()
    );

console.log("👉 Step 5: ShiftBlock =", shiftBlock ? "✅ found" : "❌ not found");
    if (!shiftBlock || !Array.isArray(shiftBlock.passengers)) {
      await sendWhatsAppMessage(phoneNumber, "No passengers assigned.");
      return res.json({ success: true, message: "No passengers assigned." });
    }

    // Step 6: Filtering logic (UTC)
    const nowUTC = new Date();
    const today = WEEK_DAYS[nowUTC.getDay()]; // ✅ lowercase day
    console.log("👉 Step 6: Today (UTC) =", today, "Current UTC =", nowUTC.toISOString());

    const boardedIds = new Set((journey.boardedPassengers || []).map((bp) => String(bp.passenger?._id || bp.passenger)));
    const missedIds = new Set((journey.missedPassengers || []).map((mp) => String(mp.passenger?._id || mp.passenger)));
    console.log("   Boarded IDs =", [...boardedIds]);
    console.log("   Missed IDs =", [...missedIds]);

    const newlyMissed = [];

    const rows = (shiftBlock.passengers || []).map((ps) => {
      if (!ps.passenger) return null;
      const pid = ps.passenger._id.toString();

      const boarded = boardedIds.has(pid);
      const missed = missedIds.has(pid);

      // Check buffer expiry (UTC compare)
      const bufferEndPassed = ps.bufferEnd && new Date(ps.bufferEnd).getTime() < nowUTC.getTime() && !boarded;
      if (bufferEndPassed && !missed) {
        missedIds.add(pid);
        newlyMissed.push(pid); // mark for DB update
      }

      // ✅ Normalize wfoDays to lowercase 3-letter codes
      const normalizedDays = Array.isArray(ps.wfoDays)
        ? ps.wfoDays.map((d) => d.trim().slice(0, 3).toLowerCase())
        : [];

      // ✅ If wfoDays empty → treat as NOT scheduled
      const includeToday = normalizedDays.length > 0 && normalizedDays.includes(today);

      const included = includeToday && !boarded && !missed && !bufferEndPassed;

      const reason = bufferEndPassed
        ? "⛔ bufferEnd expired"
        : missed
        ? "⛔ already missed"
        : boarded
        ? "✅ already boarded"
        : !includeToday
        ? `❌ not scheduled today (${today})`
        : "✅ included";

      console.log(`   Passenger ${ps.passenger.Employee_Name} (${pid}): ${reason}`);

      if (!included) return null;

      return {
        title: formatTitle(ps.passenger.Employee_Name, ps.passenger.Employee_PhoneNumber),
        description: `📍 ${ps.passenger.Employee_Address || "Address not set"}\n⏰ Buffer: ${toISTString(ps.bufferStart)} → ${toISTString(ps.bufferEnd)}`.slice(0, 72),
      };
    }).filter(Boolean);

    // Step 7: Update DB if new missed passengers
    if (newlyMissed.length > 0) {
      console.log("👉 Step 7: Updating Journey.missedPassengers with =", newlyMissed);
      await Journey.updateOne(
        { _id: journey._id },
        { $addToSet: { missedPassengers: { $each: newlyMissed.map(pid => ({ passenger: pid })) } } }
      );
    }

    console.log("👉 Step 8: Final filtered rows =", rows.length);

    // Step 9: Send WhatsApp message
    if (rows.length === 0) {
      await sendWhatsAppMessage(phoneNumber, "No passengers available today.");
      return res.json({ success: true, message: "No passengers available today.", rows });
    }

    const watiPayload = {
      header: "Ride Details",
      body: `Passenger list (${driver.vehicleNumber || "Unknown Vehicle"}):`,
      footer: "CabTalk",
      buttonText: "Menu",
      sections: [{ title: "Passenger Details", rows }],
    };

    console.log("👉 Step 9: Sending WhatsApp interactive list...");
    const response = await axios.post(
      `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
      watiPayload,
      {
        headers: {
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`,
          "Content-Type": "application/json-patch+json",
        },
      }
    );

    console.log("✅ Step 10: WhatsApp sent successfully.");
    return res.status(200).json({
      success: true,
      message: "Passenger list sent successfully via WhatsApp.",
      data: response.data,
    });

  } catch (error) {
    console.error("❌ sendPassengerList failed:", error);
    return res.status(500).json({ success: false, message: "Internal error", error: error.message });
  }
};
