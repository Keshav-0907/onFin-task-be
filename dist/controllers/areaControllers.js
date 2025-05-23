"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllAreas = exports.areaStats = exports.servedArea = void 0;
const areas_json_1 = __importDefault(require("../data/areas.json"));
const stats_json_1 = __importDefault(require("../data/stats.json"));
const lockedArea_json_1 = __importDefault(require("../data/lockedArea.json"));
const getAllAreas = (req, res) => {
    return res.status(200).json({
        success: true,
        message: "All areas fetched successfully",
        data: areas_json_1.default
    });
};
exports.getAllAreas = getAllAreas;
const servedArea = (req, res) => {
    try {
        const served = areas_json_1.default.filter(area => area.isServed === true);
        res.status(200).json({
            success: true,
            message: "Served areas fetched successfully",
            data: served
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.servedArea = servedArea;
const areaStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pinCode } = req.params;
        const areaData = areas_json_1.default.find(area => area.pinCode == Number(pinCode));
        if (!areaData) {
            return res.status(404).json({
                success: false,
                message: 'Area not found'
            });
        }
        const isLocked = !areaData.isServed;
        if (isLocked) {
            try {
                const response = yield fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(areaData.name)}`);
                if (response.ok) {
                    const wikiData = yield response.json();
                    return res.status(200).json({
                        data: {
                            isLocked: true,
                            pinCode,
                            areaName: areaData.name,
                            area_name: areaData.name,
                            wikiData,
                        },
                        message: "Area stats found",
                        success: true,
                    });
                }
                else {
                    const fallBackData = lockedArea_json_1.default.find(area => area.pinCode == pinCode);
                    if (fallBackData) {
                        return res.status(200).json({
                            data: {
                                isFallback: true,
                                pinCode,
                                areaName: areaData.name,
                                populationDensity: fallBackData.populationDensity,
                                medianHouseholdIncome: fallBackData.medianHouseholdIncome,
                                purchasingPower: fallBackData.purchasingPower,
                            },
                            message: "Area stats found",
                            success: true,
                        });
                    }
                }
            }
            catch (error) {
                return res.status(404).json({
                    message: 'Something went wrong',
                    success: false,
                });
            }
        }
        if (!areaData) {
            return res.status(404).json({
                message: 'Area not found',
                success: false,
            });
        }
        const areaStats = stats_json_1.default.find(area => area.pinCode == pinCode);
        if (!areaStats) {
            return res.status(404).json({
                message: 'Area stats not found',
                success: false,
            });
        }
        return res.status(200).json({
            message: "Area stats found",
            data: {
                totalOrders: areaStats.totalOrders,
                avgOrderValue: areaStats.avgOrderValue,
                avgDeliveryTime: areaStats.avgDeliveryTime,
                deliveryDelay: areaStats.deliveryDelay,
                dailyOrders: areaStats.dailyOrders,
                appOpensHistory: areaStats.appOpensHistory,
                areaName: areaData.name,
            },
            success: true,
        });
    }
    catch (error) {
        console.error("Error fetching wiki summary:", error);
        return res.status(500).json({
            message: 'Internal server error',
            success: false,
        });
    }
});
exports.areaStats = areaStats;
