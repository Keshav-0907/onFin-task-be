import express from 'express';
import { servedArea, areaStats, getAllAreas } from '../controllers/areaControllers';

const areaRouter = express.Router();

areaRouter.get('/allAreas', getAllAreas as any);
areaRouter.get('/served', servedArea);
areaRouter.get('/area-stats/:pinCode', areaStats as any);

export default areaRouter;