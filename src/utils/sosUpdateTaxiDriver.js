import axios from "axios";
import Asset from "../models/assetModel.js";

export const sosUpdateTaxiDriver = async (newAssetId, brokenAssetId) => {
  try {
    const [newAsset, oldAsset] = await Promise.all([
      Asset.findById(newAssetId)
        .populate("driver", "taxiDriverName taxiDriverNumber taxiVehicleNumber")
        .populate("passengers", "Employee_Name phoneNumber")
        .lean(),
      Asset.findById(brokenAssetId).lean(),
    ]);

    if (!newAsset || !newAsset.driver) {
      return { success: false, error: "New asset or driver not found." };
    }

    const driverPhone = newAsset.driver.taxiDriverNumber.replace(/\D/g, "");
    const passengerNames = newAsset.passengers.map(p => p.Employee_Name).join(", ");
    const oldCabNumber = oldAsset?.taxiVehicleNumber || "OldCabUnknown";

    const DRIVER_TEMPLATE = {
      broadcast_name: `driver_update_${Date.now()}`,
      template_name: "driver_cab_assignment_update",
      receivers: [
        {
          whatsappNumber: `91${driverPhone}`,
          customParams: [
            { name: "name", value: newAsset.driver.taxiDriverName },
            { name: "vehicle_number", value: newAsset.driver.taxiVehicleNumber },
            { name: "passenger_list", value: passengerNames || "None" },
          ],
        },
      ],
    };

    const PASSENGER_TEMPLATE = {
      broadcast_name: `cab_breakdown_update_passengers_${Date.now()}`,
      template_name: "cab_breakdown_update_passengers",
      receivers: newAsset.passengers.map((passenger) => ({
        whatsappNumber: `91${passenger.phoneNumber.replace(/\D/g, "")}`,
        customParams: [
          { name: "name", value: passenger.Employee_Name },
          { name: "cab_number", value: oldCabNumber },
          { name: "new_driver_name", value: newAsset.driver.taxiDriverName },
          { name: "new_driver_contact", value: newAsset.driver.taxiDriverNumber },
          { name: "new_cab_no", value: newAsset.driver.taxiVehicleNumber },
        ],
      })),
    };

    const headers = {
      Authorization: `Bearer Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZmE0YTlhYS05MTVmLTQxYzktYmE5Yi00YjA2ZjZhZWM4ZDkiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDQvMDcvMjAyNSAxMDozOTowMCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOlsiQlJPQURDQVNUX01BTkFHRVIiLCJURU1QTEFURV9NQU5BR0VSIiwiQ09OVEFDVF9NQU5BR0VSIiwiT1BFUkFUT1IiLCJERVZFTE9QRVIiLCJBVVRPTUFUSU9OX01BTkFHRVIiXSwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.WSekNHf4C3RXr7_0gI23V5oD2BwFuUvfcyIeKjBs5Ug`,
      "Content-Type": "application/json-patch+json",
    };

    const [driverRes, passengerRes] = await Promise.all([
      axios.post("https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage", DRIVER_TEMPLATE, { headers }),
      axios.post("https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessages", PASSENGER_TEMPLATE, { headers }),
    ]);

    return {
      success: true,
      driverResponse: driverRes.data,
      passengerResponse: passengerRes.data,
    };

  } catch (err) {
    console.error("[ERROR] Failed to notify:", err.message);
    return { success: false, error: err.message };
  }
};
