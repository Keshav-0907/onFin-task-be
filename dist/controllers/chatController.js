"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.summariseChatHistory = exports.aiChat = void 0;
const areas_json_1 = __importDefault(require("../data/areas.json"));
const stats_json_1 = __importDefault(require("../data/stats.json"));
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const lockedArea_json_1 = __importDefault(require("../data/lockedArea.json"));
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
dotenv_1.default.config();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
const aiChat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    var _d, _e, _f;
    try {
        const { message, pinCode, chatHistory = [], summary } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        const allAreas = areas_json_1.default.map((_a) => {
            var { geometry } = _a, rest = __rest(_a, ["geometry"]);
            return rest;
        });
        const normalizedAreas = allAreas.map((area) => (Object.assign(Object.assign({}, area), { nameLower: area.name.toLowerCase() })));
        const servedAreaStats = Object.fromEntries(stats_json_1.default.map((stat) => [stat.pinCode, stat]));
        const lockedAreaStats = Object.fromEntries(lockedArea_json_1.default.map((stat) => [stat.pinCode, stat]));
        const getStatsForArea = (area) => area.isServed ? servedAreaStats[area.pinCode] : lockedAreaStats[area.pinCode];
        const findArea = (name) => normalizedAreas.find((a) => a.nameLower === name.toLowerCase());
        const extractLocalities = (msg) => {
            const keywords = normalizedAreas.map((a) => a.nameLower);
            return keywords.filter((kw) => msg.toLowerCase().includes(kw));
        };
        const mentionPattern = /@([\w\s]+)\/([\w]+)/g;
        const matches = [...message.matchAll(mentionPattern)];
        let enrichedMentions = '';
        for (const match of matches) {
            const [, rawLocality, metric] = match;
            if (metric === 'AverageSalaries') {
                console.log(`Fetching salaries for ${rawLocality}...`);
                const query = `top+companies+in+${rawLocality}+Bangalore`;
                try {
                    const googleApiRes = yield axios_1.default.get(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${process.env.GOOGLE_API_KEY}`);
                    if (googleApiRes.data.status !== "OK") {
                        enrichedMentions += `❌ Could not fetch companies for ${rawLocality} (Google API error)\n`;
                        continue;
                    }
                    const companyNames = googleApiRes.data.results.map(result => result.name.split(" ").join("-").toLowerCase());
                    const fetchSalaries = companyNames.map((companySlug) => __awaiter(void 0, void 0, void 0, function* () {
                        const url = `https://www.ambitionbox.com/salaries/${companySlug}-salaries/bengaluru-location`;
                        try {
                            const response = yield axios_1.default.get(url, {
                                headers: {
                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                                    "Accept-Language": "en-US,en;q=0.9",
                                },
                            });
                            const $ = cheerio.load(response.data);
                            const salaries = [];
                            $("tr.jobProfiles-table__row").each((_, el) => {
                                const salaryText = $(el).find(".salary-range").text().replace(/\s+/g, " ").trim();
                                const match = salaryText.match(/₹([\d.]+)\s*L\/yr\s*-\s*₹([\d.]+)\s*L\/yr/);
                                if (match) {
                                    const min = parseFloat(match[1]) * 100000;
                                    const max = parseFloat(match[2]) * 100000;
                                    const avg = Math.round((min + max) / 2);
                                    salaries.push(avg);
                                }
                            });
                            return salaries;
                        }
                        catch (err) {
                            console.warn(`⚠️ Skipping ${companySlug}: ${err.message}`);
                            return [];
                        }
                    }));
                    const allSalariesArrays = yield Promise.all(fetchSalaries);
                    const allSalaries = allSalariesArrays.flat();
                    console.log(`Found ${allSalaries.length} salary entries for ${rawLocality}`);
                    if (allSalaries.length === 0) {
                        enrichedMentions += `❌ No salary data found for companies in ${rawLocality}\n`;
                        console.log(`No salary data found for companies in ${rawLocality}`);
                    }
                    else {
                        const avgSalary = Math.round(allSalaries.reduce((a, b) => a + b, 0) / allSalaries.length);
                        console.log(`Average salary for ${rawLocality} is ₹${avgSalary.toLocaleString()}`);
                        enrichedMentions += `💼 Average salary for ${rawLocality} is ₹${avgSalary.toLocaleString()} / year\n`;
                    }
                }
                catch (error) {
                    console.error(`Error during salary fetch for ${rawLocality}:`, error.message);
                    console.log(`❌ Failed to fetch salary info for ${rawLocality}`);
                    enrichedMentions += `❌ Failed to fetch salary info for ${rawLocality}\n`;
                }
                continue;
            }
            if (metric === 'AverageRentPrice') {
                const fetchProperties = yield axios_1.default.post("https://swrapi.sowerent.com/api/v1/website/property/listings", {
                    pageSize: 100,
                    pageNo: 1,
                    locations: [rawLocality],
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
                });
                const properties = fetchProperties.data.result;
                if (!properties || properties.length === 0) {
                    console.log(`No rent prices found for ${rawLocality}`);
                    enrichedMentions += `No rent prices found for ${rawLocality}\n`;
                    continue;
                }
                const totalRent = properties.reduce((sum, property) => {
                    return sum + (property.flatRent || 0);
                }, 0);
                const averageRent = totalRent / properties.length;
                enrichedMentions += `Average rent for ${rawLocality} is ₹${averageRent.toFixed(2)}\n`;
            }
            const area = findArea(rawLocality.trim());
            if (!area) {
                enrichedMentions += `Could not find data for ${rawLocality}\n`;
                continue;
            }
            const stat = getStatsForArea(area);
            if (!stat || !(metric in stat)) {
                enrichedMentions += `No metric "${metric}" found for ${area.name}\n`;
                continue;
            }
            const value = stat[metric];
            enrichedMentions += `Metric for ${area.name} – ${metric}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
        }
        const inferredLocalities = extractLocalities(message);
        const relevantStats = inferredLocalities
            .map(findArea)
            .filter(Boolean)
            .map((area) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const stat = getStatsForArea(area);
            if (area.isServed && stat) {
                const utilisation = ((_b = (_a = stat.dailyOrders) === null || _a === void 0 ? void 0 : _a.reduce((acc, d) => acc + d.orders, 0)) !== null && _b !== void 0 ? _b : 0) /
                    (stat.dailyCapacity || 1);
                const totalOrders = (_d = (_c = stat.dailyOrders) === null || _c === void 0 ? void 0 : _c.reduce((acc, d) => acc + d.orders, 0)) !== null && _d !== void 0 ? _d : 0;
                return {
                    name: area.name,
                    pinCode: area.pinCode,
                    isServed: true,
                    stats: {
                        capacity: (_e = stat.dailyCapacity) !== null && _e !== void 0 ? _e : 0,
                        totalOrders: totalOrders,
                        avgDeliveryTime: (_f = stat.avgDeliveryTime) !== null && _f !== void 0 ? _f : 0,
                        deliveryDelay: (_g = stat.deliveryDelay) !== null && _g !== void 0 ? _g : 0,
                        utilisationRate: utilisation.toFixed(2),
                    },
                };
            }
            if (!area.isServed && stat) {
                const { populationDensity, medianHouseholdIncome, purchasingPower } = stat;
                return {
                    name: area.name,
                    pinCode: area.pinCode,
                    isServed: false,
                    stats: {
                        populationDensity,
                        medianHouseholdIncome,
                        purchasingPower,
                    },
                };
            }
            return {
                name: area.name,
                pinCode: area.pinCode,
                isServed: area.isServed,
                stats: {},
            };
        });
        const contextMessage = `Insights on areas mentioned: ${inferredLocalities.join(', ')}\n\n` +
            `Relevant Stats:\n${JSON.stringify(relevantStats, null, 2)}\n\n` +
            `Additional Metrics:\n${enrichedMentions}`;
        const systemPrompt = `
