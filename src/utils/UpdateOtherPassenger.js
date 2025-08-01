export async function UpdateOtherPassenger({
  whatsappNumber,
  templateName,
  broadcastName,
  parameters,
  
}) {
  const url = `https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage?whatsappNumber=${whatsappNumber}`;

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json-patch+json',
      'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YmM2MmFkNC04NTQ3LTRkYzItOTc0Ni0wNmRkMjZiODYzNmMiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDYvMzAvMjAyNSAwNzozNzoxNSIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.dr6x_b4olu0EL6oJcEENiD2nMYrlQx5MWlQTJBttcqg`
    },
    body: JSON.stringify({
      template_name: templateName,
      broadcast_name: broadcastName,
      parameters
    })
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    console.log('Success:', data);
    return data;
  } catch (error) {
    console.error('Error sending template message:', error);
    throw error;
  }
}


