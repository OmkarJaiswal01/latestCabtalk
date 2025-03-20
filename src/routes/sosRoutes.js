import express from "express";
import { createSOS, getSOS, resolveSOS } from "../controllers/sosController.js";
const router = express.Router();
router.post("/", createSOS);
router.get("/", getSOS);
router.put("/:id/resolve", resolveSOS);
export default router;
