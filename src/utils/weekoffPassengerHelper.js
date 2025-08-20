export function isPassengerWorkingToday(passenger, bufferDate = new Date()) {
  if (!passenger?.wfoDays?.length) return false;

  const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = dayMap[bufferDate.getDay()];
  return passenger.wfoDays.includes(today);
}
