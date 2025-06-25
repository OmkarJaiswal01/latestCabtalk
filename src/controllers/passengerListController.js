import axios from "axios";
import Driver from "../models/driverModel.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";

function formatTitle(name, phoneNumber) {
  const MAX = 24;
  const SEP = " 📞 ";
  let title = `${name}${SEP}${phoneNumber}`;
  const overflow = title.length - MAX;
  console.log(`[formatTitle] initial title="${title}", overflow=${overflow}`);
  if (overflow > 0) {
    title = `${name.slice(0, name.length - overflow)}${SEP}${phoneNumber}`;
    console.log(`[formatTitle] trimmed title="${title}"`);
  }
  return title;
}

export const sendPassengerList = async (req, res) => {
  try {
    console.log("[sendPassengerList] req.body =", req.body);
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      console.warn("[sendPassengerList] Missing phoneNumber in request");
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    const driver = await Driver.findOne({ phoneNumber });
    console.log("[sendPassengerList] driver found =", driver);
    if (!driver) {
      console.warn("[sendPassengerList] No driver for phoneNumber", phoneNumber);
      return res.status(404).json({ success: false, message: "Driver not found." });
    }

    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber Employee_Address",
    });
    console.log("[sendPassengerList] asset populated =", asset);
    if (!asset) {
      console.warn("[sendPassengerList] No asset for driver", driver._id);
      return res.status(404).json({ success: false, message: "No asset assigned to this driver." });
    }

    const journey = await Journey.findOne({ Driver: driver._id });
    console.log("[sendPassengerList] journey found =", journey);
    if (!journey) {
      console.error("[sendPassengerList] Missing journey record for driver", driver._id);
      return res.status(500).json({ success: false, message: "Journey record missing." });
    }

    const shiftBlock = asset.passengers.find(b => b.shift === journey.Journey_shift);
    console.log("[sendPassengerList] shiftBlock =", shiftBlock);
    if (!shiftBlock) {
      console.warn("[sendPassengerList] Invalid shift:", journey.Journey_shift);
      return res.status(400).json({ success: false, message: "Invalid shift on journey." });
    }

    const boardedIds = journey.boardedPassengers.map(evt => {
      const idStr = typeof evt.passenger === "object"
        ? evt.passenger._id.toString()
        : evt.passenger.toString();
      console.log("[sendPassengerList] boarded passenger id =", idStr);
      return idStr;
    });

    let rows = shiftBlock.passengers
      .map(ps => ps.passenger)
      .filter(p => {
        const keep = !boardedIds.includes(p._id.toString());
        console.log(`[sendPassengerList] passenger ${p._id}: kept=${keep}`);
        return keep;
      })
      .map(p => {
        const title = formatTitle(p.Employee_Name, p.Employee_PhoneNumber);
        const description = `📍 ${p.Employee_Address}`.slice(0, 72);
        console.log("[sendPassengerList] row item =", { title, description });
        return {
          title,
          description,
        };
      });

    if (rows.length === 0) {
      console.log("[sendPassengerList] No remaining passengers, adding default row");
      rows = [{
        title: "No Passengers Assigned",
        description: "No passengers are currently assigned or available in your vehicle.",
      }];
    }

    const watiPayload = {
      header: "Ride Details",
      body: `Passenger list for (${driver.vehicleNumber || "Unknown Vehicle"}):`,
      footer: "CabTalk",
      buttonText: "Menu",
      sections: [{ title: "Passenger Details", rows }],
    };
    console.log("[sendPassengerList] watiPayload =", JSON.stringify(watiPayload, null, 2));

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
    console.log("[sendPassengerList] WATI response =", response.data);

    return res.status(200).json({
      success: true,
      message: "Passenger list sent successfully via WhatsApp.",
      data: response.data,
    });
  } catch (error) {
    console.error("[sendPassengerList] Error sending passenger list:", error);
    return res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
  }
};