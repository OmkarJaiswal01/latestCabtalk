import mongoose from "mongoose";

const TaxiSchema = new mongoose.Schema(
  {
    taxiDriverName: { type: String, required: true },
    taxiDriverNumber: { type: String, required: true },  // phone number field name consistent here
    taxiVehicleNumber: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Taxi", TaxiSchema);
