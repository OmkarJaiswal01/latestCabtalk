// export const sendPickupTemplateBefore10Min = async (phoneNumber, name, templateName, broadcastName) => {
//   const url = 'https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessages';

//   const payload = {
//     receivers: [
//       {
//         customParams: [
//           {
//             name: 'name',
//             value: name
//           }
//         ],
//         whatsappNumber: phoneNumber 
//       }
//     ],
//     template_name: templateName,
//     broadcast_name: broadcastName
//   };

//   const options = {
//     method: 'POST',
//     headers: {
//       'content-type': 'application/json-patch+json',
//       Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YmM2MmFkNC04NTQ3LTRkYzItOTc0Ni0wNmRkMjZiODYzNmMiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDYvMzAvMjAyNSAwNzozNzoxNSIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.dr6x_b4olu0EL6oJcEENiD2nMYrlQx5MWlQTJBttcqg'
//     },
//     body: JSON.stringify(payload)
//   };

//   try {
//     const res = await fetch(url, options);
//     const data = await res.json();
//     return data;
//   } catch (err) {
//     console.error('Error sending WhatsApp template:', err);
//     throw err;
//   }
// };





export const sendPickupTemplateBefore10Min = async ( phoneNumber, name, templateName, broadcastName, scheduledAt ) => {
 
  const [firstRaw] = String(name).trim().split(/\s+/);
  const firstName = firstRaw || name;
 
  const channelPhoneNumber = "917817877678";
  const url = `https://live-mt-server.wati.io/388428/api/v1/broadcast/scheduleBroadcast?channelPhoneNumber=${channelPhoneNumber}`;
 
  const payload = {
    broadcastName,
    templateName,
    scheduledAt,
    receivers: [
      {
        whatsappNumber: phoneNumber,
        customParams: [
          {
            name: "name",
            value: firstName,
          }, ], },
    ], };
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YmM2MmFkNC04NTQ3LTRkYzItOTc0Ni0wNmRkMjZiODYzNmMiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDYvMzAvMjAyNSAwNzozNzoxNSIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.dr6x_b4olu0EL6oJcEENiD2nMYrlQx5MWlQTJBttcqg",
    },
    body: JSON.stringify(payload),
  };
  try {
    const res = await fetch(url, options);
    return await res.json();
  } catch (err) {
    throw err;
  }
};
 