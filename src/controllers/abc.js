if (jt === "pickup") {
  // confirm pickup to this passenger
  await sendPickupConfirmationMessage(
    passenger.Employee_PhoneNumber,
    passenger.Employee_Name
  );

  const boardedSet = new Set(
    journey.boardedPassengers.map((bp) =>
      (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "")
    )
  );
  boardedSet.add(cleanedPhone);

  // notify other passengers of same shift (no extra wfoDays filtering here)
  for (const shiftPassenger of thisShift.passengers) {
    const pDoc = shiftPassenger.passenger;
    if (!pDoc?.Employee_PhoneNumber) continue;

    const phoneClean = (pDoc.Employee_PhoneNumber || "").replace(/\D/g, "");
    if (!phoneClean || boardedSet.has(phoneClean)) continue; // skip boarded + self

    const bufferEnd = shiftPassenger.bufferEnd
      ? new Date(shiftPassenger.bufferEnd)
      : null;
    if (!bufferEnd || isNaN(bufferEnd.getTime())) continue;

    if (bufferEnd > new Date()) {
      await sendOtherPassengerSameShiftUpdateMessage(
        pDoc.Employee_PhoneNumber,
        passenger.Employee_Name   // ✅ boarding passenger’s name
      );
    }
  }
}
