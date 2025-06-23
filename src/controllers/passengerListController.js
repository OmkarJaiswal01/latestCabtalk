import axios from "axios";
import Driver from "../models/driverModel.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";

function formatTitle(name, phoneNumber) {
  const MAX = 24;
  const SEP = " 📞 ";
  let title = `${name}${SEP}${phoneNumber}`;

  const overflow = title.length - MAX;
  if (overflow > 0) {
    const truncatedName = name.slice(0, name.length - overflow);
    title = `${truncatedName}${SEP}${phoneNumber}`;
  }
  return title;
}

export const sendPassengerList = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      console.error("Phone number is missing in the request body.");
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    const driver = await Driver.findOne({ phoneNumber });
    if (!driver) {
      console.error("Driver not found for phone number:", phoneNumber);
      return res.status(404).json({
        success: false,
        message: "Driver not found.",
      });
    }

    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber Employee_Address",
    });
    if (!asset) {
      console.error("No asset assigned to driver:", driver._id);
      return res.status(404).json({
        success: false,
        message: "No asset assigned to this driver.",
      });
    }

    const journey = await Journey.findOne({ Driver: driver._id });
    const boardedIds = journey
      ? journey.boardedPassengers.map((evt) =>
          typeof evt.passenger === "object"
            ? evt.passenger._id.toString()
            : evt.passenger.toString()
        )
      : [];

    // const remainingPassengers = asset.passengers.filter(
    //   (p) => !boardedIds.includes(p._id.toString())
    // );

    const allPassengers = asset.passengers.flatMap((shift) =>
      shift.passengers.map((ps) => ps.passenger)
    );

    const remainingPassengers = allPassengers.filter((p) => {
      const pid = typeof p === "object" ? p._id.toString() : p.toString();
      return !boardedIds.includes(pid);
    });

    let passengers = remainingPassengers.map((p) => {
      const title = formatTitle(p.Employee_Name, p.Employee_PhoneNumber);
      const description = `📍 ${p.Employee_Address}`.slice(0, 72);
      return { title, description };
    });

    if (passengers.length === 0) {
      console.warn("No passengers found. Adding default message.");
      passengers.push({
        title: "No Passengers Assigned",
        description:
          "No passengers are currently assigned or available in your vehicle.",
      });
    }

    const vehicleNumber = driver.vehicleNumber || "Unknown Vehicle";
    const watiPayload = {
      header: "Ride Details",
      body: `Passenger list for (${vehicleNumber}):`,
      footer: "CabTalk",
      buttonText: "Menu",
      sections: [{ title: "Passenger Details", rows: passengers }],
    };

    const watiApiUrl = `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`;
    const response = await axios.post(watiApiUrl, watiPayload, {
      headers: {
        Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`,
        "Content-Type": "application/json-patch+json",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Passenger list sent successfully via WhatsApp.",
      data: response.data,
    });
  } catch (error) {
    console.error("Error sending passenger list:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};