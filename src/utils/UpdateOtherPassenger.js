export async function UpdateOtherPassenger({
  whatsappNumber,
  templateName,
  broadcastName,
  parameters,
  token
}) {
  const url = `https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage?whatsappNumber=${whatsappNumber}`;

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json-patch+json',
      'Authorization': `Bearer ${token}`
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


