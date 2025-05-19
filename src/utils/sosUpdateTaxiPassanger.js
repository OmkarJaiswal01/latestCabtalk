// File: utils/sosUpdateTaxiPassenger.js

import axios from "axios";
import SOS from "../models/sosModel.js";
import Asset from "../models/assetModel.js";
import Passenger from "../models/Passenger.js";

export async function sosUpdateTaxiPassenger(sosId) {
  console.log(`[INFO] Starting sosUpdateTaxiPassenger for SOS ID: ${sosId}`);

  let sos;
  try {
    sos = await SOS.findById(sosId);
    if (!sos) throw new Error("SOS not found");
    console.log(`[DEBUG] Fetched SOS: ${JSON.stringify(sos, null, 2)}`);
  } catch (err) {
    console.error(`[ERROR] Failed to fetch SOS ID ${sosId}:`, err);
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }

  if (!sos.newAsset) {
    const msg = "SOS has no newAsset assigned";
    console.warn(`[WARN] ${msg}`);
    return { success: false, sentTo: [], failedTo: [], error: msg };
  }

  let brokenAsset, newAsset;
  try {
    [brokenAsset, newAsset] = await Promise.all([
      Asset.findById(sos.asset).populate("driver", "name phoneNumber vehicleNumber").lean(),
      Asset.findById(sos.newAsset).populate("driver", "name phoneNumber vehicleNumber").lean(),
    ]);
    if (!brokenAsset || !newAsset) throw new Error("Broken or new asset not found");

    console.log(`[DEBUG] Broken Asset: ${JSON.stringify(brokenAsset, null, 2)}`);
    console.log(`[DEBUG] New Asset: ${JSON.stringify(newAsset, null, 2)}`);
  } catch (err) {
    console.error(`[ERROR] Failed to fetch assets:`, err);
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }

  const roster = Array.isArray(brokenAsset.passengers) ? brokenAsset.passengers : [];
  if (roster.length === 0) {
    console.log(`[INFO] No passengers to notify`);
    return { success: true, sentTo: [], failedTo: [] };
  }

  let passengers;
  try {
    passengers = await Passenger.find({ _id: { $in: roster } })
      .select("Employee_Name Employee_PhoneNumber")
      .lean();
    console.log(`[DEBUG] Retrieved ${passengers.length} passengers`);
  } catch (err) {
    console.error(`[ERROR] Failed to fetch passengers:`, err);
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }

  const receivers = passengers.map(p => {
    const rawPhone = p.Employee_PhoneNumber || "";
    const whatsappNumber = rawPhone.replace(/\D/g, "");

    if (!/^91\d{10}$/.test(whatsappNumber)) {
      console.warn(`[WARN] Invalid phone number format: ${rawPhone}`);
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

  console.log(`[INFO] Prepared ${receivers.length} receiver(s) for WhatsApp message.`);

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
          Authorization: `Bearer ${process.env.WATI_AUTH_TOKEN}`,
          "Content-Type": "application/json-patch+json",
        },
        timeout: 10000,
      }
    );

    const results = response.data.results || response.data.messages || [];
    results.forEach(r => {
      if (r.status === "success") {
        sentTo.push(r.to);
      } else {
        failedTo.push(r.to);
        console.warn(`[WARN] Message to ${r.to} failed (status: ${r.status})`);
      }
    });

    console.log(`[INFO] Messages sent to: ${sentTo.length}, failed: ${failedTo.length}`);
  } catch (err) {
    console.error(`[ERROR] Failed to send messages:`, err.message);
    failedTo = receivers.map(r => r.whatsappNumber);
    return { success: false, sentTo: [], failedTo, error: err.message };
  }

  return { success: true, sentTo, failedTo };
}