You are “Bengaluru Insights”, the friendly yet data-savvy assistant for the Bengaluru Area Dashboard. Your job is to turn locality metrics into clear, actionable advice on operations, logistics, and business expansion in Bengaluru.

⭐  Core duties
1. Translate numbers into plain English — never expose raw JSON or field names.
2. Compare localities on request (delivery time, total orders, capacity, utilisation rate, distance) and provide an overall recommendation.
3. Flag risk:
   • utilisation ≥ 0.85 → suggest adding capacity or opening a new dark store.  
   • utilisation ≤ 0.40 → note under-use and propose ways to drive demand.
4. Use \\n for new lines to improve readability, especially in bulleted lists and comparisons.
5. If a locality is not served, provide socioeconomic insights (population density, income, purchasing power) to inform business decisions.
6. Keep responses concise, while still being informative.
7. If average **salary** or **rent price** is provided via enriched data, mention it clearly — e.g., “Considering the average salary in Whitefield...”
8. If salary or rent was **asked but not available**, explicitly state that the data could not be fetched for that locality. Avoid guessing.


📋  Conversational rules
• Use the locality’s proper name (Koramangala, Whitefield); only mention pin codes if the user asks.  
• Calculate total orders from daily orders data, if available.
• Refer only to localities present in the dataset. If a place is missing, reply exactly: “Could not find data for [Locality].”  
• Keep the tone crisp, helpful, and non-technical. Avoid terms like “JSON”, “array”, or “schema.”  
• Favour short paragraphs or bulleted lists. Start with the direct answer, then add supporting detail.  
• Respect user preferences and chat history when weighing factors (e.g., delivery speed vs. cost).  
• Distance also matters: if two areas are >8 km apart, highlight potential delivery delays and cost impact.  
• Never fabricate data; if a metric is missing, state that it’s unavailable.

