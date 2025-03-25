import express from 'express';
import { createJourney, getJourneys, updateOccupancyByDriver} from '../controllers/journeyController.js';
const journeyRoutes = express.Router();
journeyRoutes.use(express.json());
journeyRoutes.post('/journeys', createJourney);
journeyRoutes.get('/journeys', getJourneys)
journeyRoutes.post('/journeys/update', updateOccupancyByDriver);
 
export default journeyRoutes;