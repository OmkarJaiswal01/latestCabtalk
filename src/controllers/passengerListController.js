// import axios from "axios";
// import Driver from "../models/driverModel.js";
// import Asset from "../models/assetModel.js";
// import Journey from "../models/JourneyModel.js";
// import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";

// function formatTitle(name, phoneNumber) {
//   const MAX = 24;
//   const SEP = " 📞 ";
//   let title = `${name}${SEP}${phoneNumber}`;
//   const overflow = title.length - MAX;
//   if (overflow > 0) {
//     title = `${name.slice(0, name.length - overflow)}${SEP}${phoneNumber}`;
//   }
//   return title;
// }

// // export const sendPassengerList = async (req, res) => {

// //   try {
// //     const { phoneNumber } = req.body;
// //     if (!phoneNumber) {
// //       console.warn("[sendPassengerList] Missing phoneNumber in request");
// //       return res
// //         .status(400)
// //         .json({ success: false, message: "Phone number is required." });
// //     }

// //     const driver = await Driver.findOne({ phoneNumber });
// //     if (!driver) {
// //       console.warn(
// //         "[sendPassengerList] No driver for phoneNumber",
// //         phoneNumber
// //       );
// //       return res
// //         .status(404)
// //         .json({ success: false, message: "Driver not found." });
// //     }

// //     const asset = await Asset.findOne({ driver: driver._id }).populate({
// //       path: "passengers.passengers.passenger",
// //       model: "Passenger",
// //       select: "Employee_Name Employee_PhoneNumber Employee_Address",
// //     });
// //     if (!asset) {
// //       console.warn("[sendPassengerList] No asset for driver", driver._id);
// //       return res
// //         .status(404)
// //         .json({ success: false, message: "No asset assigned to this driver." });
// //     }

// //     const journey = await Journey.findOne({ Driver: driver._id });
// //     if (!journey) {
// //       console.error(
// //         "[sendPassengerList] Missing journey record for driver",
// //         driver._id
// //       );
// //       return res
// //         .status(500)
// //         .json({ success: false, message: "Journey record missing." });
// //     }

// //     const shiftBlock = asset.passengers.find(
// //       (b) => b.shift === journey.Journey_shift
// //     );

// //     const defaultRow = {
// //       title: "No Passengers Assigned",
// //       description:
// //         "No passengers are currently assigned or available in your vehicle.",
// //     };

// //     if (
// //       !shiftBlock ||
// //       !Array.isArray(shiftBlock.passengers) ||
// //       shiftBlock.passengers.length === 0
// //     ) {
// //       await sendWhatsAppMessage(
// //         phoneNumber,
// //         "No passengers assigned to this Shift."
// //       );
// //       return res.status(200).json({
// //         success: true,
// //         message: "No passengers assigned to this cab.",
// //       });
// //     }

// //     const boardedIds = new Set(
// //       journey.boardedPassengers.map((evt) =>
// //         typeof evt.passenger === "object"
// //           ? evt.passenger._id.toString()
// //           : evt.passenger.toString()
// //       )
// //     );

// //     let rows = shiftBlock.passengers
// //       .map((ps) => ps.passenger)
// //       .filter((p) => !boardedIds.has(p._id.toString()))
// //       .map((p) => ({
// //         title: formatTitle(p.Employee_Name, p.Employee_PhoneNumber),
// //         description: `📍 ${p.Employee_Address}`.slice(0, 72),
// //       }));

// //     if (rows.length === 0) {
// //       await sendWhatsAppMessage(
// //         phoneNumber,
// //         "All passengers of the shift have boarded."
// //       );
// //       return res.status(200).json({
// //         success: true,
// //         message: "All passengers have boarded this cab.",
// //       });
// //     }
    
// //     const watiPayload = {
// //       header: "Ride Details",
// //       body: `Passenger list for (${
// //         driver.vehicleNumber || "Unknown Vehicle"
// //       }):`,
// //       footer: "CabTalk",
// //       buttonText: "Menu",
// //       sections: [{ title: "Passenger Details", rows }],
// //     };

// //     const response = await axios.post(
// //       `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
// //       watiPayload,
// //       {
// //         headers: {
// //           Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`,
// //           "Content-Type": "application/json-patch+json",
// //         },
// //       }
// //     );

