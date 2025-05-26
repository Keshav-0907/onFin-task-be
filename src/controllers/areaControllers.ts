import AllAreas from '../data/areas.json'
import StatsData from '../data/stats.json'
import LockedAreas from '../data/lockedArea.json'
import { Response, Request } from 'express'
import { AreaStatsRequest, AreaStatsResponse, GetAllAreasResponse, ServedAreaResponse } from '../types'
import * as cheerio from "cheerio";
import axios from "axios";

const getAllAreas = (req: Request, res: Response<GetAllAreasResponse>) => {
    return res.status(200).json({
        success: true,
        message: "All areas fetched successfully",
        data: AllAreas
    });
};

const servedArea = (req: Request, res) => {
    try {
        const allServedAreas = AllAreas
            .filter(area => area.isServed === true)
            .map(({ geometry, ...rest }) => {
                const stats = StatsData.find(stat => Number(stat.pinCode) == rest.pinCode);
                return {
                    ...rest,
                    stats: stats || null
                };
            });

        res.status(200).json({
            success: true,
            message: "Served areas fetched successfully",
            data: allServedAreas
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal server error",
        })
    }
}

const areaStats = async (req: Request<{ pinCode: number }>, res: Response) => {
    try {
        const { pinCode } = req.params;
        const areaData = AllAreas.find(area => area.pinCode == pinCode);

        if (!areaData) {
            return res.status(404).json({
                success: false,
                message: 'Area not found for the given pin code',
            });
        }

        console.log("Area data:", areaData);

        if (areaData.isServed) {
            const areaStats = StatsData.find(stat => stat.pinCode == pinCode);
            return res.status(200).json({
                success: true,
                message: 'Area stats found',
                data: areaStats || {},
            });
        }

        const lockedData = LockedAreas.find(area => area.pinCode == pinCode);

        console.log("Locked data:", lockedData);
        let wikiData = null;

        if (areaData.wiki_name) {
            try {
                const wikiResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(areaData.wiki_name)}`);

                if (wikiResponse.ok) {
                    wikiData = await wikiResponse.json();
                } else {
                    console.warn(`Wikipedia page not found for ${areaData.wiki_name}`);
                }
            } catch (wikiError) {
                console.error("Error fetching wiki summary:", wikiError);
            } pinCode
        }

        return res.status(200).json({
            success: true,
            message: wikiData ? 'Locked area stats and wiki summary found' : 'Locked area stats found (wiki data unavailable)',
            data: {
                isLocked: true,
                pinCode,
                areaName: areaData.name,
                lockedData: lockedData || {},
                wikiData: wikiData || null,
            },
        });

    } catch (error) {
        console.error("Internal server error:", error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

// for getting served and locked areas with their stats -> chat @ functionality
const allDataCombined = (req, res) => {
    const allServedAreas = AllAreas
        .filter(area => area.isServed === true)
        .map(({ geometry, ...rest }) => {
            const stats = StatsData.find(stat => Number(stat.pinCode) === Number(rest.pinCode));
            return {
                ...rest,
                stats: stats || null
            };
        });

    const allLockedAreas = AllAreas
        .filter(area => area.isServed === false)
        .map(({ geometry, ...rest }) => {
            const lockedData = LockedAreas.find(lock => Number(lock.pinCode) === Number(rest.pinCode));
            return {
                ...rest,
                lockedData: lockedData || null
            };
        });

    return res.status(200).json({
        success: true,
        message: "Served and locked areas fetched successfully",
        servedAreas: allServedAreas,
        lockedAreas: allLockedAreas,
    });
};


const getSalaries = async (req, res) => {
    const { pinCode } = req.body;
    const area = AllAreas.find(area => area.pinCode == pinCode)?.name;

    const query = `top+companies+in+${area}+Bangalore`;

    try {
        const googleApiRes = await axios.get(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${process.env.GOOGLE_API_KEY}`
        );

        if (googleApiRes.data.status !== "OK") {
            return res.status(500).json({
                message: "Error fetching data from Google Places API",
            });
        }

        const topCompanies = googleApiRes.data.results.slice(0, 5).map(company => ({
            name: company.name,
            logo: company.icon, 
            address: company.formatted_address || "",
        }));

        const names = googleApiRes.data.results.map(result =>
            result.name.split(" ").join("-")
        );

        const fetchSalaries = names.map(async rawName => {
            const companyName = rawName;
            const URL = `https://www.ambitionbox.com/salaries/${companyName}-salaries/bengaluru-location`;

            try {
                const response = await axios.get(URL, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                });

                const $ = cheerio.load(response.data);
                const roles = [];

                $("tr.jobProfiles-table__row").each((_, element) => {
                    const title = $(element).find(".card-content__company").text().trim();
                    const salaryText = $(element)
                        .find(".salary-range")
                        .text()
                        .replace(/\s+/g, " ")
                        .trim();

                    const match = salaryText.match(/₹([\d.]+)\s*L\/yr\s*-\s*₹([\d.]+)\s*L\/yr/);

                    if (title && match) {
                        const minSalary = Math.round(parseFloat(match[1]) * 100000);
                        const maxSalary = Math.round(parseFloat(match[2]) * 100000);
                        const avgSalary = Math.round((minSalary + maxSalary) / 2);

                        roles.push({ title, avgSalary });
                    }
                });

                return roles;
            } catch {
                return [];
            }
        });

        const allRolesArrays = await Promise.all(fetchSalaries);
        const allRoles = allRolesArrays.flat();

        // Buckets
        const buckets = {
            "0-5LPA": 0,
            "5-10LPA": 0,
            "10-15LPA": 0,
            "15-20LPA": 0,
            "20-25LPA": 0,
            "25-30LPA": 0,
            "30LPA+": 0,
        };

        for (const role of allRoles) {
            const salaryLPA = role.avgSalary / 100000;
            if (salaryLPA <= 5) buckets["0-5LPA"]++;
            else if (salaryLPA <= 10) buckets["5-10LPA"]++;
            else if (salaryLPA <= 15) buckets["10-15LPA"]++;
            else if (salaryLPA <= 20) buckets["15-20LPA"]++;
            else if (salaryLPA <= 25) buckets["20-25LPA"]++;
            else if (salaryLPA <= 30) buckets["25-30LPA"]++;
            else buckets["30LPA+"]++;
        }

        const total = allRoles.length;
        const distribution = {};

        for (const [range, count] of Object.entries(buckets)) {
            distribution[range] = {
                count,
                percentage: total > 0 ? ((count / total) * 100).toFixed(2) + "%" : "0%",
            };
        }

        return res.status(200).json({
            message: "Salary role distribution calculated",
            pinCode,
            area,
            totalRoles: total,
            distribution,
            topCompanies,
            success: true,
        });
    } catch (err) {
        return res.status(500).json({
            message: "Unexpected error while processing",
            error: err.message,
            success: false,
        });
    }
};

