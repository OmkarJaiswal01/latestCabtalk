// utils/notificationScheduler.js
const WATI_URL = "https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessages";
const WATI_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0"
if (!WATI_TOKEN) {
  console.warn("WATI TOken error");
}
 
function buildFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || name || "";
}
 
async function postTemplate(payload) {
  const res = await fetch(WATI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json-patch+json",
      Authorization: `Bearer ${WATI_TOKEN}`
    },
    body: JSON.stringify(payload)
  });
 
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`WATI API ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
 
export async function sendPickupTemplateBefore10Min(phoneNumber, name) {
  const firstName = buildFirstName(name);
  const payload = {
    template_name: "pick_up_passenger_notification_before_10_minutes__",
    broadcast_name: `pick_up_passenger_notification_before_10_minutes__${Date.now()}`,
    receivers: [
      {
        whatsappNumber: phoneNumber,
        customParams: [{ name: "name", value: firstName }]
      }
    ]
  };
  return postTemplate(payload);
}
 
export async function sendBufferEndTemplate(phoneNumber, name) {
  const firstName = buildFirstName(name);
  const payload = {
    template_name: "update_passenger_move_cab",
    broadcast_name: `update_passenger_move_cab_${Date.now()}`,
    receivers: [
      {
        whatsappNumber: phoneNumber.replace(/\D/g, ""),
        customParams: [{ name: "name", value: firstName }]
      }
    ]
  };
  return postTemplate(payload);
}
 
 