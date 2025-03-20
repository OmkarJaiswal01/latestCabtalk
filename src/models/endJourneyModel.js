import mongoose from "mongoose";
const endJourneySchema = new mongoose.Schema(
  {
    Driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    Asset: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
    Journey_Type: { type: String, required: true },
    Occupancy: { type: Number, required: true },
    endedAt: { type: Date, default: Date.now }, 
  },
  { timestamps: true }
);
export default mongoose.model("EndJourney", endJourneySchema, "endjourneys");