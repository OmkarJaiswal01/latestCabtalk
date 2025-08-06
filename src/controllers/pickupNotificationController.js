// import Asset from "../models/assetModel.js";
// import Driver from "../models/driverModel.js";
// import Journey from "../models/JourneyModel.js";
// import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
// import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";
// import { sendPickupTemplateBefore10Min } from "../utils/sendTempleteBeforeTenMinites.js";
// import { sendTemplateMoveCab } from "../utils/sendTemplateMoveCab.js";
// import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";
// import { updateOtherPassenger } from "../utils/UpdateOtherPassenger.js";

// export const sendPickupConfirmation = async (req, res) => {
//   try {
//     const { pickedPassengerPhoneNumber } = req.body;
//     if (!pickedPassengerPhoneNumber) {
//       return res.status(400).json({
//         success: false,
//         message: "pickedPassengerPhoneNumber is required.",
//       });
//     }

//     const cleanedPhone = pickedPassengerPhoneNumber.replace(/\D/g, "");
//     if (!/^91\d{10}$/.test(cleanedPhone)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid Indian phone number format.",
//       });
//     }

//     const asset = await Asset.findOne({
//       "passengers.passengers.passenger": { $exists: true },
//     }).populate({
//       path: "passengers.passengers.passenger",
//       select: "Employee_PhoneNumber Employee_Name",
//     });
//     if (!asset) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Asset not found." });
//     }

//     let pickedPassenger = null;
//     let currentShiftPassengers = [];
//     for (const shift of asset.passengers) {
//       const match = shift.passengers.find(
//         (sp) =>
//           sp.passenger?.Employee_PhoneNumber?.replace(/\D/g, "") ===
//           cleanedPhone
//       );
//       if (match) {
//         pickedPassenger = match.passenger;
//         currentShiftPassengers = shift.passengers.map((sp) => sp.passenger);
//         break;
//       }
//     }
//     if (!pickedPassenger) {
//       return res.status(404).json({
//         success: false,
//         message: "Picked passenger not found in asset.",
//       });
//     }

//     const journey = await Journey.findOne({ Asset: asset._id })
//       .sort({ createdAt: -1 })
//       .populate({
//         path: "boardedPassengers.passenger",
//         select: "Employee_PhoneNumber Employee_Name",
//       });
//     if (!journey) {
//       return res
//         .status(404)
//         .json({ success: false, message: "No journey found for asset." });
//     }

//     const alreadyBoarded = journey.boardedPassengers.some(
//       (bp) =>
//         (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "") ===
//         cleanedPhone
//     );
//     if (alreadyBoarded) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Passenger already boarded." });
//     }

//     journey.boardedPassengers.push({ passenger: pickedPassenger._id });
//     await journey.save();

//     const confirmation = await sendPickupConfirmationMessage(
//       pickedPassenger.Employee_PhoneNumber,
//       pickedPassenger.Employee_Name
//     );

//     const boardedSet = new Set(
//       journey.boardedPassengers
//         .map((bp) => bp.passenger.Employee_PhoneNumber || "")
//         .map((num) => num.replace(/\D/g, ""))
//     );
//     boardedSet.add(cleanedPhone);

//     const notifiedPassengers = [];
//     for (const p of currentShiftPassengers) {
//       if (!p?.Employee_PhoneNumber) continue;
//       const phoneClean = p.Employee_PhoneNumber.replace(/\D/g, "");
//       if (boardedSet.has(phoneClean)) continue;
// //sendOtherPassengerSameShiftUpdateMessage
//       const notify = await sendPassengerUpdate(
//         p.Employee_PhoneNumber,
//         p.Employee_Name,
//         // pickedPassenger.Employee_Name
//       );
//       notifiedPassengers.push({
//         name: p.Employee_Name,
//         phone: p.Employee_PhoneNumber,
//         success: notify.success,
//         error: notify.error || null,
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message:
//         "Confirmation sent to picked passenger; unboarded shift‑mates updated.",
//       pickedPassenger: {
//         name: pickedPassenger.Employee_Name,
//         phone: pickedPassenger.Employee_PhoneNumber,
//         confirmation,
//       },
//       notifiedPassengers,
//       boardedCount: journey.boardedPassengers.length,
//     });
//   } catch (err) {
//     console.error("Pickup error:", err);
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error", error: err.message });
//   }
// };

// // send templete

// export const schedulePickupNotification = async (passenger, bufferStart) => {
//   console.log("📦 Scheduling pickup notification...");

//   const phoneNumber = passenger?.Employee_PhoneNumber;
//   const name = passenger?.Employee_Name;

//   if (
//     !phoneNumber ||
//     !name ||
//     !bufferStart ||
//     isNaN(new Date(bufferStart).getTime())
//   ) {
//     console.warn(
//       `❌ Invalid passenger data. name=${name}, phone=${phoneNumber}, bufferStart=${bufferStart}`
//     );
//     return;
//   }

//   const templateName = "pick_up_passenger_notification_before_10_minutes__";
//   const broadcastName = `pick_up_passenger_notification_before_10_minutes___${formatBroadcastName(
//     bufferStart
//   )}`;

