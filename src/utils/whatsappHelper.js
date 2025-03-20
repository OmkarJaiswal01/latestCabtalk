import axios from "axios";
export const sendWhatsAppMessage = async (phoneNumber, message) => {
  try {
    const response = await axios.post(
      `${process.env.WATI_API_URL}/api/v1/sendSessionMessage/${phoneNumber}`,
      {},
      {
        params: { messageText: message },
        headers: {
          Authorization: `Bearer ${process.env.WATI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error sending WhatsApp message:",
      error.response?.data || error.message
    );
    return null;
  }
};