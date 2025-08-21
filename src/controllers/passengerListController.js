

// // passengerListController.js
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

// function toMinutesOfDayIST(value) {
//   if (!value) return null;
//   const d = new Date(value);
//   if (isNaN(d.getTime())) return null;
//   const dIST = new Date(
//     d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
//   );
//   return dIST.getHours() * 60 + dIST.getMinutes();
// }


// // export const sendPassengerList = async (req, res) => {
// //   console.log("🚀 [START] sendPassengerList API called.");

// //   try {
// //     console.log("📥 [Step 0] Extracting phoneNumber from request...");
// //     const { phoneNumber } = req.body;

// //     if (!phoneNumber) {
// //       console.log("❌ [Step 0] No phoneNumber provided.");
// //       return res
// //         .status(400)
// //         .json({ success: false, message: "Phone number is required." });
// //     }
// //     console.log(`✅ [Step 0] Phone number received: ${phoneNumber}`);

// //     // Step 1: Find driver
// //     console.log("🔍 [Step 1] Looking up driver...");
// //     const driver = await Driver.findOne({ phoneNumber });

// //     if (!driver) {
// //       console.log("❌ [Step 1] Driver not found.");
// //       return res
// //         .status(404)
// //         .json({ success: false, message: "Driver not found." });
// //     }
// //     console.log(`✅ [Step 1] Driver found: ${driver._id}`);

// //     // Step 2: Find asset
// //     console.log("🔍 [Step 2] Looking up asset for driver...");
// //     const asset = await Asset.findOne({ driver: driver._id }).populate({
// //       path: "passengers.passengers.passenger",
// //       model: "Passenger",
// //       select: "Employee_Name Employee_PhoneNumber Employee_Address",
// //     });

// //     if (!asset) {
// //       console.log("❌ [Step 2] No asset assigned to driver.");
// //       return res
// //         .status(404)
// //         .json({ success: false, message: "No asset assigned to this driver." });
// //     }
// //     console.log(`✅ [Step 2] Asset found: ${asset._id}`);

// //     // Step 3: Find journey
// //     console.log("🔍 [Step 3] Looking up journey for driver...");
// //     const journey = await Journey.findOne({ Driver: driver._id });

// //     if (!journey) {
// //       console.log("❌ [Step 3] No journey record found.");
// //       return res
// //         .status(500)
// //         .json({ success: false, message: "Journey record missing." });
// //     }
// //     console.log(`✅ [Step 3] Journey found: ${journey._id}`);

// //     // Step 4: Get shift block
// //     console.log("📦 [Step 4] Extracting shift block...");
// //     const shiftBlock = asset.passengers.find(
// //       (b) => b.shift === journey.Journey_shift
// //     );

// //     if (!shiftBlock || !Array.isArray(shiftBlock.passengers)) {
// //       console.log("❌ [Step 4] No passengers assigned for this shift.");
// //       await sendWhatsAppMessage(phoneNumber, "No passengers assigned.");
// //       return res.json({
// //         success: true,
// //         message: "No passengers assigned.",
// //       });
// //     }
// //     console.log("✅ [Step 4] Shift block found with passengers.");

// //     // Step 5: Compute today's passengers
// //     console.log("📅 [Step 5] Calculating today's valid passengers...");
// //     const nowIST = new Date(
// //       new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
// //     );
// //     const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// //     const today = WEEK_DAYS[nowIST.getDay()];

// //     const boardedIds = new Set(
// //       (journey.boardedPassengers || []).map((bp) =>
// //         String(bp.passenger?._id || bp.passenger)
// //       )
// //     );

// //     const debug = [];
// //     const rows = (shiftBlock.passengers || [])
// //       .filter((ps, idx) => {
// //         if (!ps.passenger) return false;
// //         const pid = ps.passenger._id.toString();
// //         const boarded = boardedIds.has(pid);

// //         const normalizedDays = Array.isArray(ps.wfoDays)
// //           ? ps.wfoDays.map((d) => d.trim().slice(0, 3))
// //           : [];

