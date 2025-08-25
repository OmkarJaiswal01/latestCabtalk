// utils/rideStartUpdatePassenger.js
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import axios from "axios";
import { isScheduledToday } from "./weekoffPassengerHelper.js"; // use the shared helper

export const startRideUpdatePassengerController = async (req, res) => {
  try {
    const { vehicleNumber, Journey_shift } = req.body;

    if (!vehicleNumber || !Journey_shift) {
      return res.status(400).json({
        success: false,
        message: "vehicleNumber and Journey_shift are required.",
      });
    }

    // 🔎 find driver by vehicle number
    const driver = await Driver.findOne({ vehicleNumber });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found for this vehicle number.",
      });
    }

    // 🔎 find asset with passengers populated (include passenger.wfoDays)
    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber wfoDays",
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "No asset assigned to this driver.",
      });
    }

    // 🎯 pick the correct shift group
    const shiftGroup = asset.passengers.find(
      (group) => group.shift === Journey_shift
    );

    if (!shiftGroup || shiftGroup.passengers.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No passengers found for shift "${Journey_shift}".`,
      });
    }

    let notifiedCount = 0;
    let skippedCount = 0;

    for (const entry of shiftGroup.passengers) {
      const passenger = entry.passenger;
      if (!passenger || !passenger.Employee_PhoneNumber) {
        console.log("⚠️ Skipped entry – missing passenger or phone number.");
        skippedCount++;
        continue;
      }

      // Prefer entry-level wfoDays if set (assignment-level), otherwise fallback to passenger doc's wfoDays
      const effectiveWfoDays = Array.isArray(entry.wfoDays) && entry.wfoDays.length ? entry.wfoDays : passenger.wfoDays;

      // ✅ check if scheduled today using helper
      if (!isScheduledToday(effectiveWfoDays)) {
        console.log(
          `⏭️ Skipped passenger ${passenger.Employee_Name} (${passenger.Employee_PhoneNumber}) - not scheduled today.`
        );
        skippedCount++;
        continue;
      }

      // format phone + name
      const phone = (passenger.Employee_PhoneNumber || "").replace(/\D/g, "");
      const rawName = passenger.Employee_Name || "Passenger";
      const [firstRaw] = String(rawName).trim().split(/\s+/);
      const firstName = firstRaw || rawName;

      try {
        await axios.post(
          `https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage?whatsappNumber=${phone}`,
          {
            broadcast_name: `ride_started_update_passenger_${Date.now()}`,
            template_name: "ride_started_update_passengers",
            parameters: [{ name: "name", value: firstName }],
          },
          {
            headers: {
              "content-type": "application/json-patch+json",
              Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YmM2MmFkNC04NTQ3LTRkYzItOTc0Ni0wNmRkMjZiODYzNmMiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDYvMzAvMjAyNSAwNzozNzoxNSIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.dr6x_b4olu0EL6oJcEENiD2nMYrlQx5MWlQTJBttcqg`,
            },
          }
        );
        console.log(`✅ Notified passenger ${passenger.Employee_Name} (${phone})`);
        notifiedCount++;
      } catch (err) {
        console.error(
          `❌ Failed to send WhatsApp message to ${phone}:`,
          err?.response?.data || err.message
        );
        skippedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Passengers for shift "${Journey_shift}" checked. Only scheduled passengers notified.`,
      notifiedCount,
      skippedCount,
    });
  } catch (error) {
    console.error("🚨 Error in startRideUpdatePassengerController:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};