//   const pickupDate = new Date(bufferStart);
//   const sendTime = new Date(pickupDate.getTime() - 10 * 60 * 1000); // 10 minutes before
//   const delay = sendTime.getTime() - Date.now();

//   const { hours, minutes, seconds } = convertMillisecondsToTime(delay);

//   console.log(`👤 Passenger: ${name}, Phone: ${phoneNumber}`);
//   console.log(`🕒 Pickup Time: ${pickupDate.toISOString()}`);
//   console.log(`🕑 Notification scheduled for: ${sendTime.toISOString()}`);
//   console.log(`⏳ Delay: ${delay} ms (${hours}h ${minutes}m ${seconds}s)`);

//   if (delay <= 0) {
//     console.log(
//       "⚠️ Pickup is too close or in the past. Sending notification immediately."
//     );
//     try {
//       await sendPickupTemplateBefore10Min(
//         phoneNumber,
//         name,
//         templateName,
//         broadcastName
//       );
//       console.log(`✅ Immediate notification sent to ${name} (${phoneNumber})`);
//     } catch (err) {
//       console.error(
//         `❌ Failed to send immediate notification to ${name}:`,
//         err
//       );
//     }
//     return;
//   }

//   setTimeout(async () => {
//     try {
//       console.log(
//         `🚀 Sending scheduled notification to ${name} at ${new Date().toISOString()}`
//       );
//       await sendPickupTemplateBefore10Min(
//         phoneNumber,
//         name,
//         templateName,
//         broadcastName
//       );
//       console.log(`✅ Scheduled notification sent to ${name} (${phoneNumber})`);
//     } catch (err) {
//       console.error(
//         `❌ Failed to send scheduled pickup message to ${name}:`,
//         err
//       );
//     }
//   }, delay);
// };

// function formatBroadcastName(pickupTime) {
//   const dt = new Date(pickupTime);
//   const day = String(dt.getDate()).padStart(2, "0");
//   const month = String(dt.getMonth() + 1).padStart(2, "0");
//   const year = dt.getFullYear();
//   const hour = String(dt.getHours()).padStart(2, "0");
//   const min = String(dt.getMinutes()).padStart(2, "0");
//   return `${day}${month}${year}${hour}${min}`;
// }

// function convertMillisecondsToTime(ms) {
//   const totalSeconds = Math.floor(ms / 1000);
//   const hours = Math.floor(totalSeconds / 3600);
//   const minutes = Math.floor((totalSeconds % 3600) / 60);
//   const seconds = totalSeconds % 60;
//   return { hours, minutes, seconds };
// }

// // send template on buffer End time

// // export const scheduleBufferEndNotification = async (passenger, bufferEnd) => {
// //   console.log("📦 [Step 0] Scheduling bufferEnd notification...");

// //   const phoneNumber = passenger?.Employee_PhoneNumber;
// //   const name = passenger?.Employee_Name;

// //   // ✅ Step 1: Validate inputs
// //   if (!phoneNumber || !name || !bufferEnd || isNaN(new Date(bufferEnd).getTime())) {
// //     console.warn(`❌ Invalid input. name=${name}, phone=${phoneNumber}, bufferEnd=${bufferEnd}`);
// //     return;
// //   }

// //   const now = new Date();
// //   const sendTime = new Date(bufferEnd);
// //   const delay = sendTime.getTime() - now.getTime();

// //   const { hours, minutes, seconds } = convertMillisecondsToTimeBufferEnd(delay);
// //   console.log(`📅 bufferEnd for ${name}: ${sendTime.toISOString()}`);
// //   console.log(`⏳ Notification in: ${hours}h ${minutes}m ${seconds}s (${delay}ms)`);

// //   // 🔄 Step 2: Function to run at bufferEnd
// //   const sendIfStillNotBoarded = async () => {
// //     try {
// //       console.log(`🔍 Checking if ${name} (${phoneNumber}) has boarded...`);

// //       const journey = await Journey.findOne({
// //         Journey_Type: { $regex: /^pickup$/, $options: "i" },
// //       })
// //         .sort({ createdAt: -1 })
// //         .populate("Driver", "phoneNumber")
// //         .populate({
// //           path: "Asset",
// //           select: "passengers",
// //           populate: {
// //             path: "passengers.passengers.passenger",
// //             model: "Passenger",
// //             select: "Employee_Name Employee_PhoneNumber",
// //           },
// //         })
// //         .populate("boardedPassengers.passenger", "Employee_PhoneNumber");

// //       if (!journey) {
// //         console.warn(`❌ No journey found.`);
// //         return;
// //       }

// //       const driverPhoneNumber = journey?.Driver?.phoneNumber;
// //       console.log("🚗 Driver phone number:", driverPhoneNumber);

// //       // Check if passenger is assigned in asset shifts
// //       const passengerAssigned = journey?.Asset?.passengers?.some((shift) =>
// //         shift.passengers.some((p) =>
// //           p.passenger?._id?.toString() === passenger._id?.toString()
// //         )
// //       );

// //       if (!passengerAssigned) {
// //         console.warn(`❌ Passenger not assigned to journey asset.`);
// //         return;
// //       }