const getRentPrice = async (req, res) => {
    const defaultRentBuckets = {
        upto10k: 0,
        "10to20k": 0,
        "20to30k": 0,
        "30to40k": 0,
        above40k: 0,
    };

    try {
        const { pinCode } = req.body;

        if (!pinCode) {
            return res.status(400).json({ message: "Pin code is required" });
        }

        const areaName = AllAreas.find((area) => area.pinCode == pinCode)?.name;

        if (!areaName) {
            return res.status(404).json({
                message: "Area not found for the given pin code",
                rentBuckets: defaultRentBuckets,
                properties: [],
            });
        }

        const fetchProperties = axios.post(
            "https://swrapi.sowerent.com/api/v1/website/property/listings",
            {
                pageSize: 100,
                pageNo: 1,
                locations: [areaName],
                preferredTenants: "",
                budgetFrom: 0,
                budgetTo: 1000000,
                carpetAreaFrom: null,
                carpetAreaTo: null,
                tags: "",
                furnished: "",
                managedBy: "",
                availability: null,
                sortBy: "",
            }
        );

        const [response] = await Promise.all([fetchProperties]);
        const rawProperties = response?.data?.result || [];

        if (rawProperties.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No properties found for the given area",
                areaName,
                rentBuckets: defaultRentBuckets,
                properties: [],
            });
        }

        const properties = rawProperties.map((p, index) => ({
            id: index + 1,
            rent: p.flatRent || 0,
        }));

        const rentBuckets = { ...defaultRentBuckets };

        for (const { rent } of properties) {
            if (rent <= 10000) rentBuckets.upto10k++;
            else if (rent <= 20000) rentBuckets["10to20k"]++;
            else if (rent <= 30000) rentBuckets["20to30k"]++;
            else if (rent <= 40000) rentBuckets["30to40k"]++;
            else rentBuckets.above40k++;
        }

        return res.status(200).json({
            success: true,
            message: "Rent summary fetched successfully",
            areaName,
            rentBuckets,
            properties,
        });
    } catch (error) {
        console.error("Error fetching flat rents:", error.message);
        return res.status(200).json({
            success: false,
            message: "Error occurred while fetching rent data",
            areaName: "Unknown",
            rentBuckets: defaultRentBuckets,
            properties: [],
        });
    }
};



export { servedArea, areaStats, getAllAreas, getSalaries, getRentPrice, allDataCombined }
