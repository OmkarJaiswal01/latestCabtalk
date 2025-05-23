import express from "express";
import {
  addAsset,
  getAllAssets,
  addPassengerToAsset,
  removePassengerFromAsset,
  updateAsset,
  deleteAsset,
  getAvailableAssets,
 
  removeMultiplePassengersFromAsset,
  addMultiplePassengersToAsset
} from "../controllers/assetController.js";
const router = express.Router();
router.get("/available", getAvailableAssets);
router.post("/add", addAsset);
router.get("/all", getAllAssets);
router.post("/:id/add-passenger", addPassengerToAsset);
router.post("/:id/remove-passenger", removePassengerFromAsset);
router.post("/:id", updateAsset);
router.delete("/:id", deleteAsset);


router.delete("/:id/removeMultiplePassengers", removeMultiplePassengersFromAsset);
router.post("/:id/addMultiplePassengers", addMultiplePassengersToAsset);

export default router;