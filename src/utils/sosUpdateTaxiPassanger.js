import axios from "axios";
import SOS from "../models/sosModel.js";
import Asset from "../models/assetModel.js";
import Passenger from "../models/Passenger.js";
import Taxi from "../models/TaxiModel.js";
 
export async function sosUpdateTaxiPassenger(sosId) {
  console.log(`\n[DEBUG] ==== sosUpdateTaxiPassenger START (SOS ID: ${sosId}) ====`);
 
  let sos;
  try {
    sos = await SOS.findById(sosId);
    if (!sos) throw new Error("SOS not found");
  } catch (err) {
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }
 
  let brokenAsset;
  try {
    brokenAsset = await Asset.findById(sos.asset).populate("driver", "name phoneNumber vehicleNumber");
    if (!brokenAsset) throw new Error("Broken asset not found");
  } catch (err) {
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }
 
  // ✅ Find the new Taxi from the Taxi collection — example: latest added taxi
  let taxi;
  try {
    taxi = await Taxi.findOne().sort({ createdAt: -1 }).lean(); // adjust logic as needed
    if (!taxi) throw new Error("No replacement taxi found in the database");
  } catch (err) {
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }
 
  const roster = Array.isArray(brokenAsset.passengers) ? brokenAsset.passengers : [];
  if (roster.length === 0) {
    return { success: true, sentTo: [], failedTo: [] };
  }
 
  let passengers;
  try {
    passengers = await Passenger.find({ _id: { $in: roster } }).select("Employee_Name Employee_PhoneNumber").lean();
  } catch (err) {
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }
 
  const receivers = passengers.map(p => {
    const rawPhone = p.Employee_PhoneNumber || "";
    const whatsappNumber = rawPhone.replace(/\D/g, "");
 
    return {
      whatsappNumber,
      customParams: [
        { name: "name", value: p.Employee_Name },
        { name: "cab_number", value: brokenAsset.driver?.vehicleNumber || "N/A" },
        { name: "new_driver_name", value: taxi.taxiDriverName || "N/A" },
        { name: "new_driver_contact", value: taxi.taxiDriverNumber || "N/A" },
        { name: "new_cab_no", value: taxi.taxiVehicleNumber || "N/A" },
      ],
    };
  });
 
  let sentTo = [], failedTo = [];
 
  try {
    const response = await axios.post(
      "https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessages",
      {
        template_name: "cab_breakdown_update_passengers",
        broadcast_name: `cab_breakdown_update_passengers_${Date.now()}`,
        receivers,
      },
      {
        headers: {
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`, // replace with secure token
          "Content-Type": "application/json-patch+json",
        },
        timeout: 10000,
      }
    );
 
    const results = response.data.results || response.data.messages || [];
    results.forEach(r => {
      (r.status === "success" ? sentTo : failedTo).push(r.to);
    });
  } catch (err) {
    failedTo = receivers.map(r => r.whatsappNumber);
    return { success: false, sentTo: [], failedTo, error: err.message };
  }
 
  return { success: true, sentTo, failedTo };
}