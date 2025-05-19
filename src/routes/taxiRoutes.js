import express from "express";
import { createTaxi, getAllTaxis, notifyTaxiDriver } from "../controllers/taxiController.js";

const router = express.Router();

router.post("/:id/assign-taxi", createTaxi);
router.get("/taxi", getAllTaxis);

// New route to notify latest taxi driver via WhatsApp
router.post("/notify-taxi-driver/:sosId", notifyTaxiDriver);

export default router;