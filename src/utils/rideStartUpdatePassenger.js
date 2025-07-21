

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
    const shiftGroup = asset.passengers.find(
      (group) => group.shift === Journey_shift
    );

    if (!shiftGroup || shiftGroup.passengers.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No passengers found for shift "${Journey_shift}".`,
      });
    }

    for (const entry of shiftGroup.passengers) {
      const passenger = entry.passenger;
      if (passenger && passenger.Employee_PhoneNumber) {
        const phone = passenger.Employee_PhoneNumber.replace(/\D/g, "");
        try {
          await axios.post(
            `https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage?whatsappNumber=${phone}`,
            {
              broadcast_name: `ride_started_update_passenger_${Date.now()}`,
              template_name: "ride_started_update_passengers",
              parameters: [
                { name: "name", value: passenger.Employee_Name || "Passenger" },
              ],
            },
            {
              headers: {
                "content-type": "application/json-patch+json",
                Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YmM2MmFkNC04NTQ3LTRkYzItOTc0Ni0wNmRkMjZiODYzNmMiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDYvMzAvMjAyNSAwNzozNzoxNSIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.dr6x_b4olu0EL6oJcEENiD2nMYrlQx5MWlQTJBttcqg`,
              },
            }
          );
        } catch (err) {
          console.error(`Failed to send WhatsApp message to ${phone}:`, err?.response?.data || err.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Passengers for shift "${Journey_shift}" have been notified.`,
      passengerCount: shiftGroup.passengers.length,
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