// //     return res.status(200).json({
// //       success: true,
// //       message: "Passenger list sent successfully via WhatsApp.",
// //       data: response.data,
// //     });
// //   } catch (error) {
// //     console.error("[sendPassengerList] Error sending passenger list:", error);
// //     return res.status(500).json({
// //       success: false,
// //       message: "Internal server error.",
// //       error: error.message,
// //     });
// //   }
// // };


// export const sendPassengerList = async (req, res) => {
//   try {
//     const { phoneNumber } = req.body;
//     if (!phoneNumber) {
//       console.warn("[sendPassengerList] Missing phoneNumber in request");
//       return res
//         .status(400)
//         .json({ success: false, message: "Phone number is required." });
//     }

//     const driver = await Driver.findOne({ phoneNumber });
//     if (!driver) {
//       console.warn("[sendPassengerList] No driver for", phoneNumber);
//       return res
//         .status(404)
//         .json({ success: false, message: "Driver not found." });
//     }

//     const asset = await Asset.findOne({ driver: driver._id }).populate({
//       path: "passengers.passengers.passenger",
//       model: "Passenger",
//       select: "Employee_Name Employee_PhoneNumber Employee_Address",
//     });
//     if (!asset) {
//       console.warn("[sendPassengerList] No asset for driver", driver._id);
//       return res
//         .status(404)
//         .json({ success: false, message: "No asset assigned to this driver." });
//     }

//     const journey = await Journey.findOne({ Driver: driver._id });
//     if (!journey) {
//       console.error(
//         "[sendPassengerList] Missing journey record for driver",
//         driver._id
//       );
//       return res
//         .status(500)
//         .json({ success: false, message: "Journey record missing." });
//     }

//     const shiftBlock = asset.passengers.find(
//       (b) => b.shift === journey.Journey_shift
//     );

//     if (
//       !shiftBlock ||
//       !Array.isArray(shiftBlock.passengers) ||
//       shiftBlock.passengers.length === 0
//     ) {
//       await sendWhatsAppMessage(
//         phoneNumber,
//         "No passengers assigned to this Shift."
//       );
//       return res.status(200).json({
//         success: true,
//         message: "No passengers assigned to this cab.",
//       });
//     }

//     // ✅ Today's weekday
//     const today = new Date().toLocaleString("en-US", { weekday: "short" });

//     // ✅ Current time
//     const now = new Date();

//     const boardedIds = new Set(
//       journey.boardedPassengers.map((evt) =>
//         typeof evt.passenger === "object"
//           ? evt.passenger._id.toString()
//           : evt.passenger.toString()
//       )
//     );

//     // ✅ Filter by: day + time + not boarded
//     let rows = shiftBlock.passengers
//       .filter((ps) => {
//         if (!ps.passenger || !Array.isArray(ps.wfoDays)) return false;

//         // Check today's WFO
//         if (!ps.wfoDays.includes(today)) return false;

//         // Check time window
//         const start = ps.bufferStart ? new Date(ps.bufferStart) : null;
//         const end = ps.bufferEnd ? new Date(ps.bufferEnd) : null;

//         if (start && end && (now < start || now > end)) return false;

//         // Check not boarded
//         return !boardedIds.has(ps.passenger._id.toString());
//       })
//       .map((ps) => ({
//         title: formatTitle(
//           ps.passenger.Employee_Name,
//           ps.passenger.Employee_PhoneNumber
//         ),
//         description: `📍 ${ps.passenger.Employee_Address}`.slice(0, 72),
//       }));

//     if (rows.length === 0) {
//       await sendWhatsAppMessage(
//         phoneNumber,
//         "No passengers scheduled for now (either not today or outside time window)."
//       );
//       return res.status(200).json({
//         success: true,
//         message: "No passengers available right now for this cab.",
//       });
//     }

//     const watiPayload = {
//       header: "Ride Details",
//       body: `Passenger list for (${
//         driver.vehicleNumber || "Unknown Vehicle"
//       }):`,
//       footer: "CabTalk",
//       buttonText: "Menu",
//       sections: [{ title: "Passenger Details", rows }],
//     };

//     const response = await axios.post(
//       `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
//       watiPayload,
//       {
//         headers: {
//           Authorization: `Bearer <YOUR_WATI_TOKEN>`,
//           "Content-Type": "application/json-patch+json",
//         },
//       }
//     );

