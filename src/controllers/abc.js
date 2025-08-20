export const createJourney = async (req, res) => {
  console.log("➡️ [START] createJourney triggered");
  console.log("📦 Request Body:", req.body);

  try {
    const { Journey_Type, vehicleNumber, Journey_shift } = req.body;

    console.log("🧪 Validating required fields...");
    if (!Journey_Type || !vehicleNumber || !Journey_shift) {
      console.warn("⚠️ Validation failed: Missing fields");
      return res.status(400).json({
        message: "Journey_Type, vehicleNumber and Journey_shift are required.",
      });
    }
    console.log("✅ Fields validated");

    console.log(`🔍 Searching for driver with vehicleNumber: ${vehicleNumber}`);
    const driver = await Driver.findOne({ vehicleNumber });

    if (!driver) {
      console.warn("❌ Driver not found");
      return res.status(404).json({
        message: "No driver found with this vehicle number.",
      });
    }
    console.log("✅ Driver found:", driver._id);

    console.log(`🔍 Searching for asset assigned to driver ID: ${driver._id}`);
    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_ID Employee_Name Employee_PhoneNumber wfoDays", // 🆕 ensure we fetch wfoDays
    });

    if (!asset) {
      console.warn("❌ No asset found for this driver");
      return res.status(404).json({
        message: "No assigned vehicle found for this driver.",
      });
    }
    console.log("✅ Asset found:", asset._id);

    console.log("🔎 Checking for existing active journey for this driver...");
    const existingJourney = await Journey.findOne({ Driver: driver._id });

    if (existingJourney) {
      console.warn("⛔ Active journey already exists");
      await sendWhatsAppMessage(
        driver.phoneNumber,
        "Please end this current ride before starting a new one."
      );
      return res.status(400).json({
        message:
          "Active journey exists. Please end the current ride before starting a new one.",
      });
    }
    console.log("✅ No active journey found");

    console.log("🛠 Creating a new journey...");
    const newJourney = new Journey({
      Driver: driver._id,
      Asset: asset._id,
      Journey_Type,
      Journey_shift,
      Occupancy: 0,
      SOS_Status: false,
    });

    await newJourney.save();
    console.log("✅ New journey saved:", newJourney._id);

    console.log("🔧 Updating asset status to active...");
    asset.isActive = true;
    await asset.save();
    console.log("✅ Asset updated:", asset._id);

    // ✅ New section: Schedule WhatsApp notifications for Pickup passengers
    if (Journey_Type.toLowerCase() === "pickup") {
      console.log("📣 Journey type is Pickup – scheduling passenger notifications...");

      for (const shift of asset.passengers) {
        if (shift.shift !== Journey_shift) continue;

        for (const shiftPassenger of shift.passengers) {
          const { passenger, bufferStart, bufferEnd } = shiftPassenger;
          if (!passenger) continue;

          // 🆕 Skip week-off passengers
          if (!isPassengerWorkingToday(shiftPassenger)) {
            console.log(`🚫 Skipping ${passenger.Employee_Name} (week off today)`);
            continue;
          }

          // 1. Schedule Pickup reminder at bufferStart
          if (bufferStart) {
            try {
              await schedulePickupNotification(shiftPassenger, bufferStart); // 🆕 pass shiftPassenger (includes wfoDays)
              console.log(`🟢 Pickup reminder scheduled for ${passenger.Employee_Name}`);
            } catch (err) {
              console.error(`❌ Failed to schedule pickup notification for ${passenger.Employee_Name}:`, err.message);
            }
          }

          // 2. Schedule bufferEnd missed-boarding notification
          if (bufferEnd) {
            try {
              await scheduleBufferEndNotification(passenger, bufferEnd);
              console.log(`🕒 Missed-boarding check scheduled for ${passenger.Employee_Name}`);
            } catch (err) {
              console.error(`❌ Failed to schedule bufferEnd check for ${passenger.Employee_Name}:`, err.message);
            }
          }
        }
      }

      // 🔄 Notifying passenger app of shift update
      try {
        const mockReq = {
          body: { vehicleNumber, Journey_shift },
        };
        const mockRes = {
          status: (code) => ({
            json: (data) =>
              console.log(`🟢 Passenger notification response [${code}]:`, data),
          }),
        };
        await startRideUpdatePassengerController(mockReq, mockRes);
        console.log("✅ Assigned passengers notified");

        console.log("📨 Notifying other passengers in same shift...");
        await sendOtherPassengerSameShiftUpdateMessage(Journey_shift, asset._id);
      } catch (err) {
        console.error("🚨 Error during passenger notifications:", err.message);
      }
    } else {
      console.log("ℹ️ Journey type is not Pickup – skipping passenger notification");
    }

    const io = req.app.get("io");
    if (io) {
      console.log("📡 Emitting socket event: newJourney");
      io.emit("newJourney", newJourney);
    } else {
      console.warn("⚠️ Socket IO instance not found");
    }

    console.log("✅ [SUCCESS] Journey creation complete");
    return res.status(201).json({
      message: "Journey created successfully.",
      newJourney,
      updatedAsset: asset,
    });
  } catch (error) {
    console.error("❌ [ERROR] Server error in createJourney:", error.message);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
