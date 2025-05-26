"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const areaControllers_1 = require("../controllers/areaControllers");
const areaRouter = express_1.default.Router();
areaRouter.get('/allAreas', areaControllers_1.getAllAreas);
areaRouter.get('/served', areaControllers_1.servedArea);
areaRouter.get('/area-stats/:pinCode', areaControllers_1.areaStats);
areaRouter.get('/all-data-combined', areaControllers_1.allDataCombined);
areaRouter.post('/getSalary', areaControllers_1.getSalaries);
areaRouter.post('/getRentPrice', areaControllers_1.getRentPrice);
exports.default = areaRouter;