//     return res.status(200).json({
//       success: true,
//       message: "Passenger list sent successfully via WhatsApp.",
//       data: response.data,
//     });
//   } catch (error) {
//     console.error("[sendPassengerList] Error sending passenger list:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error.",
//       error: error.message,
//     });
//   }
// };


// passengerListController.js
// passengerListController.js
// replace sendPassengerList in passengerListController.js

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

function normalizeDayString(d) {
  if (d == null) return null;
  if (typeof d !== "string") d = String(d);
  d = d.trim().toLowerCase().replace(/\.$/, "");
  const map = {
    mon: "Mon", monday: "Mon",
    tue: "Tue", tuesday: "Tue",
    wed: "Wed", wednesday: "Wed",
    thu: "Thu", thursday: "Thu",
    fri: "Fri", friday: "Fri",
    sat: "Sat", saturday: "Sat",
    sun: "Sun", sunday: "Sun",
  };
  const key = d.slice(0, 3);
  return map[key] || null;
}

/**
 * Convert stored buffer value to minutes-since-midnight in IST (Asia/Kolkata).
 * - If value is a Date or ISO timestamp: interpret as UTC and convert to IST (UTC + 330 min).
 * - If value is "HH:mm": treat as IST time-of-day directly.
 * Returns null if cannot parse.
 */
function toMinutesOfDayInIST(value) {
  if (value == null) return null;

  // If string "HH:mm"
  if (typeof value === "string") {
    const hhmm = value.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      const hh = Number(hhmm[1]), mm = Number(hhmm[2]);
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) return hh * 60 + mm;
    }
  }

  // Parse as Date (ISO/etc). Treat parsed Date as UTC moment and convert to IST
  const d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) return null;

  // Use UTC hours/minutes then add IST offset (330 minutes)
  const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  const istMinutes = (utcMinutes + 330) % (24 * 60); // 330 = 5h30m
  return istMinutes;
}

function isWithinWindow(startMin, endMin, nowMin) {
  if (startMin == null || endMin == null) return false;
  if (startMin <= endMin) return nowMin >= startMin && nowMin <= endMin;
  // overnight window
  return nowMin >= startMin || nowMin <= endMin;
}

