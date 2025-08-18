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

function toMinutesOfDay(value) {
  if (!value && value !== 0) return null;

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
    const hhmm = value.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      const hh = Number(hhmm[1]);
      const mm = Number(hhmm[2]);
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
        return hh * 60 + mm;
      }
      return null;
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }
  return null;
}

function isWithinWindow(startMin, endMin, nowMin) {
  if (startMin == null || endMin == null) return false;
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin <= endMin;
  } else {
    // overnight window
    return nowMin >= startMin || nowMin <= endMin;
  }
}

export const sendPassengerList = async (req, res) => {
  console.log("[sendPassengerList] called");
  try {
    const { phoneNumber } = req.body;
    console.log("[sendPassengerList] request body:", req.body);

    if (!phoneNumber) {
      console.warn("[sendPassengerList] Missing phoneNumber in request");
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required." });
    }

    const driver = await Driver.findOne({ phoneNumber });
    console.log("[sendPassengerList] driver lookup result:", !!driver);
    if (!driver) {
      console.warn("[sendPassengerList] No driver for", phoneNumber);
      return res
        .status(404)
        .json({ success: false, message: "Driver not found." });
    }
    console.log("[sendPassengerList] driver:", {
      id: driver._id?.toString(),
      name: driver.name,
      phoneNumber: driver.phoneNumber,
      vehicleNumber: driver.vehicleNumber,
    });

    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber Employee_Address",
    });
    console.log("[sendPassengerList] asset lookup result:", !!asset);
    if (!asset) {
      console.warn("[sendPassengerList] No asset for driver", driver._id);
      await sendWhatsAppMessage(
        phoneNumber,
        "No asset assigned to you. Please contact operations."
      ).catch((e) =>
        console.warn("[sendPassengerList] sendWhatsAppMessage error:", e.message)
      );
      return res
        .status(404)
        .json({ success: false, message: "No asset assigned to this driver." });
    }
    console.log("[sendPassengerList] asset shortId/driver:", {
      shortId: asset.shortId,
      capacity: asset.capacity,
      isActive: asset.isActive,
      passengerGroups: (asset.passengers || []).length,
    });

    const journey = await Journey.findOne({ Driver: driver._id });
    console.log("[sendPassengerList] journey lookup result:", !!journey);
    if (!journey) {
      console.error(
        "[sendPassengerList] Missing journey record for driver",
        driver._id
      );
      return res
        .status(500)
        .json({ success: false, message: "Journey record missing." });
    }
    console.log("[sendPassengerList] journey:", {
      id: journey._id?.toString(),
      Journey_shift: journey.Journey_shift,
      boardedCount: (journey.boardedPassengers || []).length,
    });

    const shiftBlock = (asset.passengers || []).find(
      (b) => b.shift === journey.Journey_shift
    );
    console.log("[sendPassengerList] shiftBlock found:", !!shiftBlock);
    if (
      !shiftBlock ||
      !Array.isArray(shiftBlock.passengers) ||
      shiftBlock.passengers.length === 0
    ) {
      console.log("[sendPassengerList] no passengers in this shiftBlock");
      await sendWhatsAppMessage(
        phoneNumber,
        "No passengers assigned to this Shift."
      ).catch((e) =>
        console.warn("[sendPassengerList] sendWhatsAppMessage error:", e.message)
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
    console.log("[sendPassengerList] now (Asia/Kolkata):", now.toISOString(), {
      day: today,
      nowMinutes,
    });

    const boardedIds = new Set(
      (journey.boardedPassengers || []).map((evt) =>
        typeof evt.passenger === "object"
          ? evt.passenger._id?.toString()
          : String(evt.passenger)
      )
    );
    console.log("[sendPassengerList] boardedIds:", Array.from(boardedIds));

    // debug list of all passengers in shiftBlock
    console.log(
      "[sendPassengerList] raw passengers in shiftBlock:",
      shiftBlock.passengers.map((ps, i) => ({
        idx: i,
        passengerId: ps.passenger?._id?.toString(),
        name: ps.passenger?.Employee_Name,
        wfoDays: ps.wfoDays,
        bufferStart: ps.bufferStart,
        bufferEnd: ps.bufferEnd,
      }))
    );

    const rows = (shiftBlock.passengers || [])
      .filter((ps) => {
        // ensure passenger exists and populated
        if (!ps || !ps.passenger || !ps.passenger._id) {
          console.log("[sendPassengerList][filter] skipping - no passenger object", ps);
          return false;
        }
        const pid = ps.passenger._id.toString();

        // skip if boarded
        if (boardedIds.has(pid)) {
          console.log(`[sendPassengerList][filter] skipping boarded passenger ${pid}`);
          return false;
        }

        // wfoDays must include today
        if (!Array.isArray(ps.wfoDays) || !ps.wfoDays.includes(today)) {
          console.log(
            `[sendPassengerList][filter] skipping ${pid} - wfoDays doesn't include ${today}`,
            ps.wfoDays
          );
          return false;
        }

        // compute minutes-of-day for start/end
        const startMin = toMinutesOfDay(ps.bufferStart);
        const endMin = toMinutesOfDay(ps.bufferEnd);

        // log parsed buffer values
        console.log(
          `[sendPassengerList][filter] passenger ${pid} parsed buffers -> startMin: ${startMin}, endMin: ${endMin}`
        );

        if (startMin == null || endMin == null) {
          console.log(
            `[sendPassengerList][filter] skipping ${pid} - invalid or missing bufferStart/bufferEnd`
          );
          return false;
        }

        // check time window (supports overnight)
        if (!isWithinWindow(startMin, endMin, nowMinutes)) {
          console.log(
            `[sendPassengerList][filter] skipping ${pid} - outside time window (${startMin}->${endMin})`
          );
          return false;
        }

        // passed all checks
        console.log(`[sendPassengerList][filter] including ${pid}`);
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

    console.log("[sendPassengerList] rows prepared count:", rows.length);

    if (rows.length === 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No passengers scheduled for now (either not today or outside time window)."
      ).catch((e) =>
        console.warn("[sendPassengerList] sendWhatsAppMessage error:", e.message)
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

    console.log("[sendPassengerList] watiPayload:", JSON.stringify(watiPayload, null, 2));

    // Use env var for token; fallback if not set (but warn)
    const token = process.env.WATI_TOKEN || "<YOUR_WATI_TOKEN>";
    if (!process.env.WATI_TOKEN) {
      console.warn("[sendPassengerList] WATI_TOKEN not set in env; using placeholder");
    }

    try {
      const response = await axios.post(
        `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
        watiPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json-patch+json",
          },
          timeout: 10000,
        }
      );
      console.log("[sendPassengerList] WATI response status:", response.status);
      console.log("[sendPassengerList] WATI response data:", response.data);

      return res.status(200).json({
        success: true,
        message: "Passenger list sent successfully via WhatsApp.",
        data: response.data,
      });
    } catch (watiErr) {
      console.error("[sendPassengerList] WATI API error:", watiErr?.response?.data || watiErr.message);
      // still respond 200 with rows data for debugging if you want; here we return 502
      return res.status(502).json({
        success: false,
        message: "Failed to send WhatsApp message via WATI.",
        error: watiErr?.response?.data || watiErr.message,
        debugRowsCount: rows.length,
        debugRows: rows.slice(0, 10), // avoid huge payload
      });
    }
  } catch (error) {
    console.error("[sendPassengerList] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};