// //         const includeToday = normalizedDays.includes(today);

// //         debug.push({
// //           idx,
// //           passengerId: pid,
// //           name: ps.passenger.Employee_Name,
// //           rawWfoDays: ps.wfoDays,
// //           normalizedDays,
// //           today,
// //           boarded,
// //           included: includeToday && !boarded,
// //           reason: !includeToday
// //             ? `today (${today}) not in wfoDays`
// //             : boarded
// //             ? "already boarded"
// //             : "included ✅",
// //         });

// //         return includeToday && !boarded;
// //       })
// //       .map((ps) => ({
// //         title: formatTitle(
// //           ps.passenger.Employee_Name || "Unknown",
// //           ps.passenger.Employee_PhoneNumber || "Unknown"
// //         ),
// //         description: `📍 ${ps.passenger.Employee_Address || "Address not set"}`,
// //       }));

// //     console.log(`✅ [Step 5] Passengers included today: ${rows.length}`);
// //     console.table(debug);

// //     if (rows.length === 0) {
// //       console.log("⚠️ [Step 5] No passengers available today.");
// //       await sendWhatsAppMessage(phoneNumber, "No passengers available today.");
// //       return res.json({
// //         success: true,
// //         message: "No passengers available today.",
// //         rows,
// //         debug,
// //       });
// //     }

// //     // Step 6: Send WhatsApp interactive list
// //     console.log("📲 [Step 6] Sending WhatsApp interactive passenger list...");
// //     const watiPayload = {
// //       header: "Ride Details",
// //       body: `Passenger list (${driver.vehicleNumber || "Unknown Vehicle"}):`,
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
// //     console.log("✅ [Step 6] Passenger list sent successfully via WhatsApp.");

// //     // Step 7: Return success response
// //     console.log("🎯 [Step 7] Returning response to client.");
// //     return res.json({
// //       success: true,
// //       message: "Passenger list sent via WhatsApp.",
// //       rows,
// //       debug,
// //       watiResponse: response.data,
// //     });
// //   } catch (error) {
// //     console.error("❌ [ERROR] sendPassengerList failed:", error);
// //     return res
// //       .status(500)
// //       .json({ success: false, message: "Internal error", error: error.message });
// //   }
// // };


// export const sendPassengerList = async (req, res) => {
//   console.log("🚀 [START] sendPassengerList API called.");

//   try {
//     const { phoneNumber } = req.body;
//     console.log("Phone number received:", phoneNumber);

//     if (!phoneNumber) {
//       console.log("❌ Phone number missing");
//       return res.status(400).json({ success: false, message: "Phone number is required." });
//     }

//     // Step 1: Find driver
//     const driver = await Driver.findOne({ phoneNumber });
//     console.log("Driver found:", driver);
//     if (!driver) {
//       console.log("❌ Driver not found");
//       return res.status(404).json({ success: false, message: "Driver not found." });
//     }

//     // Step 2: Find asset
//     const asset = await Asset.findOne({ driver: driver._id }).populate({
//       path: "passengers.passengers.passenger",
//       model: "Passenger",
//       select: "Employee_Name Employee_PhoneNumber Employee_Address",
//     });
//     console.log("Asset found:", asset);
//     if (!asset) {
//       console.log("❌ No asset assigned");
//       return res.status(404).json({ success: false, message: "No asset assigned to this driver." });
//     }

//     // Step 3: Find journey
//     const journey = await Journey.findOne({ Driver: driver._id });
//     console.log("Journey found:", journey);
//     if (!journey) {
//       console.log("❌ Journey record missing");
//       return res.status(500).json({ success: false, message: "Journey record missing." });
//     }

//     // Step 4: Get shift block
//     const shiftBlock = asset.passengers.find(
//       (b) => b.shift === journey.Journey_shift
//     );
//     console.log("Shift block found:", shiftBlock);
//     if (!shiftBlock || !Array.isArray(shiftBlock.passengers)) {
//       console.log("❌ No passengers in this shift block");
//       await sendWhatsAppMessage(phoneNumber, "No passengers assigned.");
//       return res.json({ success: true, message: "No passengers assigned." });
//     }

