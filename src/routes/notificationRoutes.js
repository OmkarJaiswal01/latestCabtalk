import express from "express";
import { sendPickupConfirmation } from "../controllers/pickupNotificationController.js";

const router = express.Router();

// Route: POST /api/passenger/confirm-pickup
router.post("/confirm-pickup", sendPickupConfirmation);

export default router;
