import AllAreas from '../data/areas.json';
import Stats from '../data/stats.json';
import OpenAI from 'openai';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import { AiChatRequest, SummariseChatHistoryRequest, SummariseChatHistoryResponse } from '../types';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import LockedAreas from '../data/lockedArea.json';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const aiChat = async (req: Request<{}, {}, AiChatRequest>, res: Response) => {
  try {
    const { message, pinCode, chatHistory = [], summary } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const allAreas = AllAreas.map(({ geometry, ...rest }) => rest);
    const normalizedAreas = allAreas.map((area) => ({
      ...area,
      nameLower: area.name.toLowerCase(),
    }));
    const servedAreaStats = Object.fromEntries(Stats.map((stat: any) => [stat.pinCode, stat]));
    const lockedAreaStats = Object.fromEntries(
      LockedAreas.map((stat: any) => [stat.pinCode, stat])
    );

    const getStatsForArea = (area: typeof allAreas[0]) =>     
      area.isServed ? servedAreaStats[area.pinCode] : lockedAreaStats[area.pinCode];

    const findArea = (name: string) =>
      normalizedAreas.find((a) => a.nameLower === name.toLowerCase());

    const extractLocalities = (msg: string): string[] => {
      const keywords = normalizedAreas.map((a) => a.nameLower);
      return keywords.filter((kw) => msg.toLowerCase().includes(kw));
    };

    const mentionPattern = /@([\w\s]+)\/([\w]+)/g;
    const matches = [...message.matchAll(mentionPattern)];

    let enrichedMentions = '';
    for (const [, rawLocality, metric] of matches) {
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

      const value = stat[metric as keyof typeof stat];
      enrichedMentions += `Metric for ${area.name} – ${metric}: ${typeof value === 'object' ? JSON.stringify(value) : value
        }\n`;
    }

    const inferredLocalities = extractLocalities(message);
    const relevantStats = inferredLocalities
      .map(findArea)
      .filter(Boolean)
      .map((area) => {
        const stat = getStatsForArea(area!);           

        if (area!.isServed && stat) {
          const utilisation =
            (stat.dailyOrders?.reduce((acc: number, d: any) => acc + d.orders, 0) ??
              0) /
            (stat.dailyCapacity || 1);

            const totalOrders = stat.dailyOrders?.reduce((acc: number, d: any) => acc + d.orders, 0) ?? 0;

          return {
            name: area!.name,
            pinCode: area!.pinCode,
            isServed: true,
            stats: {
              capacity: stat.dailyCapacity ?? 0,
              totalOrders: totalOrders,
              avgDeliveryTime: stat.avgDeliveryTime ?? 0,
              deliveryDelay: stat.deliveryDelay ?? 0,
              utilisationRate: utilisation.toFixed(2),
            },
          };
        }

        if (!area!.isServed && stat) {
          const { populationDensity, medianHouseholdIncome, purchasingPower } = stat;
          return {
            name: area!.name,
            pinCode: area!.pinCode,
            isServed: false,
            stats: {
              populationDensity,
              medianHouseholdIncome,
              purchasingPower,
            },
          };
        }

        return {
          name: area!.name,
          pinCode: area!.pinCode,
          isServed: area!.isServed,
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

    const openaiMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextMessage },
      ...chatHistory.map((chat): ChatCompletionMessageParam => ({
        role: chat.writer === 'user' ? 'user' : 'assistant',
        content: chat.message,
      })),
      { role: 'system', content: summary || 'You are an AI assistant that provides area-specific insights in Bengaluru.' },
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      stream: true,
      messages: openaiMessages,
      max_tokens: 500,
    });

    console.log('completion', completion);


    for await (const chunk of completion) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        res.write(`data: ${content}\n\n`);
      }
    }

    res.end();
  } catch (error) {
    console.error('Error in aiChat:', error);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
    }
    res.status(500).json({
      success: false,
      message: 'Something went wrong processing your request.',
    });
  }
};

const summariseChatHistory = async (req: Request<SummariseChatHistoryRequest>, res: Response<SummariseChatHistoryResponse>) => {
  const { chatHistory } = req.body;

  if (!chatHistory || chatHistory.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Chat history is required'
    });
  }

  const enrichedLocalityList = AllAreas.map(({ geometry, ...rest }) => rest.name).join(', ');



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
    ...chatHistory.map((chat: { writer: string; message: string }) => ({
      role: chat.writer === 'user' ? 'user' : 'assistant',
      content: chat.message,
    })),
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages,
    max_tokens: 1000,
  })

  const summary = completion.choices[0].message.content;

  if (!summary) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate summary'
    })
  }

  try {

    return res.status(200).json({
      summary,
      success: true,
      message: 'Chat history summarised successfully',
    })
  } catch (error) {
    console.error('Error in summariseChatHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
}

export { aiChat, summariseChatHistory };
