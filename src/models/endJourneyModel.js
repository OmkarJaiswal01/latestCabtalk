import mongoose from "mongoose";
import { getNextSequence } from "./counterModel.js";
const boardingEventSchema = new mongoose.Schema(
  {
    passenger: { type: mongoose.Schema.Types.ObjectId, ref: "Passenger", required: true },
    boardedAt: { type: Date, required: true }
  },
  { _id: false }
);
const endJourneySchema = new mongoose.Schema(
  {
    shortId: { type: String, unique: true },
    JourneyId: { type: mongoose.Schema.Types.ObjectId, ref: "Journey", required: true, index: true },
    Driver:    { type: mongoose.Schema.Types.ObjectId, ref: "Driver",  required: true },
    Asset:     { type: mongoose.Schema.Types.ObjectId, ref: "Asset",   required: true },
    Journey_Type: { type: String, required: true },
    Occupancy:    { type: Number, required: true },
    hadSOS:       { type: Boolean, default: false },
    startedAt:    { type: Date, required: true },
    endedAt:      { type: Date, default: Date.now },
    boardedPassengers:    { type: [boardingEventSchema], default: [] },
    processedWebhookEvents:{ type: [String], default: [] }
  },
  { timestamps: true }
);
endJourneySchema.pre("save", async function (next) {
  if (!this.shortId) {
    const seq = await getNextSequence("EndJourney");
    this.shortId = `JRN-${String(seq).padStart(3, "0")}`;
  }
  next();
});
export default mongoose.model("EndJourney", endJourneySchema, "endjourneys");