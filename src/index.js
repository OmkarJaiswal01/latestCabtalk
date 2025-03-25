import dotenv from "dotenv";
import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import driverRoutes from "./routes/driverRoutes.js";
import passengerRoutes from "./routes/passengerRoutes.js";
import assetRoutes from "./routes/assetRoutes.js";
import journeyRoutes from "./routes/journeyRoutes.js";
import endJourneyRoutes from "./routes/endJourneyRoutes.js";
import sosRoutes from "./routes/sosRoutes.js";

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN, methods: ["GET", "POST"],
  },});

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

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });});
app.set("io", io);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

mongoose.connect(process.env.MONGODB_URI).then((connection) => {
    console.log(`MongoDB connected on host: ${connection.connection.host}`);
    server.listen(process.env.PORT, () => {
      console.log(`🚀 Server is running at port: ${process.env.PORT}`);
    });
  }).catch((error) => {
    console.error("MongoDB connection failed:", error);  process.exit(1); });