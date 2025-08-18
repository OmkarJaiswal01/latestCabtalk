// passengerListController.js
import axios from "axios";
import Driver from "../models/driverModel.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";

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

// normalize day entries to short form "Mon","Tue",...
function normalizeDayString(d) {
  if (!d && d !== 0) return null;
  if (typeof d !== "string") d = String(d);
  d = d.trim().toLowerCase().replace(/\.$/, ""); // remove trailing dot like "Mon."
  // Accept full names and short names
  const map = {
    mon: "Mon", monday: "Mon",
    tue: "Tue", tuesday: "Tue",
    wed: "Wed", wednesday: "Wed",
    thu: "Thu", thursday: "Thu",
    fri: "Fri", friday: "Fri",
    sat: "Sat", saturday: "Sat",
    sun: "Sun", sunday: "Sun",
  };
  const key = d.slice(0,3); // first three letters generally unique
  if (map[key]) return map[key];
  // fallback: direct map
  return map[d] || null;
}

function toMinutesOfDay(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.getHours() * 60 + value.getMinutes();
  }
  if (typeof value === "number") {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  }
  if (typeof value === "string") {
    // HH:mm
    const hhmm = value.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      const hh = Number(hhmm[1]);
      const mm = Number(hhmm[2]);
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) return hh * 60 + mm;
      return null;
    }
    // parse full ISO string
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  }
  return null;
}

function isWithinWindow(startMin, endMin, nowMin) {
  if (startMin == null || endMin == null) return false;
  if (startMin <= endMin) return nowMin >= startMin && nowMin <= endMin;
  // overnight window: e.g., 23:00 -> 02:00
  return nowMin >= startMin || nowMin <= endMin;
}

