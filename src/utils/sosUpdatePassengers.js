import axios from "axios";
import SOS from "../models/sosModel.js";
import Asset from "../models/assetModel.js";
import Passenger from "../models/Passenger.js";

export async function sosUpdatePassengers(sosId) {
  console.log(`[INFO] Starting sosUpdatePassengers for SOS ID: ${sosId}`);

  let sos;
  try {
    sos = await SOS.findById(sosId);
    console.log(`[DEBUG] Fetched SOS: ${JSON.stringify(sos, null, 2)}`);
  } catch (err) {
    console.error(`[ERROR] Error fetching SOS by ID ${sosId}:`, err);
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }

  if (!sos) {
    console.error(`[ERROR] SOS not found for ID: ${sosId}`);
    return { success: false, sentTo: [], failedTo: [], error: "SOS not found" };
  }
  if (!sos.newAsset) {
    console.warn(`[WARN] SOS ${sosId} has no newAsset assigned`);
    return {
      success: false,
      sentTo: [],
      failedTo: [],
      error: "SOS has no newAsset assigned",
    };
  }

  console.log(`[INFO] Fetching assets – brokenAsset: ${sos.asset}, newAsset: ${sos.newAsset}`);
  let brokenAsset, newAsset;
  try {
    [brokenAsset, newAsset] = await Promise.all([
      Asset.findById(sos.asset).populate("driver", "name phoneNumber vehicleNumber").lean(),
      Asset.findById(sos.newAsset).populate("driver", "name phoneNumber vehicleNumber").lean(),
    ]);
    console.log(`[DEBUG] Broken Asset: ${JSON.stringify(brokenAsset, null, 2)}`);
    console.log(`[DEBUG] New Asset: ${JSON.stringify(newAsset, null, 2)}`);
  } catch (err) {
    console.error(`[ERROR] Error fetching assets:`, err);
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }

  if (!brokenAsset || !newAsset) {
    console.error(`[ERROR] Either brokenAsset or newAsset not found`);
    return {
      success: false,
      sentTo: [],
      failedTo: [],
      error: "Broken or new asset not found",
    };
  }

  const roster = Array.isArray(brokenAsset.passengers) ? brokenAsset.passengers : [];
  console.log(`[INFO] Number of passengers to notify: ${roster.length}`);
  if (roster.length === 0) {
    console.log(`[INFO] No passengers found in the broken asset`);
    return { success: true, sentTo: [], failedTo: [] };
  }

  let passengers;
  try {
    passengers = await Passenger.find({ _id: { $in: roster } })
      .select("Employee_Name Employee_PhoneNumber")
      .lean();
    console.log(`[DEBUG] Retrieved passenger details: ${JSON.stringify(passengers, null, 2)}`);
  } catch (err) {
    console.error(`[ERROR] Failed to fetch passengers:`, err);
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }

  const receivers = passengers.map(p => {
    const cleaned = p.Employee_PhoneNumber.replace(/\D/g, "");
    if (!/^91\d{10}$/.test(cleaned)) {
      console.warn(`[WARN] Invalid India phone number: ${cleaned} (from ${p.Employee_PhoneNumber})`);
    }
    return {
      whatsappNumber: cleaned,
      customParams: [
        { name: "name", value: p.Employee_Name },
        { name: "cab_number", value: brokenAsset.driver.vehicleNumber },
        { name: "new_driver_name", value: newAsset.driver.name },
        { name: "new_driver_contact", value: newAsset.driver.phoneNumber },
        { name: "new_cab_no", value: newAsset.driver.vehicleNumber },
      ],
    };
  });
  console.log("[DEBUG] Compiled receivers list:", JSON.stringify(receivers, null, 2));

  let sentTo = [], failedTo = [];
  try {
    console.log("[INFO] Sending messages via WATI API...");
    const response = await axios({
      method: "POST",
      url: "https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessages",
      headers: {
        Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`,
        "Content-Type": "application/json-patch+json",
      },
      data: {
        broadcast_name: `cab_breakdown_update_passengers_210420251332`,
        template_name: "cab_breakdown_update_passengers",
        receivers,
      },
      timeout: 10000,
    });

    console.log("[DEBUG] WATI response:", JSON.stringify(response.data, null, 2));
    const results = response.data.results || response.data.messages || [];
    results.forEach(r => {
      if (r.status === "success") {
        sentTo.push(r.to);
      } else {
        failedTo.push(r.to);
        console.warn(`[WARN] Message to ${r.to} failed with status: ${r.status}`);
      }
    });
    console.log(`[INFO] Messages sent successfully to: ${sentTo.join(", ")}`);
    console.log(`[INFO] Messages failed for: ${failedTo.join(", ")}`);
  } catch (err) {
    console.error(`[ERROR] Failed sending messages: ${err.message}`, err);
    failedTo = receivers.map(r => r.whatsappNumber);
    return { success: false, sentTo: [], failedTo, error: err.message };
  }
  return { success: true, sentTo, failedTo };
}