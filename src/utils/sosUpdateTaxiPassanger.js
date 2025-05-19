// File: utils/sosUpdateTaxiPassenger.js

import axios from "axios";
import SOS from "../models/sosModel.js";
import Asset from "../models/assetModel.js";
import Passenger from "../models/Passenger.js";

export async function sosUpdateTaxiPassenger(sosId) {
  console.log(`\n[DEBUG] ==== sosUpdateTaxiPassenger START (SOS ID: ${sosId}) ====`);

  let sos;
  try {
    console.log("[DEBUG] Fetching SOS by ID...");
    sos = await SOS.findById(sosId);
    console.log("[DEBUG] SOS fetched:", JSON.stringify(sos, null, 2));
    if (!sos) throw new Error("SOS not found");
  } catch (err) {
    console.error(`[ERROR] Failed to fetch SOS ID ${sosId}:`, err);
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }

  console.log("[DEBUG] Checking for newAsset in SOS...");
  if (!sos.newAsset) {
    const msg = "SOS has no newAsset assigned";
    console.warn(`[WARN] ${msg}`);
    return { success: false, sentTo: [], failedTo: [], error: msg };
  }

  let brokenAsset, newAsset;
  try {
    console.log("[DEBUG] Fetching broken and new asset details...");
    [brokenAsset, newAsset] = await Promise.all([
      Asset.findById(sos.asset).populate("driver", "name phoneNumber vehicleNumber").lean(),
      Asset.findById(sos.newAsset).populate("driver", "name phoneNumber vehicleNumber").lean(),
    ]);
    console.log("[DEBUG] Broken Asset:", JSON.stringify(brokenAsset, null, 2));
    console.log("[DEBUG] New Asset:", JSON.stringify(newAsset, null, 2));

    if (!brokenAsset || !newAsset) throw new Error("Broken or new asset not found");
  } catch (err) {
    console.error(`[ERROR] Failed to fetch assets:`, err);
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }

  const roster = Array.isArray(brokenAsset.passengers) ? brokenAsset.passengers : [];
  console.log(`[DEBUG] Passenger roster length: ${roster.length}`);
  if (roster.length === 0) {
    console.log(`[INFO] No passengers to notify`);
    return { success: true, sentTo: [], failedTo: [] };
  }

  let passengers;
  try {
    console.log("[DEBUG] Fetching passenger details...");
    passengers = await Passenger.find({ _id: { $in: roster } })
      .select("Employee_Name Employee_PhoneNumber")
      .lean();
    console.log(`[DEBUG] Retrieved ${passengers.length} passengers:`, JSON.stringify(passengers, null, 2));
  } catch (err) {
    console.error(`[ERROR] Failed to fetch passengers:`, err);
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }

  console.log("[DEBUG] Preparing receiver list for WhatsApp message...");
  const receivers = passengers.map(p => {
    const rawPhone = p.Employee_PhoneNumber || "";
    const whatsappNumber = rawPhone.replace(/\D/g, "");

    if (!/^91\d{10}$/.test(whatsappNumber)) {
      console.warn(`[WARN] Invalid phone number format for ${p.Employee_Name}: ${rawPhone}`);
    }

    return {
      whatsappNumber,
      customParams: [
        { name: "name", value: p.Employee_Name },
        { name: "cab_number", value: brokenAsset.driver.vehicleNumber },
        { name: "new_driver_name", value: newAsset.driver.name },
        { name: "new_driver_contact", value: newAsset.driver.phoneNumber },
        { name: "new_cab_no", value: newAsset.driver.vehicleNumber },
      ],
    };
  });

  console.log(`[DEBUG] Prepared ${receivers.length} receiver(s):`, JSON.stringify(receivers, null, 2));

  let sentTo = [], failedTo = [];

  try {
    console.log("[DEBUG] Sending WhatsApp messages via WATI...");
    const response = await axios.post(
      "https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessages",
      {
        template_name: "cab_breakdown_update_passengers",
        broadcast_name: `cab_breakdown_update_passengers_${Date.now()}`,
        receivers,
      },
      {
        headers: {
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`, // Truncated for brevity
          "Content-Type": "application/json-patch+json",
        },
        timeout: 10000,
      }
    );

    console.log("[DEBUG] WATI API response:", JSON.stringify(response.data, null, 2));

    const results = response.data.results || response.data.messages || [];
    results.forEach(r => {
      if (r.status === "success") {
        sentTo.push(r.to);
      } else {
        failedTo.push(r.to);
        console.warn(`[WARN] Message to ${r.to} failed (status: ${r.status})`);
      }
    });

    console.log(`[INFO] Messages successfully sent to: ${sentTo.length}, Failed: ${failedTo.length}`);
  } catch (err) {
    console.error(`[ERROR] Failed to send WhatsApp messages:`, err.message);
    failedTo = receivers.map(r => r.whatsappNumber);
    return { success: false, sentTo: [], failedTo, error: err.message };
  }

  console.log("[DEBUG] ==== sosUpdateTaxiPassenger END ====");
  return { success: true, sentTo, failedTo };
}
