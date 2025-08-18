// Put this function into your assetController.js (replace addMultiplePassengersToAsset)
import mongoose from "mongoose";
import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
// ... other imports you already have

function normalizeDayString(d) {
  if (d == null) return null;
  if (typeof d !== "string") d = String(d);
  d = d.trim().toLowerCase().replace(/\.$/, "");
  const map = {
    mon: "Mon", monday: "Mon",
    tue: "Tue", tuesday: "Tue",
    wed: "Wed", wednesday: "Wed",
    thu: "Thu", thursday: "Thu",
    fri: "Fri", friday: "Fri",
    sat: "Sat", saturday: "Sat",
    sun: "Sun", sunday: "Sun",
  };
  const key = d.slice(0, 3);
  return map[key] || null;
}

export const addMultiplePassengersToAsset = asyncHandler(async (req, res) => {
  try {
    const { passengers, shift } = req.body;
    const { id: assetId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(assetId) ||
      !Array.isArray(passengers) ||
      passengers.length === 0 ||
      typeof shift !== "string" ||
      !shift.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "assetId, non-empty passengers array, and shift are required.",
      });
    }

    // Validate & normalize incoming passenger payloads
    const normalizedPassengers = [];
    for (const p of passengers) {
      if (!p.id || !mongoose.Types.ObjectId.isValid(p.id)) {
        return res.status(400).json({ success: false, message: "Each passenger must include a valid id." });
      }

      // ensure bufferStart/end parseable
      const bs = new Date(p.bufferStart);
      const be = new Date(p.bufferEnd);
      if (isNaN(bs.getTime()) || isNaN(be.getTime())) {
        return res.status(400).json({ success: false, message: "Each passenger must include valid bufferStart and bufferEnd." });
      }

      // normalize wfoDays (accept many formats)
      if (!p.wfoDays || (Array.isArray(p.wfoDays) && p.wfoDays.length === 0)) {
        return res.status(400).json({ success: false, message: "Each passenger must include wfoDays (array of days)." });
      }
      const rawDays = Array.isArray(p.wfoDays) ? p.wfoDays : [p.wfoDays];
      const normDays = rawDays.map((d) => normalizeDayString(d)).filter(Boolean);
      const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      if (normDays.length === 0 || normDays.some((d) => !validDays.includes(d))) {
        return res.status(400).json({ success: false, message: "wfoDays must contain valid days (Mon..Sun)." });
      }

      normalizedPassengers.push({
        id: p.id,
        requiresTransport: p.requiresTransport ?? true,
        bufferStart: bs,
        bufferEnd: be,
        wfoDays: normDays,
      });
    }

    const [asset, passengerDocs] = await Promise.all([
      Asset.findById(assetId),
      Passenger.find({ _id: { $in: normalizedPassengers.map((p) => p.id) } }),
    ]);

    if (!asset) {
      return res.status(404).json({ success: false, message: "Asset not found." });
    }

    const already = passengerDocs.filter((p) => p.asset);
    if (already.length) {
      return res.status(400).json({
        success: false,
        message: `Some passengers are already assigned to an Asset.`,
        already: already.map((a) => a._id),
      });
    }

    const existingShift = asset.passengers.find((g) => g.shift === shift);
    const shiftCount = existingShift ? existingShift.passengers.length : 0;
    if (shiftCount + normalizedPassengers.length > asset.capacity) {
      return res.status(400).json({ success: false, message: `Shift capacity exceeded.` });
    }

    const newSubs = normalizedPassengers.map((p) => ({
      passenger: p.id,
      requiresTransport: p.requiresTransport,
      bufferStart: p.bufferStart,
      bufferEnd: p.bufferEnd,
      wfoDays: p.wfoDays,
    }));

    const idx = asset.passengers.findIndex((g) => g.shift === shift);
    if (idx >= 0) asset.passengers[idx].passengers.push(...newSubs);
    else asset.passengers.push({ shift, passengers: newSubs });

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await asset.save({ session });
      await Passenger.updateMany(
        { _id: { $in: normalizedPassengers.map((p) => p.id) } },
        { $set: { asset: asset._id } },
        { session }
      );
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const updated = await Asset.findById(assetId)
      .populate("driver", "name vehicleNumber")
      .populate("passengers.passengers.passenger", "Employee_ID Employee_Name Employee_PhoneNumber Employee_Address")
      .lean();

    req.app.get("io").emit("assetUpdated", updated);
    return res.status(200).json({ success: true, message: "Passengers added successfully.", asset: updated });
  } catch (error) {
    console.error("addMultiplePassengersToAsset error:", error);
    return res.status(500).json({ success: false, message: "Server error while adding passengers.", error: error.message });
  }
});
