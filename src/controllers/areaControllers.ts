import AllAreas from '../data/areas.json'
import StatsData from '../data/stats.json'
import LockedAreas from '../data/lockedArea.json'

const getAllAreas = (req, res) => {
    return res.status(200).json(AllAreas)
}

const servedArea = (req, res) => {
    try {
        const served = AllAreas.filter(area => area.isServed === true)
        res.status(200).json(served)
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error })
    }

}

const areaStats = async (req, res) => {
    try {
        const { pinCode } = req.params;
        const areaData = AllAreas.find(area => area.pinCode == pinCode)
        const isLocked = !areaData.isServed;

        if (isLocked) {
            try {
                const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(areaData.name)}`);

                if (response.ok) {
                    const wikiData = await response.json();
                    return res.status(200).json({
                        isLocked: true,
                        pinCode,
                        areaName: areaData.name,
                        area_name: areaData.name,
                        wikiData,
                    });
                } else {
                    const fallBackData = LockedAreas.find(area => area.pinCode == pinCode)
                    if (fallBackData) {
                        return res.status(200).json({
                            isFallback: true,
                            pinCode,
                            areaName: areaData.name,
                            populationDensity: fallBackData.populationDensity,
                            medianHouseholdIncome: fallBackData.medianHouseholdIncome,
                            purchasingPower: fallBackData.purchasingPower,
                        })
                    }
                }
            } catch (error) {
                return res.status(404).json({
                    message: 'Something went wrong',
                })

            }
        }

        if (!areaData) {
            return res.status(404).json({
                message: 'Area not found',
                pinCode
            })
        }
        const areaStats = StatsData.find(area => area.pinCode == pinCode)

        if (!areaStats) {
            return res.status(404).json({
                message: 'Area stats not found',
                pinCode
            })
        }
        return res.status(200).json({
            message : "Area stats found",
            areaName: areaData.name,
            stats: areaStats,
        })



    } catch (error) {
        console.error("Error fetching wiki summary:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}


export { servedArea, areaStats, getAllAreas }
