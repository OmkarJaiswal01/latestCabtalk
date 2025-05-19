import mongoose from "mongoose";
const assetSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    capacity: { type: Number, required: true },
    passengers: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Passenger" },
    ],
    isActive: { type: Boolean, default: false },
     taxi: { type: mongoose.Schema.Types.ObjectId, ref: "Taxi", required: true },  // new field for taxi info
   
  },
  { timestamps: true }
);
export default mongoose.model("Asset", assetSchema);