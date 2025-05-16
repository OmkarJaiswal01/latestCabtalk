import express from "express";
import {
  createSOS,
  getSOS,
  resolveSOS,
  getSOSByID,
  transferPassengersForSos,
} from "../controllers/sosController.js";
const router = express.Router();
router.post("/", createSOS);
router.get("/", getSOS);
router.get("/:id", getSOSByID);
router.post("/:id/transfer", transferPassengersForSos);
router.put("/:id/resolve", resolveSOS);
export default router;