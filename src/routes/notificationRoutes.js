import express from "express";
import { sendPickupConfirmation } from "../controllers/pickupNotificationController.js";
import { sendDropConfirmation } from "../controllers/dropConfirmationPassenger.js";
const router = express.Router();
router.post("/confirm-pickup", sendPickupConfirmation);
router.post("/send-drop-con",sendDropConfirmation)
export default router;