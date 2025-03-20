import mongoose from "mongoose";
const sosSchema = new mongoose.Schema(
  {
    user_type: { type: String, enum: ["Driver", "Passenger"], required: true },
    phone_no: { type: String, required: true },
    sos_type: { type: String, required: true },
    status: { type: String, enum: ["pending", "resolved"], default: "pending" },
    userDetails: {
      name: { type: String, default: "" },
      vehicle_no: { type: String, default: "" },
      assetId: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", default: null }
    } },
  { timestamps: true }
);
const SOS = mongoose.model("SOS", sosSchema);
export default SOS;