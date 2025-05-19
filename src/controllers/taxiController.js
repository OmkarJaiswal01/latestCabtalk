import Taxi from "../models/TaxiModel.js";
export const createTaxi = async (req, res) => {
  try {
    const { taxiDriverName, taxiDriverNumber, taxiVehicleNumber } = req.body;
    if (!taxiDriverName || !taxiDriverNumber || !taxiVehicleNumber) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }
    const newTaxi = new Taxi({
      taxiDriverName: taxiDriverName.toString().trim(),
      taxiDriverNumber: taxiDriverNumber.toString().trim(),
      taxiVehicleNumber: taxiVehicleNumber.toString().trim(),
    });
    await newTaxi.save();
    return res.status(201).json({ success: true, data: newTaxi });
  } catch (err) {
    console.error("createTaxi Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
export const getAllTaxis = async (req, res) => {
  try {
    const taxis = await Taxi.find({});
    return res.status(200).json({ success: true, data: taxis });
  } catch (err) {
    console.error("getAllTaxis Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