//     // Step 5: Filter valid passengers
//     const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
//     const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
//     const today = WEEK_DAYS[nowIST.getDay()];
//     console.log("Today:", today);

//     const boardedIds = new Set(
//       (journey.boardedPassengers || []).map((bp) =>
//         String(bp.passenger?._id || bp.passenger)
//       )
//     );
//     console.log("Boarded IDs:", boardedIds);

//     const missedIds = new Set(
//       (journey.missedPassengers || []).map((mp) =>
//         String(mp.passenger?._id || mp.passenger)
//       )
//     );
//     console.log("Missed IDs:", missedIds);

//     const debug = [];
//     const rows = (shiftBlock.passengers || [])
//       .map((ps, idx) => {
//         console.log(`Checking passenger index ${idx}:`, ps.passenger);

//         if (!ps.passenger) return null;
//         const pid = ps.passenger._id.toString();
//         const boarded = boardedIds.has(pid);
//         const missed = missedIds.has(pid);

//         // Only mark missed if bufferEnd passed and not boarded
//         const bufferEndPassed = ps.bufferEnd ? new Date(ps.bufferEnd) < nowIST && !boarded : false;
//         if (bufferEndPassed) missedIds.add(pid);

//         const normalizedDays = Array.isArray(ps.wfoDays)
//           ? ps.wfoDays.map((d) => d.trim().slice(0, 3))
//           : [];
//         const includeToday = normalizedDays.includes(today);

//         const reason = bufferEndPassed
//           ? "removed (bufferEnd expired & not boarded)"
//           : missed
//           ? "removed (already marked missed)"
//           : !includeToday
//           ? `today (${today}) not in wfoDays`
//           : boarded
//           ? "already boarded"
//           : "included ✅";

//         debug.push({
//           idx,
//           passengerId: pid,
//           name: ps.passenger.Employee_Name,
//           today,
//           boarded,
//           missed: missed || bufferEndPassed,
//           bufferEndPassed,
//           included: includeToday && !boarded && !missed && !bufferEndPassed,
//           reason,
//         });

//         console.log(`Passenger ${ps.passenger.Employee_Name} reason:`, reason);

//         if (!includeToday || boarded || missed || bufferEndPassed) return null;

//         return {
//           title: `${ps.passenger.Employee_Name} | ${ps.passenger.Employee_PhoneNumber}`,
//           description: `📍 ${ps.passenger.Employee_Address || "Address not set"}`,
//         };
//       })
//       .filter(Boolean);

//     console.log("Filtered rows:", rows);

//     if (rows.length === 0) {
//       await sendWhatsAppMessage(phoneNumber, "No passengers available today.");
//       return res.json({
//         success: true,
//         message: "No passengers available today.",
//         rows,
//         debug,
//       });
//     }

//     console.log("Sending WhatsApp interactive list...");
//     // Step 6: Send WhatsApp interactive list
//     const watiPayload = {
//       header: "Ride Details",
//       body: `Passenger list (${driver.vehicleNumber || "Unknown Vehicle"}):`,
//       footer: "CabTalk",
//       buttonText: "Menu",
//       sections: [{ title: "Passenger Details", rows }],
//     };

//     const response = await axios.post(
//       `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
//       watiPayload,
//       {
//         headers: {
//           Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`,
//           "Content-Type": "application/json-patch+json",
//         },
//       }
//     );

//     return res.json({
//       success: true,
//       message: "Passenger list sent via WhatsApp.",
//       rows,
//       debug,
//       watiResponse: response.data,
//     });
//   } catch (error) {
//     console.error("❌ sendPassengerList failed:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal error",
//       error: error.message,
//     });
//   }
// };



