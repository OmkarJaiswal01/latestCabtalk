import express from "express";
import { addDriver, getAllDrivers, updateDriver } from "../controllers/driverController.js";
const router = express.Router();
router.post("/add", addDriver);
router.get("/all", getAllDrivers);
router.put("/:id", updateDriver);
export default router;