// //       const hasBoarded = journey.boardedPassengers?.some(bp =>
// //         bp.passenger?._id?.toString() === passenger._id?.toString()
// //       );

// //       if (!hasBoarded) {
// //         console.log(`📨 Passenger ${name} NOT boarded. Sending messages...`);

// //         // Step 1: Notify passenger
// //         await sendTemplateMoveCab(phoneNumber, name);
// //         console.log(`✅ Passenger message sent to ${phoneNumber}`);

// //         // Step 2: Notify driver
// //         if (!driverPhoneNumber || driverPhoneNumber.length < 10) {
// //           console.warn(`⚠️ Driver phone number invalid or missing: ${driverPhoneNumber}`);
// //         } else {
// //           try {
// //             const message = "⚠️ The passenger is late. You can move the cab now.";
// //             await sendWhatsAppMessage(driverPhoneNumber, message);
// //             console.log(`✅ Driver notified at ${driverPhoneNumber}`);
// //           } catch (err) {
// //             console.error("❌ Failed to send message to driver:", err.response?.data || err.message);
// //           }
// //         }
// //       } else {
// //         console.log(`🛑 Passenger ${name} already boarded. No reminder needed.`);
// //       }

// //     } catch (err) {
// //       console.error(`❌ Error checking boarding for ${name}:`, err.message);
// //     }
// //   };

// //   // ⏲️ Step 3: Schedule or send immediately
// //   if (delay <= 0) {
// //     console.log("⚠️ bufferEnd already passed. Sending check immediately.");
// //     await sendIfStillNotBoarded();
// //   } else {
// //     console.log(`⏳ Scheduling check in ${delay / 1000}s`);
// //     setTimeout(sendIfStillNotBoarded, delay);
// //   }
// // };

// //correct
// // export const scheduleBufferEndNotification = async (passenger, bufferEnd) => {
// //   console.log("📦 [Step 0] Scheduling bufferEnd notification...");

// //   const phoneNumber = passenger?.Employee_PhoneNumber;
// //   const name = passenger?.Employee_Name;

// //   // ✅ Step 1: Validate inputs
// //   if (!phoneNumber || !name || !bufferEnd || isNaN(new Date(bufferEnd).getTime())) {
// //     console.warn(`❌ Invalid input. name=${name}, phone=${phoneNumber}, bufferEnd=${bufferEnd}`);
// //     return;
// //   }

// //   const now = new Date();
// //   const sendTime = new Date(bufferEnd);
// //   const delay = sendTime.getTime() - now.getTime();

// //   const { hours, minutes, seconds } = convertMillisecondsToTimeBufferEnd(delay);
// //   console.log(`📅 bufferEnd for ${name}: ${sendTime.toISOString()}`);
// //   console.log(`⏳ Notification in: ${hours}h ${minutes}m ${seconds}s (${delay}ms)`);

// //   // 🔄 Step 2: Function to run at bufferEnd
// //   const sendIfStillNotBoarded = async () => {
// //     try {
// //       console.log(`🔍 Checking if ${name} (${phoneNumber}) has boarded...`);

// //       const journey = await Journey.findOne({
// //         Journey_Type: { $regex: /^pickup$/, $options: "i" },
// //       })
// //         .sort({ createdAt: -1 })
// //         .populate("Driver", "phoneNumber")
// //         .populate({
// //           path: "Asset",
// //           select: "passengers",
// //           populate: {
// //             path: "passengers.passengers.passenger",
// //             model: "Passenger",
// //             select: "Employee_Name Employee_PhoneNumber",
// //           },
// //         })
// //         .populate("boardedPassengers.passenger", "Employee_PhoneNumber");

// //       if (!journey) {
// //         console.warn(`❌ No journey found.`);
// //         return;
// //       }

// //       const driverPhoneNumber = journey?.Driver?.phoneNumber;
// //       console.log("🚗 Driver phone number:", driverPhoneNumber);

// //       const passengerAssigned = journey?.Asset?.passengers?.some((shift) =>
// //         shift.passengers.some((p) =>
// //           p.passenger?._id?.toString() === passenger._id?.toString()
// //         )
// //       );

// //       if (!passengerAssigned) {
// //         console.warn(`❌ Passenger not assigned to journey asset.`);
// //         return;
// //       }

// //       const hasBoarded = journey.boardedPassengers?.some(bp =>
// //         bp.passenger?._id?.toString() === passenger._id?.toString()
// //       );

// //       if (!hasBoarded) {
// //         console.log(`📨 Passenger ${name} NOT boarded. Sending messages...`);

// //         // Step 1: Notify passenger
// //         await sendTemplateMoveCab(phoneNumber, name);
// //         console.log(`✅ Passenger message sent to ${phoneNumber}`);

// //         // Step 2: Notify driver
// //         if (!driverPhoneNumber || driverPhoneNumber.length < 10) {
// //           console.warn(`⚠️ Driver phone number invalid or missing: ${driverPhoneNumber}`);
// //         } else {
// //           try {
// //             const message = "⚠️ The passenger is late. You can move the cab now.";
// //             await sendWhatsAppMessage(driverPhoneNumber, message);
// //             console.log(`✅ Driver notified at ${driverPhoneNumber}`);
// //           } catch (err) {
// //             console.error("❌ Failed to send message to driver:", err.response?.data || err.message);
// //           }
// //         }

