import mongoose from 'mongoose';
import Passenger from '../models/Passenger.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

export const insertPassenger = asyncHandler(async (req, res) => {
  const { Employee_ID, Employee_Name, Employee_PhoneNumber, Employee_ShiftTiming, Employee_Address, Service } = req.body;
  if (!Employee_ID || !Employee_Name || !Employee_PhoneNumber || !Employee_ShiftTiming || !Employee_Address || !Service) {
    return res.status(400).json({
      success: false,
      message: 'Employee_ID, Employee_Name, Employee_PhoneNumber, Employee_ShiftTiming, Employee_Address and Service are required.',
    });
  }

  const newPassenger = new Passenger({
    Employee_ID: Employee_ID.toString().trim(),
    Employee_Name: Employee_Name.toString().trim(),
    Employee_PhoneNumber: Employee_PhoneNumber.toString().trim(),
    Employee_ShiftTiming: Employee_ShiftTiming ? Employee_ShiftTiming.toString().trim() : '',
    Employee_Address: Employee_Address ? Employee_Address.toString().trim() : '',
    Service: Service ? Service.toString().trim() : '',
  });
  
  await newPassenger.save();
  res.status(201).json({ success: true, data: newPassenger });
});

export const getPassengers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  let query = {};
  if (search) {
    const regex = new RegExp(search, 'i');
    query = { $or: [{ Employee_Name: { $regex: regex } }, { Employee_ID: { $regex: regex } }] };
  }
  const passengers = await Passenger.find(query).sort({ _id: 1 });
  res.status(200).json(passengers);
});

export const updatePassenger = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Valid Passenger ID is required.' });
  }
  const updateData = { ...req.body };
  if (updateData.Employee_ID) updateData.Employee_ID = updateData.Employee_ID.toString().trim();
  if (updateData.Employee_Name) updateData.Employee_Name = updateData.Employee_Name.toString().trim();
  if (updateData.Employee_PhoneNumber) updateData.Employee_PhoneNumber = updateData.Employee_PhoneNumber.toString().trim();
  if (updateData.Employee_ShiftTiming) updateData.Employee_ShiftTiming = updateData.Employee_ShiftTiming.toString().trim();
  if (updateData.Employee_Address) updateData.Employee_Address = updateData.Employee_Address.toString().trim();
  if (updateData.Service) updateData.Service = updateData.Service.toString().trim();

  const updatedPassenger = await Passenger.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  if (!updatedPassenger) {
    return res.status(404).json({ success: false, message: 'Passenger not found.' });
  }
  res.status(200).json({ success: true, data: updatedPassenger });
});

export const deletePassenger = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Valid Passenger ID is required.' });
  }
  const deletedPassenger = await Passenger.findByIdAndDelete(id);
  if (!deletedPassenger) {
    return res.status(404).json({ success: false, message: 'Passenger not found.' });
  }
  res.status(200).json({ success: true, message: 'Passenger deleted successfully.' });
});