export const sendPassengerList = async (req, res) => {
  console.log("[sendPassengerList] called");
  try {
    const { phoneNumber } = req.body;
    console.log("[sendPassengerList] body:", req.body);
    if (!phoneNumber) {
      console.warn("[sendPassengerList] Missing phoneNumber");
      return res.status(400).json({ success: false, message: "Phone number required." });
    }

    const driver = await Driver.findOne({ phoneNumber });
    console.log("[sendPassengerList] driver found:", !!driver);
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found." });

    // populate passenger docs
    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber Employee_Address",
    }).lean();
    console.log("[sendPassengerList] asset found:", !!asset);
    if (!asset) {
      await sendWhatsAppMessage(phoneNumber, "No asset assigned to you.").catch(e => console.warn(e.message));
      return res.status(404).json({ success: false, message: "No asset assigned." });
    }

    const journey = await Journey.findOne({ Driver: driver._id }).lean();
    console.log("[sendPassengerList] journey found:", !!journey);
    if (!journey) return res.status(500).json({ success: false, message: "Journey record missing." });

    const shiftBlock = (asset.passengers || []).find(b => b.shift === journey.Journey_shift);
    console.log("[sendPassengerList] shiftBlock found:", !!shiftBlock, "shift:", journey.Journey_shift);
    if (!shiftBlock || !Array.isArray(shiftBlock.passengers) || shiftBlock.passengers.length === 0) {
      await sendWhatsAppMessage(phoneNumber, "No passengers assigned to this Shift.").catch(e => console.warn(e.message));
      return res.status(200).json({ success: true, message: "No passengers for this shift.", rows: [] });
    }

    // compute "now" in IST as minutes-since-midnight
    const nowUTC = new Date();
    const nowUTCMinutes = nowUTC.getUTCHours() * 60 + nowUTC.getUTCMinutes();
    const nowISTMinutes = (nowUTCMinutes + 330) % (24 * 60);
    // compute today's weekday in IST (so day checks align with IST)
    // derive IST date by shifting current UTC by 330 minutes
    const istDate = new Date(nowUTC.getTime() + 330 * 60 * 1000);
    const WEEK_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const today = WEEK_DAYS[istDate.getDay()];
    console.log("[sendPassengerList] IST now minutes:", nowISTMinutes, "IST date:", istDate.toISOString(), "today:", today);

    const boardedIds = new Set((journey.boardedPassengers || []).map(evt =>
      (typeof evt.passenger === "object" ? String(evt.passenger._id || evt.passenger) : String(evt.passenger))
    ));
    console.log("[sendPassengerList] boardedIds:", Array.from(boardedIds));

    // debug print raw passengers
    console.log("[sendPassengerList] raw shiftBlock passengers:", shiftBlock.passengers.map((ps,i) => ({
      idx: i,
      passengerId: ps.passenger?._id?.toString(),
      name: ps.passenger?.Employee_Name,
      wfoDays: ps.wfoDays,
      bufferStart: ps.bufferStart,
      bufferEnd: ps.bufferEnd
    })));

    const rows = (shiftBlock.passengers || []).filter(ps => {
      if (!ps || !ps.passenger || !ps.passenger._id) {
        console.log("[filter] skipping - missing passenger object", ps);
        return false;
      }
      const pid = String(ps.passenger._id);

      // boarded
      if (boardedIds.has(pid)) {
        console.log(`[filter] skipping ${pid} - boarded`);
        return false;
      }

      // normalize wfoDays read from DB (defensive)
      const rawDays = Array.isArray(ps.wfoDays) ? ps.wfoDays : (ps.wfoDays ? [ps.wfoDays] : []);
      const normDays = rawDays.map(d => normalizeDayString(d)).filter(Boolean);
      console.log(`[filter] passenger ${pid} rawDays:`, rawDays, "normDays:", normDays);

      // PRIMARY: day must match
      if (!normDays.includes(today)) {
        console.log(`[filter] skipping ${pid} - today (${today}) not in wfoDays`);
        return false;
      }

      // enforce buffer window only if both valid — otherwise allow (you requested day-first behaviour)
      const startMin = toMinutesOfDayInIST(ps.bufferStart);
      const endMin = toMinutesOfDayInIST(ps.bufferEnd);
      console.log(`[filter] passenger ${pid} startMin:${startMin} endMin:${endMin} (IST)`);

      if (startMin != null && endMin != null) {
        if (!isWithinWindow(startMin, endMin, nowISTMinutes)) {
          console.log(`[filter] skipping ${pid} - outside IST time window`);
          return false;
        }
      } else {
        console.log(`[filter] passenger ${pid} has missing/invalid buffers - allowed because day matched`);
      }

      console.log(`[filter] including ${pid}`);
      return true;
    }).map(ps => ({
      title: formatTitle(ps.passenger.Employee_Name || "Unknown", ps.passenger.Employee_PhoneNumber || "Unknown"),
      description: `📍 ${ps.passenger.Employee_Address || "Address not set"}`.slice(0,72)
    }));

    console.log("[sendPassengerList] final rows count:", rows.length);

    if (rows.length === 0) {
      await sendWhatsAppMessage(phoneNumber, "No passengers scheduled for now (either not today or outside time window).").catch(e => console.warn(e.message));
      return res.status(200).json({ success: true, message: "No passengers available now.", rows: [] });
    }

    const watiPayload = {
      header: "Ride Details",
      body: `Passenger list for (${driver.vehicleNumber || "Unknown Vehicle"}):`,
      footer: "CabTalk",
      buttonText: "Menu",
      sections: [{ title: "Passenger Details", rows }]
    };

    console.log("[sendPassengerList] watiPayload prepared, rows:", rows.length);

    const token = process.env.WATI_TOKEN || "<YOUR_WATI_TOKEN>";
    try {
      const response = await axios.post(
        `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
        watiPayload,
        {
          headers: { Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`, 
          "Content-Type": "application/json-patch+json" },
          timeout: 10000
        }
      );
      console.log("[sendPassengerList] WATI response:", response.status);
      return res.status(200).json({ success: true, message: "Passenger list sent via WhatsApp.", data: response.data, rows });
    } catch (watiErr) {
      console.error("[sendPassengerList] WATI error:", watiErr?.response?.data || watiErr.message);
      // return rows for debug
      return res.status(200).json({ success: false, message: "WATI send failed - returning rows for debug.", error: watiErr?.response?.data || watiErr.message, rows });
    }

  } catch (err) {
    console.error("[sendPassengerList] unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error.", error: err.message });
  }
};
