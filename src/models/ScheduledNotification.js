// import mongoose from 'mongoose';

// const scheduledNotificationSchema = new mongoose.Schema({
//   passengerId: mongoose.Schema.Types.ObjectId,
//   name: String,
//   phoneNumber: String,
//   templateName: String,
//   broadcastName: String,
//   scheduledTime: Date,
//   status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
//   createdAt: { type: Date, default: Date.now },
//   sentAt: Date
// });

// scheduledNotificationSchema.index({ scheduledTime: 1, status: 1 });

// export default mongoose.model('ScheduledNotification', scheduledNotificationSchema);
