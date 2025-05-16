import express from "express";
import { replaceCarAndTransferPassengers } from "../controllers/taxiController.js";

const router = express.Router();

// Route to handle car replacement and passenger transfer
// In your Express router (e.g., sosRoutes.js)
router.post("/sos/:id/transfer", replaceCarAndTransferPassengers);


export default router;
