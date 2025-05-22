import express from 'express';
import { servedArea, areaStats, getAllAreas } from '../controllers/areaControllers';

const areaRouter = express.Router();

areaRouter.get('/allAreas', getAllAreas);
areaRouter.get('/served', servedArea);
areaRouter.get('/area-stats/:pinCode', areaStats);
// areaRouter.get('/locked-area/:pinCode', getWikiSummary);

export default areaRouter;