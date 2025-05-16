import mongoose from "mongoose";
const sosSchema = new mongoose.Schema(
  {
    user_type:  { type: String, enum: ["Driver", "Passenger"], required: true },
    phone_no:   { type: String, required: true },
    sos_type:   { type: String, required: true },
    status:     { type: String, enum: ["pending", "resolved"], default: "pending" },
    asset:      { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
    newAsset:   { type: mongoose.Schema.Types.ObjectId, ref: "Asset" },
    userDetails: {
      name:       { type: String, default: "" },
      vehicle_no: { type: String, default: "" }
    }
  },
  { timestamps: true }
);
export default mongoose.model("SOS", sosSchema);