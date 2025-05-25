import AllAreas from '../data/areas.json';
import Stats from '../data/stats.json';
import OpenAI from 'openai';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import { AiChatRequest, SummariseChatHistoryRequest, SummariseChatHistoryResponse } from '../types';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

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

    // Remove geometry field
    const allAreas = AllAreas.map(({ geometry, ...rest }) => rest);

    const systemPrompt = `
You are an assistant for the Bengaluru Area Dashboard. Your job is to help users understand locality-based insights.
- Do **not** refer to the information as "data", "structured format", or "JSON".
- Always speak in a clear, conversational tone.
- When describing locations, **use locality names** (like Koramangala, Whitefield), not pin codes unless the user explicitly asks for a pin code.
- Your responses should be insightful, context-aware, and tailored to Bengaluru's localities.
- Keep the space and character limits in mind, ensuring responses are concise yet informative.
If the pincode is available, it's for the active area/locality, consider it when asked. 
`;

    // Normalize area names
    const normalizedAreas = allAreas.map((area) => ({
      ...area,
      nameLower: area.name.toLowerCase(),
    }));

    const statsByPin = Object.fromEntries(Stats.map((stat: any) => [stat.pinCode, stat]));

    // Extract all @locality/metric patterns
    const mentionPattern = /@([\w\s]+)\/([\w]+)/g;
    const matches = [...message.matchAll(mentionPattern)];

    let enrichedMentions = '';
    for (const [, rawLocality, metric] of matches) {
      const locality = rawLocality.trim();
      const area = normalizedAreas.find((a) => a.nameLower === locality.toLowerCase());

      if (!area) {
        enrichedMentions += `Could not find data for ${locality}\n`;
        continue;
      }

      const stat = statsByPin[area.pinCode];
      if (!stat || !(metric in stat)) {
        enrichedMentions += `No metric "${metric}" found for ${locality}\n`;
        continue;
      }

      const value = stat[metric];
      enrichedMentions += `Metric for ${locality} - ${metric}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
    }

    let contextMessage = '';
    if (pinCode) {
      const areaStats = Stats.find((area) => Number(area.pinCode) === Number(pinCode));
      if (!areaStats) {
        return res.status(400).json({ error: 'Invalid Pin Code' });
      }
      contextMessage = `Area Stats for Pin Code ${pinCode}:\n${JSON.stringify(areaStats)}\n\nOther Area Details:\n${JSON.stringify(allAreas)}\n\n${enrichedMentions}`;
    } else {
      contextMessage = `Complete Area Details:\n${JSON.stringify(allAreas)}\n\n${enrichedMentions}`;
    }

    // SSE Headers
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
      { role: 'system', content: summary ? summary : 'You are an AI assistant that provides insights based on user queries about Bengaluru localities.' },
      { role: 'user', content: message },
    ];

    console.log('OpenAI Messages:', openaiMessages);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      stream: true,
      messages: openaiMessages,
      max_tokens: 500,
    });

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
      res.setHeader('Content-Type', 'text/event-stream');
    }
    res.write(`data: [ERROR: Something went wrong processing your request. Please try again.]\n\n`);
    res.end();
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

  const systemPrompt = `
Summarize the following chat history in under 30 words. 
Focus strictly on factual information, key metrics, and user intent. 
Exclude conversational fillers, suggestions, or rhetorical questions.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map((chat: { writer: string; message: string }) => ({
      role: chat.writer === 'user' ? 'user' : 'assistant',
      content: chat.message,
    })),
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
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