// //         // ✅ Step 3: Notify other passengers in the same shift
// //         const shiftGroup = journey.Asset?.passengers?.find((shift) =>
// //           shift.passengers.some((p) =>
// //             p.passenger?._id?.toString() === passenger._id?.toString()
// //           )
// //         );

// //         if (shiftGroup) {

// //           for (const shiftP of shiftGroup.passengers) {
// //             const otherPassenger = shiftP.passenger;

// //             if (
// //               otherPassenger &&
// //               otherPassenger._id?.toString() !== passenger._id?.toString()
// //             ) {
// //               try {
// //                 await sendPassengerUpdate(
// //                   {
// //                     body: {
// //                       phoneNumber: otherPassenger.Employee_PhoneNumber,
// //                       name: otherPassenger.Employee_Name, // Name of missed passenger
// //                     },
// //                   },
// //                   {
// //                     status: () => ({
// //                       json: () => {},
// //                     }),
// //                   }
// //                 );
// //                 console.log(
// //                   `📤 Notified ${otherPassenger.Employee_Name} that ${passenger.Employee_Name} missed the cab.`
// //                 );
// //               } catch (err) {
// //                 console.error(
// //                   `❌ Failed to notify ${otherPassenger.Employee_Name} about ${passenger.Employee_Name}:`,
// //                   err.message
// //                 );
// //               }
// //             }
// //           }

// //         } else {
// //           console.warn(`⚠️ Shift group not found for ${passenger.Employee_Name}`);
// //         }
// //       } else {
// //         console.log(`🛑 Passenger ${name} already boarded. No reminder needed.`);
// //       }
// //     } catch (err) {
// //       console.error(`❌ Error checking boarding for ${name}:`, err.message);
// //     }
// //   };

// //   // ⏲️ Step 3: Schedule or send immediately
// //   if (delay <= 0) {
// //     console.log("⚠️ bufferEnd already passed. Sending check immediately.");
// //     await sendIfStillNotBoarded();
// //   } else {
// //     console.log(`⏳ Scheduling check in ${delay / 1000}s`);
// //     setTimeout(sendIfStillNotBoarded, delay);
// //   }
// // };

// //correct 2
// // export const scheduleBufferEndNotification = async (passenger, bufferEnd) => {
// //   console.log("📦 [Step 0] Scheduling bufferEnd notification...");

// //   const phoneNumber = passenger?.Employee_PhoneNumber;
// //   const name = passenger?.Employee_Name;

// //   // ✅ Step 1: Validate inputs
// //   if (!phoneNumber || !name || !bufferEnd || isNaN(new Date(bufferEnd).getTime())) {
// //     console.warn(`❌ Invalid input. name=${name}, phone=${phoneNumber}, bufferEnd=${bufferEnd}`);
// //     return;
// //   }

// //   const now = new Date();
// //   const sendTime = new Date(bufferEnd);
// //   const delay = sendTime.getTime() - now.getTime();

// //   const { hours, minutes, seconds } = convertMillisecondsToTimeBufferEnd(delay);
// //   console.log(`📅 bufferEnd for ${name}: ${sendTime.toISOString()}`);
// //   console.log(`⏳ Notification in: ${hours}h ${minutes}m ${seconds}s (${delay}ms)`);

// //   // 🔄 Step 2: Function to run at bufferEnd
// //   const sendIfStillNotBoarded = async () => {
// //     try {
// //       console.log(`🔍 Checking if ${name} (${phoneNumber}) has boarded...`);

// //       const journey = await Journey.findOne({
// //         Journey_Type: { $regex: /^pickup$/, $options: "i" },
// //       })
// //         .sort({ createdAt: -1 })
// //         .populate("Driver", "phoneNumber")
// //         .populate({
// //           path: "Asset",
// //           select: "passengers",
// //           populate: {
// //             path: "passengers.passengers.passenger",
// //             model: "Passenger",
// //             select: "Employee_Name Employee_PhoneNumber",
// //           },
// //         })
// //         .populate("boardedPassengers.passenger", "Employee_PhoneNumber");

// //       if (!journey) {
// //         console.warn(`❌ No journey found.`);
// //         return;
// //       }

// //       const driverPhoneNumber = journey?.Driver?.phoneNumber;
// //       console.log("🚗 Driver phone number:", driverPhoneNumber);

// //       const passengerAssigned = journey?.Asset?.passengers?.some((shift) =>
// //         shift.passengers.some((p) =>
// //           p.passenger?._id?.toString() === passenger._id?.toString()
// //         )
// //       );

// //       if (!passengerAssigned) {
// //         console.warn(`❌ Passenger not assigned to journey asset.`);
// //         return;
// //       }

// //       const hasBoarded = journey.boardedPassengers?.some(bp =>
// //         bp.passenger?._id?.toString() === passenger._id?.toString()
// //       );

// //       if (!hasBoarded) {
// //         console.log(`📨 Passenger ${name} NOT boarded. Sending messages...`);

