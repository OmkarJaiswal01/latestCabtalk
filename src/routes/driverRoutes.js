import express from "express";
import { addDriver, getAllDrivers } from "../controllers/driverController.js";
const router = express.Router();
router.post("/add", addDriver);
router.get("/all", getAllDrivers);
export default router;
