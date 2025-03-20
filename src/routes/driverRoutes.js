import express from "express";
import { addDriver, getAllDrivers } from "../controllers/driverController.js";
import { sendPassengerListToDriverByPhone } from "../controllers/PassListController.js";

const router = express.Router();

router.post("/add", addDriver);
router.get("/all", getAllDrivers);
router.get("/sendPassengerList", sendPassengerListToDriverByPhone);


export default router;
