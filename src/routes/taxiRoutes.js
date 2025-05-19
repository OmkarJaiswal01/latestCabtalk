import express from "express";
import { createTaxi, getAllTaxis } from "../controllers/taxiController.js";
const router = express.Router();
router.post("/:id/assign-taxi", createTaxi);
router.get("/taxi", getAllTaxis);
export default router;