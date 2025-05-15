import axios from "axios";
import SOS from "../models/sosModel.js";
import Asset from "../models/assetModel.js";
import Passenger from "../models/Passenger.js";

const WATI_BASE = "https://live-mt-server.wati.io/388428/api/v1";
const TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0";

export async function sosUpdateDriver(sosId) {
  console.log(`\n[DEBUG] ==== sosUpdateDriver START (SOS ID: ${sosId}) ====`);

  // 1. Load SOS
  console.log("[DEBUG] Fetching SOS document...");
  const sos = await SOS.findById(sosId);
  console.log("[DEBUG] SOS:", sos);
  if (!sos) {
    console.error(`[ERROR] SOS not found for ID: ${sosId}`);
    return { success: false, error: "SOS not found" };
  }
  if (!sos.newAsset) {
    console.error(`[ERROR] No newAsset assigned on SOS ${sosId}`);
    return { success: false, error: "No newAsset assigned" };
  }

  // 2. Fetch assets
  console.log("[DEBUG] Fetching brokenAsset & newAsset...");
  const [brokenAsset, newAsset] = await Promise.all([
    Asset.findById(sos.asset).lean(),
    Asset.findById(sos.newAsset)
      .populate("driver", "name phoneNumber vehicleNumber")
      .lean(),
  ]);
  console.log("[DEBUG] brokenAsset:", brokenAsset);
  console.log("[DEBUG] newAsset:", newAsset);

  if (!brokenAsset || !newAsset?.driver) {
    console.error("[ERROR] Asset lookup failed");
    return { success: false, error: "Asset lookup failed" };
  }

  // 3. Build passenger list
  console.log("[DEBUG] Fetching Passenger docs for transfer list...");
  const passengers = await Passenger.find({ _id: { $in: brokenAsset.passengers || [] } })
    .select("Employee_Name Employee_PhoneNumber Employee_Address")
    .lean();

  // join with a flat separator, no newlines
  let passengerList = passengers.length
    ? passengers
        .map(p =>
          `${p.Employee_Name}, ${p.Employee_PhoneNumber}, ${p.Employee_Address}`
        )
        .join(" | ")
    : "No passengers listed";

  // strip any stray newlines/tabs & collapse multi‑spaces
  passengerList = passengerList
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  console.log("[DEBUG] Sanitized passengerList:", passengerList);

  // 4. Clean & validate driver phone
  const rawPhone = newAsset.driver.phoneNumber;
  console.log("[DEBUG] Raw new driver phone:", rawPhone);
  const phone = rawPhone.replace(/\D/g, "");
  console.log("[DEBUG] Cleaned new driver phone:", phone);
  if (!/^91\d{10}$/.test(phone)) {
    console.error(`[ERROR] Invalid driver phone format: ${rawPhone}`);
    return { success: false, error: "Invalid driver phone number" };
  }

  // 5. Prepare URL & payload
  const url = `${WATI_BASE}/sendTemplateMessage?whatsappNumber=${phone}`;
  const payload = {
    template_name: "car_break_down_update_new_rider_final",               // ← replace with your actual template name
    broadcast_name: `car_break_down_update_new_rider_final_050520251532`, // ← generate or match your broadcast name
    parameters: [
      { name: "new_driver_name", value: newAsset.driver.name },
      { name: "passenger_list",   value: passengerList },
    ],
  };

  console.log("[DEBUG] URL:", url);
  console.log("[DEBUG] Payload:", JSON.stringify(payload, null, 2));

  // 6. Send request
  try {
    console.log("[DEBUG] Sending POST …");
    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: TOKEN,
        "Content-Type": "application/json-patch+json",
      },
      timeout: 10000,
    });
    console.log("[INFO] Driver notify HTTP status:", resp.status);
    console.log("[DEBUG] Response data:", JSON.stringify(resp.data, null, 2));
    console.log("[DEBUG] ==== sosUpdateDriver END ====\n");
    return { success: true, to: phone, data: resp.data };
  } catch (err) {
    console.error(
      "[ERROR] Axios error sending driver msg:",
      err.response?.data || err.message
    );
    return { success: false, error: err.response?.data || err.message };
  }
}