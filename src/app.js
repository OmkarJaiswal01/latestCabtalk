import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import driverRoutes from "./routes/driverRoutes.js";
import { ApiError } from "./utils/ApiError.js";
import passengerRoutes from "./routes/passengerRoutes.js";
import assetRoutes from "./routes/assetRoutes.js";
import journeyRoutes from "./routes/journeyRoutes.js";
import endJourneyRoutes from "./routes/endJourneyRoutes.js";
import sosRoutes from "./routes/sosRoutes.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

app.use("/api/v1/sos", sosRoutes);
app.use("/api/v1/", passengerRoutes);
app.use("/api/v1/drivers", driverRoutes);
app.use("/api/v1/assets", assetRoutes);
app.use("/api/v1", journeyRoutes);
app.use("/api/v1", endJourneyRoutes);

app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
  } else {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
export { app };