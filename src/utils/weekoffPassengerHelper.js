// utils/scheduleHelper.js
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Normalize array of days to ["mon","tue",...] lowercase 3-letter format
 */
export const normalizeDays = (days) => {
  if (!Array.isArray(days)) return [];
  return days.map((d) => d.trim().slice(0, 3).toLowerCase());
};

/**
 * Get today's 3-letter lowercase short day
 */
export const getToday = () => WEEK_DAYS[new Date().getDay()];

/**
 * Check if passenger is scheduled today
 */
export const isScheduledToday = (wfoDays) => {
  if (!wfoDays || wfoDays.length === 0) {
    console.log("📅 No wfoDays set → treating as always scheduled.");
    return true; // default: scheduled every day
  }
  const today = getToday();
  const normalized = normalizeDays(wfoDays);
  const result = normalized.includes(today);
  console.log(`📅 Checking schedule: today=${today}, wfoDays=${normalized}, result=${result}`);
  return result;
};