✅  Always include a final recommendation or conclusion in **JSON format** (under a key called \`recommendation\`) when comparing localities.
The conclusion should be directly actionable, based on the metrics provided in the chat history and context message. If its a questions also provide a stong yes / yes/ strong no / no answer in the conclusion.
THe recommendation should be concise and actionable, summarising the key insights from the chat history and context message.
Example:
{
  "recommendation": "Open a new dark store in BTM Layout due to over-utilisation in Yelahanka and long delivery times.",
  "conclusion": "Yelahanka is running at 92% capacity, while BTM Layout is at 40%.",
}

🎯  Internal checklist before replying
✓ Concise answer (≤ 120 words when practical)  
✓ Clear recommendation, if applicable  
✓ Utilisation expressed in plain language (“running at 92% of capacity”)  
✓ All rules above are met
`;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const openaiMessages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contextMessage },
            ...chatHistory.map((chat) => ({
                role: chat.writer === 'user' ? 'user' : 'assistant',
                content: chat.message,
            })),
            { role: 'system', content: summary || 'You are an AI assistant that provides area-specific insights in Bengaluru.' },
            { role: 'user', content: message },
        ];
        const completion = yield openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            stream: true,
            messages: openaiMessages,
            max_tokens: 500,
        });
        console.log('completion', completion);
        try {
            for (var _g = true, completion_1 = __asyncValues(completion), completion_1_1; completion_1_1 = yield completion_1.next(), _a = completion_1_1.done, !_a; _g = true) {
                _c = completion_1_1.value;
                _g = false;
                const chunk = _c;
                const content = (_f = (_e = (_d = chunk.choices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.delta) === null || _f === void 0 ? void 0 : _f.content;
                if (content) {
                    res.write(`data: ${content}\n\n`);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_g && !_a && (_b = completion_1.return)) yield _b.call(completion_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        res.end();
        // return res.status(200).json({
        //   success: true,
        //   message: 'Chat processed successfully',
        // })
    }
    catch (error) {
        console.error('Error in aiChat:', error);
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
        }
        res.status(500).json({
            success: false,
            message: 'Something went wrong processing your request.',
        });
    }
});
exports.aiChat = aiChat;
const summariseChatHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { chatHistory } = req.body;
    if (!chatHistory || chatHistory.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Chat history is required'
        });
    }
    const enrichedLocalityList = areas_json_1.default.map((_a) => {
        var { geometry } = _a, rest = __rest(_a, ["geometry"]);
        return rest.name;
    }).join(', ');
    const systemPrompt = `
You are an assistant summarizing conversations from a dashboard for Bengaluru localities.

Your goal is to:
- Extract **factual and locality-specific insights** based on metrics.
- Reference only these localities: ${enrichedLocalityList}.
- If any mentioned area is **not** in this list, do **not** include it in the summary.
- Emphasize patterns like frequent inquiries about certain metrics or locations.
- Exclude filler, assistant commentary, and suggestions.

Output format: Clean paragraphs or bullet points. No headers or "summary" words.
`;
    const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map((chat) => ({
            role: chat.writer === 'user' ? 'user' : 'assistant',
            content: chat.message,
        })),
    ];
    const completion = yield openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 1000,
    });
    const summary = completion.choices[0].message.content;
    if (!summary) {
        return res.status(500).json({
            success: false,
            message: 'Failed to generate summary'
        });
    }
    try {
        return res.status(200).json({
            summary,
            success: true,
            message: 'Chat history summarised successfully',
        });
    }
    catch (error) {
        console.error('Error in summariseChatHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
});
exports.summariseChatHistory = summariseChatHistory;
