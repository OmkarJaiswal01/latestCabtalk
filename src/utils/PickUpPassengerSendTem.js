import axios from "axios";

const WATI_BASE = "https://live-mt-server.wati.io/388428/api/v1";
const TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // Put this in .env

/**
 * Send WhatsApp pickup confirmation message to a passenger via WATI.
 * @param {string} phoneNumber - Passenger's phone number (should include country code).
 * @param {string} passengerName - Passenger's name for the message template.
 */
export async function sendPickupConfirmationMessage(phoneNumber, passengerName) {
  if (!phoneNumber || !passengerName) {
    throw new Error("phoneNumber and passengerName are required");
  }

  const cleanPhone = phoneNumber.replace(/\D/g, ""); // remove non-digit characters

  if (!/^91\d{10}$/.test(cleanPhone)) {
    throw new Error("Invalid Indian phone number format");
  }

  const url = `${WATI_BASE}/sendTemplateMessage?whatsappNumber=${cleanPhone}`;
  const payload = {
    template_name: "picked_up_passenger_update",
    broadcast_name: `picked_up_passenger_update_${Date.now()}`,
    parameters: [
      {
        name: "name",
        value: passengerName,
      },
    ],
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: TOKEN,
        "Content-Type": "application/json-patch+json",
      },
      timeout: 10000,
    });

    return {
      success: true,
      to: cleanPhone,
      data: response.data,
    };
  } catch (err) {
    console.error("WATI error:", err.response?.data || err.message);
    return {
      success: false,
      error: err.response?.data || err.message,
    };
  }
}
