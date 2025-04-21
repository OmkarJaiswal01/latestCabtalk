import express from "express";
import https from "https";
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
import passengerListRoutes from "./routes/passengerListRoutes.js";

const app = express();
const server = https.createServer(app);
const corsOptions = {
  origin: [
    "https://dashboard-cab.vercel.app",
    "https://cabtalk.globalxperts.net.in"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

const io = new Server(server, { cors: corsOptions });
app.use(cors(corsOptions));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use("/api/v1/sos", sosRoutes);
app.use("/api/v1/", passengerRoutes);
app.use("/api/v1/drivers", driverRoutes);
app.use("/api/v1/assets", assetRoutes);
app.use("/api/v1", journeyRoutes);
app.use("/api/v1", endJourneyRoutes);
app.use("/api/v1/pass", passengerListRoutes);

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});
app.set("io", io);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

const MONGO_URI = "mongodb+srv://vivekverma:vivekvermagxi@gxi.gus9m.mongodb.net/cabDB";

mongoose.connect(MONGO_URI).then((connection) => {
    console.log(`MongoDB connected on host: ${connection.connection.host}`);
    server.listen(5002, "0.0.0.0", () => {
      console.log(`🚀 Server is running at port: 5002`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  });
