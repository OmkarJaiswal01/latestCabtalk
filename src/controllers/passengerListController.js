import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import axios from "axios";

export const sendPassengerList = async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        console.error("Phone number is missing in the request body.");
        return res.status(400).json({ success: false, message: "Phone number is required." });
      }
      const driver = await Driver.findOne({ phoneNumber });
      if (!driver) {
        console.error("Driver not found for phone number:", phoneNumber);
        return res.status(404).json({ success: false, message: "Driver not found." });
      }
      const asset = await Asset.findOne({ driver: driver._id })
        .populate("passengers", "Employee_Name Employee_PhoneNumber Employee_Address");
      if (!asset) {
        console.error("No asset assigned to driver:", driver._id);
        return res.status(404).json({ success: false, message: "No asset assigned to this driver." });
      }
      const driverName = driver.name || "Driver";
      const vehicleNumber = driver.vehicleNumber || "Unknown Vehicle";
      const passengers = asset.passengers.map((p) => {
        const firstName = p.Employee_Name.split(" ")[0];
        const address = `📍 ${p.Employee_Address}`.slice(0, 72);
        return {
          title: `${firstName} 📞 ${p.Employee_PhoneNumber}`,
          description: address,
        };
      });
  
      if (passengers.length === 0) {
        console.warn("No passengers found. Adding default message.");
        passengers.push({
          title: "No Passengers Assigned",
          description: "No passengers are currently assigned to your vehicle.",
        });
      }
      const watiPayload = {
        header: "Ride Details",
        body: `Passenger list for (${vehicleNumber}):`,
        footer: "CabTalk",
        buttonText: "Menu",
        sections: [
          { title: "Passenger Details", rows: passengers, }, 
        ], };
      const watiApiUrl = `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`;
      const response = await axios.post(watiApiUrl, watiPayload, {
        headers: {
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`,
          "Content-Type": "application/json-patch+json",
        },});
      return res.status(200).json({
        success: true, message: "Passenger list sent successfully via WhatsApp.", data: response.data,
      });
    } catch (error) {
      console.error("Error sending passenger list:", error);
      return res.status(500).json({
        success: false, message: "Internal server error.", error: error.message,
      });
    }};