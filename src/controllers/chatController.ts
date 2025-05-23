import AllAreas from '../data/areas.json';
import Stats from '../data/stats.json';
import OpenAI from 'openai';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import { AiChatRequest, SummariseChatHistoryRequest, SummariseChatHistoryResponse } from '../types';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const aiChat = async (req: Request<{}, {}, AiChatRequest>, res: Response) => {
  try {
    const { message, pinCode, chatHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const allAreas = AllAreas.map(({ geometry, ...rest }) => rest);

    let systemPrompt = `
You are a helpful assistant for the Bengaluru Area Dashboard. Answer questions using only the supplied data.
Avoid mentioning "JSON", "data source", or "structured format". Just respond conversationally based on the data.
`;

    let contextMessage = '';
    if (pinCode) {
      const areaStats = Stats.find(area => Number(area.pinCode) === Number(pinCode));
      if (!areaStats) {
        return res.status(400).json({ error: 'Invalid Pin Code' });
      }

      contextMessage = `Area Stats for Pin Code ${pinCode}:\n${JSON.stringify(areaStats)}\n\nOther Area Details:\n${JSON.stringify(allAreas)}`;
    } else {
      contextMessage = `Complete Area Details:\n${JSON.stringify(allAreas)}`;
    }

    // response stream strts here
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const openaiMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: contextMessage },
      ...chatHistory.map((chat) => ({
        role: chat.writer === 'user' ? ('user' as const) : ('assistant' as const),
        content: chat.message,
      })),
      { role: 'user' as const, content: message },
    ];


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
    try {
      res.write(`data: [ERROR]\n\n`);
      res.end();
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }
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
  Summarise the following chat history within 30 words. Provide a concise summary of the conversation, highlighting key points and any important information.`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map((chat: { writer: string; message: string; }) => ({
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

  if(!summary) {
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
