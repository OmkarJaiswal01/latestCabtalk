import axios from "axios";
import SOS from "../models/sosModel.js";
import Asset from "../models/assetModel.js";
import Passenger from "../models/Passenger.js";
import Taxi from "../models/TaxiModel.js";
 
const WATI_BASE = "https://live-mt-server.wati.io/388428/api/v1";
const TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0";
 
export async function sosUpdateTaxiDriver(sosId) {
  console.log(`\n[DEBUG] ==== sosUpdateTaxiDriver START (SOS ID: ${sosId}) ====`);
 
  // 1. Load SOS
  console.log("[DEBUG] Fetching SOS document...");
  const sos = await SOS.findById(sosId);
  console.log("[DEBUG] SOS result:", sos);
  if (!sos) {
    console.error(`[ERROR] SOS not found for ID: ${sosId}`);
    return { success: false, error: "SOS not found" };
  }
 
  console.log("[DEBUG] Checking for assigned asset on SOS...");
  if (!sos.asset) {
    console.error(`[ERROR] No broken asset assigned on SOS ${sosId}`);
    return { success: false, error: "No broken asset" };
  }
  console.log("[DEBUG] SOS.asset:", sos.asset);
 
  // 2. Fetch broken asset
  console.log("[DEBUG] Fetching broken Asset document...");
  const brokenAsset = await Asset.findById(sos.asset).lean();
  console.log("[DEBUG] Broken Asset result:", brokenAsset);
  if (!brokenAsset) {
    console.error("[ERROR] Broken asset not found");
    return { success: false, error: "Broken asset not found" };
  }
 
  // 3. Build passenger list
  console.log("[DEBUG] Loading passengers for broken asset...");
  const passengers = await Passenger.find({ _id: { $in: brokenAsset.passengers || [] } })
    .select("Employee_Name Employee_PhoneNumber Employee_Address")
    .lean();
  console.log("[DEBUG] Raw passengers array:", passengers);
 
  let passengerList = passengers.length
    ? passengers.map(p => `${p.Employee_Name}, ${p.Employee_PhoneNumber}, ${p.Employee_Address}`).join(" | ")
    : "No passengers listed";
  passengerList = passengerList.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  console.log("[DEBUG] Formatted passengerList:", passengerList);
 
  // 4. Get latest taxi (newAsset)
  console.log("[DEBUG] Fetching latest Taxi document...");
  const latestTaxi = await Taxi.findOne({}).sort({ createdAt: -1 }).lean();
  console.log("[DEBUG] Latest Taxi result:", latestTaxi);
  if (!latestTaxi) {
    console.error("[ERROR] No taxi records found");
    return { success: false, error: "No taxi record found" };
  }
 
  // Format and validate phone
  console.log("[DEBUG] Raw taxiDriverNumber:", latestTaxi.taxiDriverNumber);
  const rawPhone = latestTaxi.taxiDriverNumber;
  const phone = rawPhone.replace(/\D/g, "");
  console.log("[DEBUG] Stripped phone number:", phone);
  if (!/^91\d{10}$/.test(phone)) {
    console.error(`[ERROR] Invalid driver phone format: ${rawPhone}`);
    return { success: false, error: "Invalid phone number" };
  }
 
  // 5. Prepare payload
  const url = `${WATI_BASE}/sendTemplateMessage?whatsappNumber=${phone}`;
  const payload = {
    template_name: "car_break_down_update_new_rider_final",
    broadcast_name: `car_break_down_update_new_rider_final_${new Date()
      .toISOString()
      .replace(/[:.-]/g, "")}`,
    parameters: [
      { name: "new_driver_name", value: latestTaxi.taxiDriverName },
      { name: "passenger_list", value: passengerList },
    ],
  };
  console.log("[DEBUG] Prepared WATI URL:", url);
  console.log("[DEBUG] Prepared payload:", JSON.stringify(payload, null, 2));
 
  try {
    console.log("[DEBUG] Sending POST to WATI...");
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: TOKEN,
        "Content-Type": "application/json-patch+json",
      },
    });
 
    console.log("[INFO] Message sent to taxi driver:", response.data);
    return { success: true, to: phone, data: response.data };
  } catch (err) {
    console.error("[ERROR] Failed to send WhatsApp message:", err.response?.data || err.message);
    return { success: false, error: err.response?.data || err.message };
  }
}