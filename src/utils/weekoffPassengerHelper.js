// utils/weekoffPassengerHelper.js
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Normalize array of days to ["mon","tue",...] lowercase 3-letter format
 */
export const normalizeDays = (days) => {
  if (!Array.isArray(days)) return [];
  return days
    .map((d) => String(d || "").trim().slice(0, 3).toLowerCase())
    .filter(Boolean);
};

/**
 * Get today's 3-letter lowercase short day
 */
export const getToday = () => WEEK_DAYS[new Date().getDay()].slice(0, 3).toLowerCase();

/**
 * Check if passenger is scheduled today
 *
 * Default behaviour:
 *  - Missing/empty wfoDays => treated as scheduled (true)
 *  - If you'd prefer missing = NOT scheduled, change the first return to `false`.
 */
export const isScheduledToday = (wfoDays) => {
  if (!wfoDays || !Array.isArray(wfoDays) || wfoDays.length === 0) {
    console.log("📅 No wfoDays set → treating as always scheduled.");
    return true;
  }
  const today = getToday();
  const normalized = normalizeDays(wfoDays);
  const result = normalized.includes(today);
  console.log(`📅 Checking schedule: today=${today}, wfoDays=${JSON.stringify(normalized)}, result=${result}`);
  return result;
};
