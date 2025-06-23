// utils/sendShiftPassengerUpdateMessage.js


export const sendOtherPassengerSameShiftUpdateMessage = async (phoneNumber, pickedPassengerName) => {
  const url = `https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage?whatsappNumber=${phoneNumber}`;

  const options = {
    method: 'POST',
    headers: {
      'content-type': 'application/json-patch+json',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiZmE0YTlhYS05MTVmLTQxYzktYmE5Yi00YjA2ZjZhZWM4ZDkiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDQvMDcvMjAyNSAxMDozOTowMCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOlsiQlJPQURDQVNUX01BTkFHRVIiLCJURU1QTEFURV9NQU5BR0VSIiwiQ09OVEFDVF9NQU5BR0VSIiwiT1BFUkFUT1IiLCJERVZFTE9QRVIiLCJBVVRPTUFUSU9OX01BTkFHRVIiXSwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.WSekNHf4C3RXr7_0gI23V5oD2BwFuUvfcyIeKjBs5Ug'
    },
    body: JSON.stringify({
      broadcast_name: "unboarded_passenger_update_" + Date.now(),
      template_name: "unboarded_passenger_update",
      parameters: [
        {
          name: "name",
          value: pickedPassengerName
        }
      ]
    })
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { success: true, to: phoneNumber, data };
  } catch (error) {
    console.error("WATI API error:", error);
    return { success: false, error: error.message };
  }
};
