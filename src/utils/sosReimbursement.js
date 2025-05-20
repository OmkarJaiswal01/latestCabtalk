import axios from "axios";
import SOS from "../models/sosModel.js";
import Asset from "../models/assetModel.js";
import Passenger from "../models/Passenger.js";

export async function sosReimbursement(sosId) {
  const sos = await SOS.findById(sosId);
  if (!sos) {
    console.error(`[ERROR] SOS not found for ID: ${sosId}`);
    return { success: false, sentTo: [], failedTo: [], error: "SOS not found" };
  }
  const brokenAsset = await Asset.findById(sos.asset).populate("driver", "vehicleNumber").lean();
  if (!brokenAsset) {
    console.error(`[ERROR] Broken asset not found: ${sos.asset}`);
    return { success: false, sentTo: [], failedTo: [], error: "Asset not found" };
  }
  const roster = Array.isArray(brokenAsset.passengers) ? brokenAsset.passengers : [];
  if (roster.length === 0) {
    return { success: true, sentTo: [], failedTo: [] };
  }
  const passengers = await Passenger.find({ _id: { $in: roster } }).select("Employee_Name Employee_PhoneNumber").lean();
  const receivers = passengers.map((p) => {
    const cleaned = p.Employee_PhoneNumber.replace(/\D/g, "");
    return {
      whatsappNumber: cleaned,
      customParams: [
        { name: "name", value: p.Employee_Name },
        { name: "cab_number", value: brokenAsset.driver?.vehicleNumber || "" },
      ],
    };
  });
  const sentTo = [];
  const failedTo = [];
  try {
    const resp = await axios({
      method: "POST",
      url: "https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessages",
      headers: {
        Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`,
        "Content-Type": "application/json-patch+json",
    },
      data: {
        broadcast_name: `cab_breakdown_reimbursement_080520251845`,
        template_name: "cab_breakdown_reimbursement",
        receivers
      },
      timeout: 10000,
    });
    const results = resp.data.results || resp.data.messages || [];
    results.forEach((r) => {
      if (r.status === "success") sentTo.push(r.to);
      else failedTo.push(r.to);
    });
  } catch (err) {
    console.error(`[ERROR] WATI send failure: ${err.message}`, err.response?.data);
    failedTo.push(...receivers.map((r) => r.whatsappNumber));
    return { success: false, sentTo: [], failedTo, error: err.message };
  }
  return { success: true, sentTo, failedTo };
}