// //         // Step 1: Notify passenger
// //         await sendTemplateMoveCab(phoneNumber, name);
// //         console.log(`✅ Passenger message sent to ${phoneNumber}`);

// //         // Step 2: Notify driver
// //         if (!driverPhoneNumber || driverPhoneNumber.length < 10) {
// //           console.warn(`⚠️ Driver phone number invalid or missing: ${driverPhoneNumber}`);
// //         } else {
// //           try {
// //             const message = "⚠️ The passenger is late. You can move the cab now.";
// //             await sendWhatsAppMessage(driverPhoneNumber, message);
// //             console.log(`✅ Driver notified at ${driverPhoneNumber}`);
// //           } catch (err) {
// //             console.error("❌ Failed to send message to driver:", err.response?.data || err.message);
// //           }
// //         }

// //         // ✅ Step 3: Notify other passengers in the same shift
// //         const shiftGroup = journey.Asset?.passengers?.find((shift) =>
// //           shift.passengers.some((p) =>
// //             p.passenger?._id?.toString() === passenger._id?.toString()
// //           )
// //         );

// //         if (shiftGroup) {
// //           for (const shiftP of shiftGroup.passengers) {
// //             const otherPassenger = shiftP.passenger;

// //             if (
// //               otherPassenger &&
// //               otherPassenger._id?.toString() !== passenger._id?.toString()
// //             ) {
// //               try {
// //                 await sendPassengerUpdate(
// //                   {
// //                     body: {
// //                       phoneNumber: otherPassenger.Employee_PhoneNumber,
// //                       name: otherPassenger.Employee_Name,
// //                     },
// //                   },
// //                   {
// //                     status: () => ({
// //                       json: () => {},
// //                     }),
// //                   }
// //                 );

// //                 console.log(
// //                   `📤 Notified ${otherPassenger.Employee_Name} that ${passenger.Employee_Name} missed the cab.`
// //                 );
// //               } catch (err) {
// //                 console.error(
// //                   `❌ Failed to notify ${otherPassenger.Employee_Name} about ${passenger.Employee_Name}:`,
// //                   err.message
// //                 );
// //               }
// //             }
// //           }
// //         } else {
// //           console.warn(`⚠️ Shift group not found for ${passenger.Employee_Name}`);
// //         }
// //       } else {
// //         console.log(`🛑 Passenger ${name} already boarded. No reminder needed.`);
// //       }
// //     } catch (err) {
// //       console.error(`❌ Error checking boarding for ${name}:`, err.message);
// //     }
// //   };

// //   // ⏲️ Step 3: Schedule or send immediately
// //   if (delay <= 0) {
// //     console.log("⚠️ bufferEnd already passed. Sending check immediately.");
// //     await sendIfStillNotBoarded();
// //   } else {
// //     console.log(`⏳ Scheduling check in ${delay / 1000}s`);
// //     setTimeout(sendIfStillNotBoarded, delay);
// //   }
// // };

// // 🔧 Utility to convert milliseconds to human-readable time

// export const scheduleBufferEndNotification = async (passenger, bufferEnd) => {
//   console.log("📦 [Step 0] Scheduling bufferEnd notification...");

//   const phoneNumber = passenger?.Employee_PhoneNumber;
//   const name = passenger?.Employee_Name;

//   // ✅ Step 1: Validate inputs
//   if (
//     !phoneNumber ||
//     !name ||
//     !bufferEnd ||
//     isNaN(new Date(bufferEnd).getTime())
//   ) {
//     console.warn(
//       `❌ Invalid input. name=${name}, phone=${phoneNumber}, bufferEnd=${bufferEnd}`
//     );
//     return;
//   }

//   const now = new Date();
//   const sendTime = new Date(bufferEnd);
//   const delay = sendTime.getTime() - now.getTime();

//   const { hours, minutes, seconds } = convertMillisecondsToTimeBufferEnd(delay);
//   console.log(`📅 bufferEnd for ${name}: ${sendTime.toISOString()}`);
//   console.log(
//     `⏳ Notification in: ${hours}h ${minutes}m ${seconds}s (${delay}ms)`
//   );

//   // 🔄 Step 2: Function to run at bufferEnd
//   const sendIfStillNotBoarded = async () => {
//     try {
//       console.log(`🔍 Checking if ${name} (${phoneNumber}) has boarded...`);

//       const journey = await Journey.findOne({
//         Journey_Type: { $regex: /^pickup$/, $options: "i" },
//       })
//         .sort({ createdAt: -1 })
//         .populate("Driver", "phoneNumber")
//         .populate({
//           path: "Asset",
//           select: "passengers",
//           populate: {
//             path: "passengers.passengers.passenger",
//             model: "Passenger",
//             select: "Employee_Name Employee_PhoneNumber",
//           },
//         })
//         .populate("boardedPassengers.passenger", "Employee_PhoneNumber");

//       if (!journey) {
//         console.warn(`❌ No journey found.`);
//         return;
//       }

//       const driverPhoneNumber = journey?.Driver?.phoneNumber;
//       console.log("🚗 Driver phone number:", driverPhoneNumber);

