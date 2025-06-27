export const sendDropConfirmationMessage = async (phoneNumber, name) => {
  try {
    const cleanedPhone = phoneNumber.replace(/\D/g, "");
    const url = `https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage?whatsappNumber=${cleanedPhone}`;

    const options = {
      method: "POST",
      headers: {
        "content-type": "application/json-patch+json",
        Authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZmE0YTlhYS05MTVmLTQxYzktYmE5Yi00YjA2ZjZhZWM4ZDkiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDQvMDcvMjAyNSAxMDozOTowMCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOlsiQlJPQURDQVNUX01BTkFHRVIiLCJURU1QTEFURV9NQU5BR0VSIiwiQ09OVEFDVF9NQU5BR0VSIiwiT1BFUkFUT1IiLCJERVZFTE9QRVIiLCJBVVRPTUFUSU9OX01BTkFHRVIiXSwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.WSekNHf4C3RXr7_0gI23V5oD2BwFuUvfcyIeKjBs5Ug",
      },
      body: JSON.stringify({
        broadcast_name: `drop_confirmation_passenger_${Date.now()}`,
        template_name: "drop_confirmation_passenger",
        parameters: [
          {
            name: "name",
            value: name,
          },
        ],
      }),
    };

    const response = await fetch(url, options);
    const result = await response.json();

    if (response.ok) {
      return { success: true, data: result };
    } else {
      return { success: false, error: result };
    }
  } catch (error) {
    console.error("WATI Drop Confirmation Error:", error);
    return { success: false, error: error.message };
  }
};
