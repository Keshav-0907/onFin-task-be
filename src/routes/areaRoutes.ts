import express from 'express';
import { servedArea, areaStats, getAllAreas, getSalaries, getRentPrice, servedAreaWithData } from '../controllers/areaControllers';

const areaRouter = express.Router();

areaRouter.get('/allAreas', getAllAreas as any);
areaRouter.get('/served', servedArea);
areaRouter.get('/area-stats/:pinCode', areaStats as any);
areaRouter.get('/servedArea-with-data', servedAreaWithData);


areaRouter.post('/getSalary', getSalaries as any);
areaRouter.post('/getRentPrice', getRentPrice as any);

export default areaRouter;