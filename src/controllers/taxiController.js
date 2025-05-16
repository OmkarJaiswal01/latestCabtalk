import Asset from "../models/assetModel.js";
import Passenger from "../models/Passenger.js";
import Journey from "../models/JourneyModel.js";
import Taxi from "../models/TaxiModel.js";

import { sosUpdatePassengers } from "../utils/sosUpdatePassengers.js";
import { sosUpdateTaxiDriver } from "../utils/sosUpdateTaxiDriver.js";

export const replaceCarAndTransferPassengers = async (req, res) => {
  try {
    const { brokenAssetId, newAssetId, driverPhoneNumber } = req.body;

    if (!brokenAssetId || !newAssetId || !driverPhoneNumber) {
      return res.status(400).json({ success: false, message: "Asset IDs and driver phone number are required." });
    }

    if (brokenAssetId === newAssetId) {
      return res.status(400).json({ success: false, message: "Asset IDs must be different." });
    }

    // Find the driver by phone number instead of driverId
    const driver = await Taxi.findOne({ phoneNumber: driverPhoneNumber }).lean();

    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver with provided phone number not found." });
    }

    // Now find assets
    const [brokenAsset, newAsset] = await Promise.all([
      Asset.findById(brokenAssetId).populate("passengers").lean(),
      Asset.findById(newAssetId).lean(),
    ]);

    if (!brokenAsset || !newAsset) {
      return res.status(404).json({ success: false, message: "Broken asset or new asset not found." });
    }

    if (!brokenAsset.isActive) {
      return res.status(400).json({ success: false, message: "Broken asset is already inactive." });
    }

    if (newAsset.isActive) {
      return res.status(400).json({ success: false, message: "New asset is already active." });
    }

    const passengersToTransfer = brokenAsset.passengers.map(p => p._id);

    // Update the new asset with passengers and driver (driver._id here)
    await Promise.all([
      Asset.findByIdAndUpdate(newAssetId, {
        passengers: passengersToTransfer,
        isActive: true,
        driver: driver._id,
      }),
      Asset.findByIdAndUpdate(brokenAssetId, { isActive: false }),
      Passenger.updateMany({ _id: { $in: passengersToTransfer } }, { asset: newAssetId }),
      Journey.updateMany({ Asset: brokenAssetId }, { Asset: newAssetId }),
    ]);

    // Notify passengers
    const passengerNotification = await sosUpdatePassengers({
      assetId: newAssetId,
      previousAssetId: brokenAssetId,
    });

    // Notify driver (new driver)
    const driverNotification = await sosUpdateTaxiDriver(newAssetId);

    return res.status(200).json({
      success: true,
      message: "Passengers transferred, car replaced, and notifications sent.",
      transferredPassengerIds: passengersToTransfer,
      notifications: {
        passengers: passengerNotification,
        driver: driverNotification,
      },
    });

  } catch (err) {
    console.error("[ERROR] replaceCarAndTransferPassengers:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
