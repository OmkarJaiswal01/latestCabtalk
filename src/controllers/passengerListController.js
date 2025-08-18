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

/**
 * Convert various stored buffer representations to minutes-since-midnight.
 * Accepts Date objects, ISO date strings, or "HH:mm" strings.
 * Returns null if invalid.
 */
function toMinutesOfDay(value) {
  if (!value && value !== 0) return null;

  // Date instance or numeric timestamp
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.getHours() * 60 + value.getMinutes();
  }
  if (typeof value === "number") {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  }

  // String — try ISO parse
  if (typeof value === "string") {
    // If "HH:mm" pattern
    const hhmm = value.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      const hh = Number(hhmm[1]);
      const mm = Number(hhmm[2]);
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
        return hh * 60 + mm;
      }
      return null;
    }

    // Try Date parse for ISO or other date-time string
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }

  return null;
}

/**
 * Check whether nowMin is within the start..end window.
 * Supports windows crossing midnight (overnight).
 * If startMin or endMin is null -> returns false (we expect both to exist).
 */
function isWithinWindow(startMin, endMin, nowMin) {
  if (startMin == null || endMin == null) return false;
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin <= endMin;
  } else {
    // overnight e.g., 23:00 (1380) -> 02:00 (120)
    return nowMin >= startMin || nowMin <= endMin;
  }
}

export const sendPassengerList = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      console.warn("[sendPassengerList] Missing phoneNumber in request");
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required." });
    }

    const driver = await Driver.findOne({ phoneNumber });
    if (!driver) {
      console.warn("[sendPassengerList] No driver for", phoneNumber);
      return res
        .status(404)
        .json({ success: false, message: "Driver not found." });
    }

    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber Employee_Address",
    });
    if (!asset) {
      console.warn("[sendPassengerList] No asset for driver", driver._id);
      return res
        .status(404)
        .json({ success: false, message: "No asset assigned to this driver." });
    }

    const journey = await Journey.findOne({ Driver: driver._id });
    if (!journey) {
      console.error(
        "[sendPassengerList] Missing journey record for driver",
        driver._id
      );
      return res
        .status(500)
        .json({ success: false, message: "Journey record missing." });
    }

    const shiftBlock = asset.passengers.find(
      (b) => b.shift === journey.Journey_shift
    );

    if (
      !shiftBlock ||
      !Array.isArray(shiftBlock.passengers) ||
      shiftBlock.passengers.length === 0
    ) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No passengers assigned to this Shift."
      );
      return res.status(200).json({
        success: true,
        message: "No passengers assigned to this cab.",
      });
    }

    // Use Asia/Kolkata local "now"
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = WEEK_DAYS[now.getDay()];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const boardedIds = new Set(
      (journey.boardedPassengers || []).map((evt) =>
        typeof evt.passenger === "object"
          ? evt.passenger._id?.toString()
          : String(evt.passenger)
      )
    );

    // Filter passengers: must be populated, scheduled for today (wfoDays includes today),
    // within buffer window (supports overnight), and not already boarded.
    const rows = (shiftBlock.passengers || [])
      .filter((ps) => {
        // ensure passenger exists and populated
        if (!ps || !ps.passenger || !ps.passenger._id) return false;

        const pid = ps.passenger._id.toString();
        if (boardedIds.has(pid)) return false;

        // wfoDays must be an array and include today
        if (!Array.isArray(ps.wfoDays) || !ps.wfoDays.includes(today)) {
          return false;
        }

        // compute minutes-of-day for start/end
        const startMin = toMinutesOfDay(ps.bufferStart);
        const endMin = toMinutesOfDay(ps.bufferEnd);

        // If either invalid or missing — treat as NOT allowed (data should include both)
        if (startMin == null || endMin == null) return false;

        // check window
        if (!isWithinWindow(startMin, endMin, nowMinutes)) return false;

        return true;
      })
      .map((ps) => ({
        title: formatTitle(
          ps.passenger.Employee_Name || "Unknown",
          ps.passenger.Employee_PhoneNumber || "Unknown"
        ),
        description: `📍 ${ps.passenger.Employee_Address || "Address not set"}`.slice(
          0,
          72
        ),
      }));

    if (rows.length === 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No passengers scheduled for now (either not today or outside time window)."
      );
      return res.status(200).json({
        success: true,
        message: "No passengers available right now for this cab.",
      });
    }

    const watiPayload = {
      header: "Ride Details",
      body: `Passenger list for (${driver.vehicleNumber || "Unknown Vehicle"}):`,
      footer: "CabTalk",
      buttonText: "Menu",
      sections: [{ title: "Passenger Details", rows }],
    };

    const response = await axios.post(
      `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
      watiPayload,
      {
        headers: {
          Authorization: `Bearer <YOUR_WATI_TOKEN>`,
          "Content-Type": "application/json-patch+json",
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Passenger list sent successfully via WhatsApp.",
      data: response.data,
    });
  } catch (error) {
    console.error("[sendPassengerList] Error sending passenger list:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};
