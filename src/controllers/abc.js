import axios from "axios";
import Driver from "../models/driverModel.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";

function formatTitle(name, phoneNumber) {
  const MAX = 24;
  const SEP = " 📞 ";
  let title = `${name}${SEP}${phoneNumber}`;
  const overflow = title.length - MAX;
  if (overflow > 0) {
    title = `${name.slice(0, name.length - overflow)}${SEP}${phoneNumber}`;
  }
  return title;
}

export const sendPassengerList = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      console.warn("[sendPassengerList] Missing phoneNumber in request");
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required." });
    }

    const driver = await Driver.findOne({ phoneNumber });
    if (!driver) {
      console.warn("[sendPassengerList] No driver for", phoneNumber);
      return res
        .status(404)
        .json({ success: false, message: "Driver not found." });
    }

    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber Employee_Address",
    });
    if (!asset) {
      console.warn("[sendPassengerList] No asset for driver", driver._id);
      return res
        .status(404)
        .json({ success: false, message: "No asset assigned to this driver." });
    }

    const journey = await Journey.findOne({ Driver: driver._id });
    if (!journey) {
      console.error(
        "[sendPassengerList] Missing journey record for driver",
        driver._id
      );
      return res
        .status(500)
        .json({ success: false, message: "Journey record missing." });
    }

    const shiftBlock = asset.passengers.find(
      (b) => b.shift === journey.Journey_shift
    );

    if (
      !shiftBlock ||
      !Array.isArray(shiftBlock.passengers) ||
      shiftBlock.passengers.length === 0
    ) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No passengers assigned to this Shift."
      );
      return res.status(200).json({
        success: true,
        message: "No passengers assigned to this cab.",
      });
    }

    // ✅ Today's weekday
    const today = new Date().toLocaleString("en-US", { weekday: "short" });

    // ✅ Current time
    const now = new Date();

    const boardedIds = new Set(
      journey.boardedPassengers.map((evt) =>
        typeof evt.passenger === "object"
          ? evt.passenger._id.toString()
          : evt.passenger.toString()
      )
    );

    // ✅ Filter by: day + time + not boarded
    let rows = shiftBlock.passengers
      .filter((ps) => {
        if (!ps.passenger || !Array.isArray(ps.wfoDays)) return false;

        // Check today's WFO
        if (!ps.wfoDays.includes(today)) return false;

        // Check time window
        const start = ps.bufferStart ? new Date(ps.bufferStart) : null;
        const end = ps.bufferEnd ? new Date(ps.bufferEnd) : null;

        if (start && end && (now < start || now > end)) return false;

        // Check not boarded
        return !boardedIds.has(ps.passenger._id.toString());
      })
      .map((ps) => ({
        title: formatTitle(
          ps.passenger.Employee_Name,
          ps.passenger.Employee_PhoneNumber
        ),
        description: `📍 ${ps.passenger.Employee_Address}`.slice(0, 72),
      }));

    if (rows.length === 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No passengers scheduled for now (either not today or outside time window)."
      );
      return res.status(200).json({
        success: true,
        message: "No passengers available right now for this cab.",
      });
    }

    const watiPayload = {
      header: "Ride Details",
      body: `Passenger list for (${
        driver.vehicleNumber || "Unknown Vehicle"
      }):`,
      footer: "CabTalk",
      buttonText: "Menu",
      sections: [{ title: "Passenger Details", rows }],
    };

    const response = await axios.post(
      `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
      watiPayload,
      {
        headers: {
          Authorization: `Bearer <YOUR_WATI_TOKEN>`,
          "Content-Type": "application/json-patch+json",
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Passenger list sent successfully via WhatsApp.",
      data: response.data,
    });
  } catch (error) {
    console.error("[sendPassengerList] Error sending passenger list:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};
