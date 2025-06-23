//import fetch from "node-fetch"; // Ensure this is installed if using CommonJS or ESM

const WATI_API_URL = "https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage";
const WATI_AUTH_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZmE0YTlhYS05MTVmLTQxYzktYmE5Yi00YjA2ZjZhZWM4ZDkiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDQvMDcvMjAyNSAxMDozOTowMCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOlsiQlJPQURDQVNUX01BTkFHRVIiLCJURU1QTEFURV9NQU5BR0VSIiwiQ09OVEFDVF9NQU5BR0VSIiwiT1BFUkFUT1IiLCJERVZFTE9QRVIiLCJBVVRPTUFUSU9OX01BTkFHRVIiXSwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.WSekNHf4C3RXr7_0gI23V5oD2BwFuUvfcyIeKjBs5Ug"; // Replace with secure token in env

/**
 * Sends a WhatsApp pickup confirmation message via WATI
 * @param {string} phoneNumber - Passenger's phone number (with country code)
 * @param {string} passengerName - Name of the picked passenger
 */
export const sendPickupConfirmationMessage = async (phoneNumber, passengerName) => {
  const url = `${WATI_API_URL}?whatsappNumber=${phoneNumber}`;

  const payload = {
    parameters: [
      {
        name: "name",
        value: passengerName,
      },
    ],
    broadcast_name: `picked_up_passenger_update_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`,
    template_name: "picked_up_passenger_update",
  };

  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json-patch+json",
      Authorization: WATI_AUTH_TOKEN,
    },
    body: JSON.stringify(payload),
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error("WATI API error:", data);
      throw new Error(data.message || "Failed to send confirmation");
    }

    return data;
  } catch (err) {
    console.error("Pickup confirmation error:", err.message);
    throw err;
  }
};
