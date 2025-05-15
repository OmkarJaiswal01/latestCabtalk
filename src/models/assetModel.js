import mongoose from "mongoose";
import { getNextSequence } from "./counterModel.js";
const assetSchema = new mongoose.Schema(
  {
    shortId:   { type: String, unique: true },
    driver:    { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    capacity:  { type: Number, required: true },
    passengers:[{ type: mongoose.Schema.Types.ObjectId, ref: "Passenger" }],
    isActive:  { type: Boolean, default: false },
  },
  { timestamps: true }
);
assetSchema.pre("save", async function (next) {
  if (!this.shortId) {
    const seq = await getNextSequence("Asset");
    this.shortId = `AST-${String(seq).padStart(3, "0")}`;
  }
  next();
});
export default mongoose.model("Asset", assetSchema);