export const sendPassengerList = async (req, res) => {
  console.log("[sendPassengerList] called");
  try {
    const { phoneNumber } = req.body;
    console.log("[sendPassengerList] request body:", req.body);

    if (!phoneNumber) {
      console.warn("[sendPassengerList] Missing phoneNumber in request");
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    const driver = await Driver.findOne({ phoneNumber });
    console.log("[sendPassengerList] driver found:", !!driver);
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found." });
    }

    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber Employee_Address",
    });
    console.log("[sendPassengerList] asset found:", !!asset);
    if (!asset) {
      await sendWhatsAppMessage(phoneNumber, "No asset assigned to you.").catch(e => 
        console.warn("[sendPassengerList] sendWhatsAppMessage error:", e.message)
      );
      return res.status(404).json({ success: false, message: "No asset assigned to this driver." });
    }

    const journey = await Journey.findOne({ Driver: driver._id });
    console.log("[sendPassengerList] journey found:", !!journey);
    if (!journey) {
      return res.status(500).json({ success: false, message: "Journey record missing." });
    }

    const shiftBlock = (asset.passengers || []).find(b => b.shift === journey.Journey_shift);
    console.log("[sendPassengerList] shiftBlock exists:", !!shiftBlock, "shift:", journey.Journey_shift);
    if (!shiftBlock || !Array.isArray(shiftBlock.passengers) || shiftBlock.passengers.length === 0) {
      await sendWhatsAppMessage(phoneNumber, "No passengers assigned to this Shift.").catch(e => 
        console.warn("[sendPassengerList] sendWhatsAppMessage error:", e.message)
      );
      return res.status(200).json({ success: true, message: "No passengers assigned to this cab." });
    }

    // get now in Asia/Kolkata (server might be in another TZ)
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = WEEK_DAYS[now.getDay()];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    console.log("[sendPassengerList] now (Asia/Kolkata):", now.toISOString(), { today, nowMinutes });

    const boardedIds = new Set((journey.boardedPassengers || []).map(evt =>
      typeof evt.passenger === "object" ? String(evt.passenger._id || evt.passenger) : String(evt.passenger)
    ));
    console.log("[sendPassengerList] boardedIds:", Array.from(boardedIds));

    // debugging: print raw passengers
    console.log("[sendPassengerList] shiftBlock.passengers (raw):",
      shiftBlock.passengers.map((ps,i) => ({
        idx: i,
        passengerId: ps.passenger?._id?.toString(),
        name: ps.passenger?.Employee_Name,
        wfoDays: ps.wfoDays,
        bufferStart: ps.bufferStart,
        bufferEnd: ps.bufferEnd
      }))
    );

    const rows = (shiftBlock.passengers || []).filter((ps) => {
      // ensure passenger populated
      if (!ps || !ps.passenger || !ps.passenger._id) {
        console.log("[filter] skipping - passenger not populated or missing id", ps && ps.passenger);
        return false;
      }
      const pid = ps.passenger._id.toString();

      // boarded check
      if (boardedIds.has(pid)) {
        console.log(`[filter] skipping ${pid} - already boarded`);
        return false;
      }

      // normalize wfoDays to an array of "Mon","Tue",...
      const rawDays = Array.isArray(ps.wfoDays) ? ps.wfoDays : (ps.wfoDays ? [ps.wfoDays] : []);
      const normDays = rawDays.map(d => normalizeDayString(d)).filter(Boolean);
      console.log(`[filter] passenger ${pid} wfoDays raw:`, rawDays, "norm:", normDays);

      // Day must match — **primary requirement**
      if (!normDays.includes(today)) {
        console.log(`[filter] skipping ${pid} - today (${today}) not in wfoDays`);
        return false;
      }

      // If both bufferStart and bufferEnd exist and are valid, enforce time window.
      const startMin = toMinutesOfDay(ps.bufferStart);
      const endMin = toMinutesOfDay(ps.bufferEnd);
      console.log(`[filter] passenger ${pid} buffer startMin:${startMin} endMin:${endMin}`);

      if (startMin != null && endMin != null) {
        if (!isWithinWindow(startMin, endMin, nowMinutes)) {
          console.log(`[filter] skipping ${pid} - outside time window`);
          return false;
        }
        // else inside window => allowed
      } else {
        // If no buffer values provided, we still allow passenger because day matched.
        console.log(`[filter] passenger ${pid} has no/invalid buffer windows - allowed because day matched`);
      }

      console.log(`[filter] including ${pid}`);
      return true;
    }).map(ps => ({
      title: formatTitle(ps.passenger.Employee_Name || "Unknown", ps.passenger.Employee_PhoneNumber || "Unknown"),
      description: `📍 ${ps.passenger.Employee_Address || "Address not set"}`.slice(0,72)
    }));

    console.log("[sendPassengerList] final rows count:", rows.length);

    if (rows.length === 0) {
      await sendWhatsAppMessage(phoneNumber, "No passengers scheduled for now (either not today or outside time window).").catch(e => 
        console.warn("[sendPassengerList] sendWhatsAppMessage error:", e.message)
      );
      return res.status(200).json({ success: true, message: "No passengers available right now for this cab.", rows: [] });
    }

    const watiPayload = {
      header: "Ride Details",
      body: `Passenger list for (${driver.vehicleNumber || "Unknown Vehicle"}):`,
      footer: "CabTalk",
      buttonText: "Menu",
      sections: [{ title: "Passenger Details", rows }]
    };

    console.log("[sendPassengerList] watiPayload prepared:", JSON.stringify(watiPayload, null, 2));

    const token = process.env.WATI_TOKEN || "<YOUR_WATI_TOKEN>";
    if (!process.env.WATI_TOKEN) console.warn("[sendPassengerList] WATI_TOKEN not found in env (using placeholder)");

    try {
      const response = await axios.post(
        `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
        watiPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json-patch+json",
          },
          timeout: 10000
        }
      );
      console.log("[sendPassengerList] WATI response:", response.status, response.data);
      return res.status(200).json({ success: true, message: "Passenger list sent via WhatsApp.", data: response.data, rows });
    } catch (watiErr) {
      console.error("[sendPassengerList] WATI error:", watiErr?.response?.data || watiErr.message);
      // return rows as debug so you can confirm filtering
      return res.status(200).json({
        success: false,
        message: "Could not send via WATI (see error). Returning filtered rows for debug.",
        error: watiErr?.response?.data || watiErr.message,
        rows
      });
    }
  } catch (err) {
    console.error("[sendPassengerList] unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error.", error: err.message });
  }
};