// passengerListController.js
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
    const shiftBlock = asset.passengers.find((b) => b.shift === journey.Journey_shift);
    console.log("👉 Step 5: ShiftBlock =", shiftBlock ? "✅ found" : "❌ not found");
    if (!shiftBlock || !Array.isArray(shiftBlock.passengers)) {
      await sendWhatsAppMessage(phoneNumber, "No passengers assigned.");
      return res.json({ success: true, message: "No passengers assigned." });
    }

    // Step 6: Filtering logic (UTC)
    const nowUTC = new Date();
    const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = WEEK_DAYS[nowUTC.getDay()];
    console.log("👉 Step 6: Today (UTC) =", today, "Current UTC =", nowUTC.toISOString());

    const boardedIds = new Set((journey.boardedPassengers || []).map((bp) => String(bp.passenger?._id || bp.passenger)));
    const missedIds = new Set((journey.missedPassengers || []).map((mp) => String(mp.passenger?._id || mp.passenger)));
    console.log("   Boarded IDs =", [...boardedIds]);
    console.log("   Missed IDs =", [...missedIds]);

    const debug = [];
    const newlyMissed = [];

    const rows = (shiftBlock.passengers || [])
      .map((ps, idx) => {
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

        const normalizedDays = Array.isArray(ps.wfoDays)
          ? ps.wfoDays.map((d) => d.trim().slice(0, 3))
          : [];
        const includeToday = normalizedDays.includes(today);

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

        debug.push({
          idx,
          passengerId: pid,
          name: ps.passenger.Employee_Name,
          boarded,
          missed: missed || bufferEndPassed,
          bufferEndPassed,
          includeToday,
          included,
          reason,
          bufferStartUTC: ps.bufferStart,
          bufferEndUTC: ps.bufferEnd,
          bufferStartIST: toISTString(ps.bufferStart),
          bufferEndIST: toISTString(ps.bufferEnd),
        });

        console.log(`   Passenger ${ps.passenger.Employee_Name} (${pid}): ${reason}`);

        if (!included) return null;

        return {
          id: pid, // ✅ WhatsApp requires unique ID
          title: formatTitle(ps.passenger.Employee_Name, ps.passenger.Employee_PhoneNumber),
          description: `📍 ${ps.passenger.Employee_Address || "Address not set"}\n⏰ Buffer: ${toISTString(
            ps.bufferStart
          )} → ${toISTString(ps.bufferEnd)}`,
        };
      })
      .filter(Boolean);

    // Step 7: Update DB if new missed passengers
    if (newlyMissed.length > 0) {
      console.log("👉 Step 7: Updating Journey.missedPassengers with =", newlyMissed);
      await Journey.updateOne(
        { _id: journey._id },
        { $addToSet: { missedPassengers: { $each: newlyMissed.map((pid) => ({ passenger: pid })) } } }
      );
    }

    console.log("👉 Step 8: Final filtered rows =", rows.length);

    // Step 9: Send WhatsApp message
    if (rows.length === 0) {
      await sendWhatsAppMessage(phoneNumber, "No passengers available today.");
      return res.json({ success: true, message: "No passengers available today.", rows, debug });
    }

    // ✅ Correct interactive list payload
    const watiPayload = {
      header: { type: "text", text: "Ride Details" },
      body: { text: `Passenger list (${driver.vehicleNumber || "Unknown Vehicle"}):` },
      footer: { text: "CabTalk" },
      action: {
        button: "Menu",
        sections: [
          {
            title: "Passenger Details",
            rows: rows,
          },
        ],
      },
    };

    console.log("👉 Step 9: Sending WhatsApp interactive list...");
    const response = await axios.post(
      `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
      watiPayload,
      {
        headers: {
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`, // 👈 replace with env var
          "Content-Type": "application/json", // ✅ FIXED
        },
      }
    );

    console.log("✅ Step 10: WhatsApp sent successfully.");
    return res.status(200).json({
      success: true,
      message: "Passenger list sent successfully via WhatsApp.",
      data: response.data,
      rows,
      debug,
    });
  } catch (error) {
    console.error("❌ sendPassengerList failed:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Internal error", error: error.message });
  }
};