//       const passengerAssigned = journey?.Asset?.passengers?.some((shift) =>
//         shift.passengers.some(
//           (p) => p.passenger?._id?.toString() === passenger._id?.toString()
//         )
//       );

//       if (!passengerAssigned) {
//         console.warn(`❌ Passenger not assigned to journey asset.`);
//         return;
//       }

//       const hasBoarded = journey.boardedPassengers?.some(
//         (bp) => bp.passenger?._id?.toString() === passenger._id?.toString()
//       );

//       if (!hasBoarded) {
//         console.log(`📨 Passenger ${name} NOT boarded. Sending messages...`);

//         // Step 1: Notify passenger
//         await sendTemplateMoveCab(phoneNumber, name);
//         console.log(`✅ Passenger message sent to ${phoneNumber}`);

//         // Step 2: Notify driver
//         if (!driverPhoneNumber || driverPhoneNumber.length < 10) {
//           console.warn(
//             `⚠️ Driver phone number invalid or missing: ${driverPhoneNumber}`
//           );
//         } else {
//           try {
//             const message =
//               "⚠️ The passenger is late. You can move the cab now.";
//             await sendWhatsAppMessage(driverPhoneNumber, message);
//             console.log(`✅ Driver notified at ${driverPhoneNumber}`);
//           } catch (err) {
//             console.error(
//               "❌ Failed to send message to driver:",
//               err.response?.data || err.message
//             );
//           }
//         }

//         // ✅ Step 3: Notify other passengers ONLY if bufferEnd is NOT yet finished
//         const currentTime = Date.now();
//         // const bufferEndTime = new Date(bufferEnd).getTime();
//         const bufferEndTime =
//           bufferEnd instanceof Date
//             ? bufferEnd.getTime()
//             : new Date(bufferEnd).getTime();

//         if (!Number.isFinite(bufferEndTime)) {
//           throw new Error(`Invalid bufferEnd value: ${bufferEnd}`);
//         }
//         console.log("ye hai current", currentTime );
//         console.log("ye hai bufferEndTime", bufferEndTime );


//         if (currentTime < bufferEndTime) {
//           console.log(
//             `📨 bufferEnd still active — notifying other passengers...`
//           );

//           const shiftGroup = journey.Asset?.passengers?.find((shift) =>
//             shift.passengers.some(
//               (p) => p.passenger?._id?.toString() === passenger._id?.toString()
//             )
//           );

//           if (shiftGroup) {
//             for (const shiftP of shiftGroup.passengers) {
//               const otherPassenger = shiftP.passenger;

//               if (
//                 otherPassenger &&
//                 otherPassenger._id?.toString() !== passenger._id?.toString()
//               ) {
//                 try {
//                   await sendPassengerUpdate(
//                     {
//                       body: {
//                         phoneNumber: otherPassenger.Employee_PhoneNumber,
//                         name: otherPassenger.Employee_Name,
//                       },
//                     },
//                     {
//                       status: () => ({
//                         json: () => {},
//                       }),
//                     }
//                   );

//                   console.log(
//                     `📤 Notified ${otherPassenger.Employee_Name} that ${passenger.Employee_Name} missed the cab.`
//                   );
//                 } catch (err) {
//                   console.error(
//                     `❌ Failed to notify ${otherPassenger.Employee_Name} about ${passenger.Employee_Name}:`,
//                     err.message
//                   );
//                 }
//               }
//             }
//           } else {
//             console.warn(
//               `⚠️ Shift group not found for ${passenger.Employee_Name}`
//             );
//           }
//         } else {
//           console.log(
//             `⏩ Skipping notification to other passengers — bufferEnd has passed.`
//           );
//         }
//       } else {
//         console.log(
//           `🛑 Passenger ${name} already boarded. No reminder needed.`
//         );
//       }
//     } catch (err) {
//       console.error(`❌ Error checking boarding for ${name}:`, err.message);
//     }
//   };

//   // ⏲️ Step 3: Schedule or send immediately
//   if (delay <= 0) {
//     console.log("⚠️ bufferEnd already passed. Sending check immediately.");
//     await sendIfStillNotBoarded();
//   } else {
//     console.log(`⏳ Scheduling check in ${delay / 1000}s`);
//     setTimeout(sendIfStillNotBoarded, delay);
//   }
// };

// // 🔧 Utility to convert milliseconds to human-readable time
// function convertMillisecondsToTimeBufferEnd(ms) {
//   const totalSeconds = Math.floor(ms / 1000);
//   const hours = Math.floor(totalSeconds / 3600);
//   const minutes = Math.floor((totalSeconds % 3600) / 60);
//   const seconds = totalSeconds % 60;
//   return { hours, minutes, seconds };
// }

// //update other passener wehn cab has moved

// export const sendPassengerUpdate = async (req, res) => {
//   const { phoneNumber, name } = req.body;

//   if (!phoneNumber || !name) {
//     return res.status(400).json({ error: "phoneNumber and name are required" });
//   }

//   try {
//     const result = await updateOtherPassenger(phoneNumber, name);
//     return res
//       .status(200)
//       .json({ message: "Message sent successfully", result });
//   } catch (error) {
//     console.error("Controller Error:", error.message);
//     return res.status(500).json({ error: "Failed to send message" });
//   }
// };







