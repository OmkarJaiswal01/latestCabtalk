// utils/passengerHelper.js
export const isPassengerWorkingToday = (passenger) => {
  try {
    const today = new Date().toLocaleString("en-US", { weekday: "short" }); // "Mon", "Tue", etc.
    if (!passenger?.wfoDays || passenger.wfoDays.length === 0) {
      console.log(`🚫 ${passenger?.Employee_Name || "Unknown"} has no working days.`);
      return false;
    }

    const working = passenger.wfoDays.includes(today);
    if (!working) {
      console.log(`🚫 ${passenger.Employee_Name} is not working today (${today}).`);
    }
    return working;
  } catch (err) {
    console.error("❌ Error in isPassengerWorkingToday:", err.message);
    return false;
  }
};
