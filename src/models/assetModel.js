import mongoose from "mongoose";
const assetSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    capacity: { type: Number, required: true },
    passengers: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Passenger" },
    ],
    isActive: { type: Boolean, default: false },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Taxi" }
  },
  { timestamps: true }
);
export default mongoose.model("Asset", assetSchema);