import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";
import { sendPickupTemplateBefore10Min } from "../utils/sendTempleteBeforeTenMinites.js";
import { sendTemplateMoveCab } from "../utils/sendTemplateMoveCab.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";
 
export const sendPickupConfirmation = async (req, res) => {
  try {
    const { pickedPassengerPhoneNumber } = req.body;
    if (!pickedPassengerPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: "pickedPassengerPhoneNumber is required.",
      });
    }
 
    const cleanedPhone = pickedPassengerPhoneNumber.replace(/\D/g, "");
    if (!/^91\d{10}$/.test(cleanedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Indian phone number format.",
      });
    }
 
    const asset = await Asset.findOne({
      "passengers.passengers.passenger": { $exists: true },
    }).populate({
      path: "passengers.passengers.passenger",
      select: "Employee_PhoneNumber Employee_Name",
    });
    if (!asset) {
      return res
        .status(404)
        .json({ success: false, message: "Asset not found." });
    }
 
    let pickedPassenger = null;
    let currentShiftPassengers = [];
    for (const shift of asset.passengers) {
      const match = shift.passengers.find(
        (sp) =>
          sp.passenger?.Employee_PhoneNumber?.replace(/\D/g, "") ===
          cleanedPhone
      );
      if (match) {
        pickedPassenger = match.passenger;
        currentShiftPassengers = shift.passengers.map((sp) => sp.passenger);
        break;
      }
    }
    if (!pickedPassenger) {
      return res.status(404).json({
        success: false,
        message: "Picked passenger not found in asset.",
      });
    }
 
    const journey = await Journey.findOne({ Asset: asset._id })
      .sort({ createdAt: -1 })
      .populate({
        path: "boardedPassengers.passenger",
        select: "Employee_PhoneNumber Employee_Name",
      });
    if (!journey) {
      return res
        .status(404)
        .json({ success: false, message: "No journey found for asset." });
    }
 
    const alreadyBoarded = journey.boardedPassengers.some(
      (bp) =>
        (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "") ===
        cleanedPhone
    );
    if (alreadyBoarded) {
      return res
        .status(400)
        .json({ success: false, message: "Passenger already boarded." });
    }
 
    journey.boardedPassengers.push({ passenger: pickedPassenger._id });
    await journey.save();
 
    const confirmation = await sendPickupConfirmationMessage(
      pickedPassenger.Employee_PhoneNumber,
      pickedPassenger.Employee_Name
    );
 
    const boardedSet = new Set(
      journey.boardedPassengers
        .map((bp) => bp.passenger.Employee_PhoneNumber || "")
        .map((num) => num.replace(/\D/g, ""))
    );
    boardedSet.add(cleanedPhone);
 
    const notifiedPassengers = [];
    for (const p of currentShiftPassengers) {
      if (!p?.Employee_PhoneNumber) continue;
      const phoneClean = p.Employee_PhoneNumber.replace(/\D/g, "");
      if (boardedSet.has(phoneClean)) continue;
 
      const notify = await sendOtherPassengerSameShiftUpdateMessage(
        p.Employee_PhoneNumber,
        p.Employee_Name
      );
      notifiedPassengers.push({
        name: p.Employee_Name,
        phone: p.Employee_PhoneNumber,
        success: notify.success,
        error: notify.error || null,
      });
    }
 
    return res.status(200).json({
      success: true,
      message:
        "Confirmation sent to picked passenger; unboarded shift-mates updated.",
      pickedPassenger: {
        name: pickedPassenger.Employee_Name,
        phone: pickedPassenger.Employee_PhoneNumber,
        confirmation,
      },
      notifiedPassengers,
      boardedCount: journey.boardedPassengers.length,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
 
// export const schedulePickupNotification = async (passenger, bufferStart) => {
//   const phoneNumber = passenger?.Employee_PhoneNumber;
//   const name = passenger?.Employee_Name;
 
//   if (
//     !phoneNumber ||
//     !name ||
//     !bufferStart ||
//     isNaN(new Date(bufferStart).getTime())
//   ) {
//     return;
//   }
 
//   const templateName = "pick_up_passenger_notification_before_10_minutes__";
//   const broadcastName = `pick_up_passenger_notification_before_10_minutes___${formatBroadcastName(
//     bufferStart
//   )}`;
 
//   const pickupDate = new Date(bufferStart);
//   const sendTime = new Date(pickupDate.getTime() - 10 * 60 * 1000);
//   const delay = sendTime.getTime() - Date.now();
 
//   if (delay <= 0) {
//     await sendPickupTemplateBefore10Min(
//       phoneNumber,
//       name,
//       templateName,
//       broadcastName
//     );
//     return;
//   }
 
//   setTimeout(async () => {
//     await sendPickupTemplateBefore10Min(
//       phoneNumber,
//       name,
//       templateName,
//       broadcastName
//     );
//   }, delay);
// };
 

//correct

// export const schedulePickupNotification = async (passenger, bufferStart) => {
//   const phoneNumber = passenger?.Employee_PhoneNumber;
//   const name = passenger?.Employee_Name;
 
//   if (
//     !phoneNumber ||
//     !name ||
//     !bufferStart ||
//     isNaN(new Date(bufferStart).getTime())
//   ) {
//     return;
//   }
 
//   const templateName = "pick_up_passenger_notification_before_10_minutes__";
//   const broadcastName = `pick_up_passenger_notification_before_10_minutes___${formatBroadcastName(
//     bufferStart
//   )}`;
 
//   const pickupDate = new Date(bufferStart);
//   const sendTime = new Date(pickupDate.getTime() - 10 * 60 * 1000);
//   const scheduledAt = sendTime.toISOString();
 
//   try {
//     const result = await sendPickupTemplateBefore10Min(
//       phoneNumber,
//       name,
//       templateName,
//       broadcastName,
//       scheduledAt
//     );
//     return result;
//   } catch (err) {
//     console.error("Failed to schedule pickup notification:", err);
//     throw err;
//   }
// };
 

export const schedulePickupNotification = async (passenger, bufferStart) => {
  const phoneNumber = passenger?.Employee_PhoneNumber;
  const name = passenger?.Employee_Name;
 
  if (
    !phoneNumber ||
    !name ||
    !bufferStart ||
    isNaN(new Date(bufferStart).getTime())
  ) {
    return;
  }
 
  const firstRaw = String(name).trim().split(/\s+/)[0] || name;
  const templateName = "pick_up_passenger_notification_before_10_minutes__";
  const pickupDate = new Date(bufferStart);
  const now = new Date();
  const deltaMs = pickupDate.getTime() - now.getTime();
  let scheduledAt;
  if (deltaMs > 10 * 60 * 1000) {
    scheduledAt = new Date(pickupDate.getTime() - 10 * 60 * 1000).toISOString();
  } else if (deltaMs > 0) {
    scheduledAt = new Date().toISOString();
  } else {
    return;
  }
  const broadcastName = `pick_up_passenger_notification_before_10_minutes___${formatBroadcastName(
    bufferStart
  )}`;
 
  try {
    return await sendPickupTemplateBefore10Min( phoneNumber, firstRaw, templateName, broadcastName, scheduledAt );
  } catch (err) {
    console.error("Failed to schedule pickup notification:", err);
    throw err;
  } };
 






function formatBroadcastName(pickupTime) {
  const dt = new Date(pickupTime);
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();
  const hour = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  return `${day}${month}${year}${hour}${min}`;
}


 
export const scheduleBufferEndNotification = async (passenger, bufferEnd) => {
  const phoneNumber = passenger?.Employee_PhoneNumber;
  const name = passenger?.Employee_Name;
 
  if (
    !phoneNumber ||
    !name ||
    !bufferEnd ||
    isNaN(new Date(bufferEnd).getTime())
  ) {
    return;
  }
 
  const now = new Date();
  const sendTime = new Date(bufferEnd);
  const delay = sendTime.getTime() - now.getTime();
 
  const sendIfStillNotBoarded = async () => {
    const journey = await Journey.findOne({
      Journey_Type: { $regex: /^pickup$/, $options: "i" },
    })
      .sort({ createdAt: -1 })
      .populate("Driver", "phoneNumber")
      .populate({
        path: "Asset",
        select: "passengers",
        populate: {
          path: "passengers.passengers.passenger",
          model: "Passenger",
          select: "Employee_Name Employee_PhoneNumber",
        },
      })
      .populate("boardedPassengers.passenger", "Employee_PhoneNumber");
 
    if (!journey) return;
 
    const driverPhoneNumber = journey.Driver?.phoneNumber;
    const shift = journey.Asset.passengers.find(s =>
      s.passengers.some(p => p.passenger._id.equals(passenger._id))
    );
    if (!shift) return;
    const hasBoarded = journey.boardedPassengers.some(bp =>
      bp.passenger._id.equals(passenger._id)
    );
    if (hasBoarded) return;
    await sendTemplateMoveCab(phoneNumber, name);
    if (driverPhoneNumber?.length >= 10) {
      await sendWhatsAppMessage(
        driverPhoneNumber,
        "⚠️ The passenger is late. You can move the cab now."
      );
    }
    const nowInner = new Date();
    const boardedIds = new Set(
      journey.boardedPassengers.map(bp => bp.passenger._id.toString())
    );
 
    for (const shiftPassenger of shift.passengers) {
      const pDoc = shiftPassenger.passenger;
      const pIdStr = pDoc._id.toString();
      if (pIdStr === passenger._id.toString()) continue;
      if (boardedIds.has(pIdStr)) continue;
      const bufEnd = shiftPassenger.bufferEnd
        ? new Date(shiftPassenger.bufferEnd)
        : null;
      if (!bufEnd || bufEnd.getTime() <= nowInner.getTime()) continue;
      await sendOtherPassengerSameShiftUpdateMessage(
        pDoc.Employee_PhoneNumber,
        pDoc.Employee_Name
      );
    }
  };
  if (delay <= 0) {
    await sendIfStillNotBoarded();
  } else {
    setTimeout(sendIfStillNotBoarded, delay);
  }
};
 
 