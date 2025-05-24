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
dotenv_1.default.config();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
const aiChat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    var _d, _e, _f;
    try {
        const { message, pinCode, chatHistory = [] } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        const allAreas = areas_json_1.default.map((_a) => {
            var { geometry } = _a, rest = __rest(_a, ["geometry"]);
            return rest;
        });
        let systemPrompt = `
You are an assistant for the Bengaluru Area Dashboard. Your job is to help users understand locality-based insights.
- Do **not** refer to the information as "data", "structured format", or "JSON".
- Always speak in a clear, conversational tone.
- When describing locations, **use locality names** (like Koramangala, Whitefield), not pin codes unless the user explicitly asks for a pin code.
- Your responses should be insightful, context-aware, and tailored to Bengaluru's localities.
- Keep the space and character limits in mind, ensuring responses are concise yet informative.
`;
        let contextMessage = '';
        if (pinCode) {
            const areaStats = stats_json_1.default.find(area => Number(area.pinCode) === Number(pinCode));
            if (!areaStats) {
                return res.status(400).json({ error: 'Invalid Pin Code' });
            }
            contextMessage = `Area Stats for Pin Code ${pinCode}:\n${JSON.stringify(areaStats)}\n\nOther Area Details:\n${JSON.stringify(allAreas)}`;
        }
        else {
            contextMessage = `Complete Area Details:\n${JSON.stringify(allAreas)}`;
        }
        // response stream strts here
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
            { role: 'user', content: message },
        ];
        const completion = yield openai.chat.completions.create({
            model: 'gpt-4',
            stream: true,
            messages: openaiMessages,
            max_tokens: 500,
        });
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
    }
    catch (error) {
        console.error('Error in aiChat:', error);
        try {
            res.write(`data: [ERROR]\n\n`);
            res.end();
        }
        catch (_h) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
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
    const systemPrompt = `
  Summarise the following chat history within 30 words. Provide a concise summary of the conversation, highlighting key points and any important information.`;
    const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map((chat) => ({
            role: chat.writer === 'user' ? 'user' : 'assistant',
            content: chat.message,
        })),
    ];
    const completion = yield openai.chat.completions.create({
        model: 'gpt-4',
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
