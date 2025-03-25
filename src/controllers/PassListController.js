import axios from "axios";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
export const sendPassengerListToDriverByPhone = asyncHandler(async (req, res) => { const { phoneNumber } = req.query;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: "Driver phone number is required in query parameters." });
  }
  const driver = await Driver.findOne({ phoneNumber });
  if (!driver) {
    return res.status(404).json({ success: false, message: "Driver not found with the provided phone number.",
    }); }
  const asset = await Asset.findOne({ driver: driver._id }).populate("driver", "name phoneNumber vehicleNumber").populate("passengers", "Employee_Name Employee_PhoneNumber Employee_Address");
  if (!asset) {
    return res.status(404).json({ success: false, message: "No asset found for this driver.", }); }
  const driverName = driver.name || "Driver";
  const vehicleNumber = driver.vehicleNumber || "Unknown Vehicle";
  let message = `Hi ${driverName},\n\nPassengers list for ${vehicleNumber}:\n`;
  if (asset.passengers && asset.passengers.length > 0) {
    asset.passengers.forEach((p, index) => {
      message += `\n${index + 1}. ${p.Employee_Name}  Ph_No: ${p.Employee_PhoneNumber}  Add: ${p.Employee_Address}\n`; });
  } else {
    message += "\nNo passengers are currently assigned to your vehicle.";
  }
  const finalMessage = message.trim();
  try {
    const watiResponse = await axios.post(
      `${process.env.WATI_API_URL}/api/v1/sendSessionMessage/${phoneNumber}`,
      {},
      {  params: { messageText: finalMessage },
        headers: {
          Authorization: `Bearer ${process.env.WATI_API_TOKEN}`,
          "Content-Type": "application/json",
        }, } );
    return res.status(200).json({
      success: true, message: "Passenger list sent to driver successfully.", data: watiResponse.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false, message: "Error sending WhatsApp message.",  error: error.response?.data || error.message,
    }); } });