import mongoose from "mongoose";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import axios from "axios";

export const startRideUpdatePassengerController = async (req, res) => {
  try {
    const { vehicleNumber, Journey_shift } = req.body;

    if (!vehicleNumber || !Journey_shift) {
      return res.status(400).json({
        success: false,
        message: "vehicleNumber and Journey_shift are required.",
      });
    }

    // Helpers
    const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = WEEK_DAYS[new Date().getDay()]; // server local day; change to getUTCDay() if you store times in UTC

    const normalizeDay = (d) => {
      if (d == null) return null;
      const k = String(d).trim().toLowerCase().slice(0, 3); // e.g. 'thu' from 'Thursday'
      const map = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
      return map[k] || null;
    };

    const driver = await Driver.findOne({ vehicleNumber });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found for this vehicle number.",
      });
    }

    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber",
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "No asset assigned to this driver.",
      });
    }

    // Match passengers of the given shift
    const shiftGroup = asset.passengers.find((group) => group.shift === Journey_shift);

    if (!shiftGroup || !Array.isArray(shiftGroup.passengers) || shiftGroup.passengers.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No passengers found for shift "${Journey_shift}".`,
        passengerCount: 0,
      });
    }

    // Filter to ONLY passengers scheduled today via wfoDays
    const toNotify = [];
    for (const entry of shiftGroup.passengers) {
      const passenger = entry?.passenger;

      if (!passenger) {
        console.log("⏭️ Skipping: empty passenger slot");
        continue;
      }

      // Normalize wfoDays to ["Sun","Mon",...]
      const normalizedDays = Array.isArray(entry?.wfoDays)
        ? entry.wfoDays
            .map(normalizeDay)
            .filter(Boolean)
        : [];

      if (!normalizedDays.includes(today)) {
        console.log(
          `⛔ Not scheduled today (${today}) — skipping ${passenger.Employee_Name}`
        );
        continue;
      }

      // Phone sanity
      const phone = String(passenger.Employee_PhoneNumber || "").replace(/\D/g, "");
      if (!phone || phone.length < 10) {
        console.log(`⚠️ Invalid/missing phone, skipping ${passenger.Employee_Name}: "${passenger.Employee_PhoneNumber}"`);
        continue;
      }

      toNotify.push({ name: passenger.Employee_Name || "Passenger", phone });
    }

    // If no one scheduled today, do not send anything
    if (toNotify.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No passengers scheduled today (${today}) for shift "${Journey_shift}".`,
        passengerCount: 0,
      });
    }

    // Send WhatsApp template to only today's scheduled passengers
    let sent = 0;
    for (const p of toNotify) {
      try {
        await axios.post(
          `https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage?whatsappNumber=${p.phone}`,
          {
            broadcast_name: `ride_started_update_passenger_${Date.now()}`,
            template_name: "ride_started_update_passengers",
            parameters: [{ name: "name", value: p.name }],
          },
          {
            headers: {
              "content-type": "application/json-patch+json",
              Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YmM2MmFkNC04NTQ3LTRkYzItOTc0Ni0wNmRkMjZiODYzNmMiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDYvMzAvMjAyNSAwNzozNzoxNSIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.dr6x_b4olu0EL6oJcEENiD2nMYrlQx5MWlQTJBttcqg`,
            },
          }
        );
        sent += 1;
        console.log(`✅ Ride started message sent to ${p.name} (${p.phone})`);
      } catch (err) {
        console.error(
          `❌ Failed to send WhatsApp message to ${p.phone}:`,
          err?.response?.data || err.message
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `Ride started: notified ${sent} passenger(s) scheduled for today (${today}) in shift "${Journey_shift}".`,
      passengerCount: sent,
    });
  } catch (error) {
    console.error("startRideUpdatePassengerController error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};
