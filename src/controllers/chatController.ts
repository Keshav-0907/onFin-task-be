import AllAreas from '../data/areas.json';
import Stats from '../data/stats.json';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const aiChat = async (req, res) => {
  try {
    const { message, pinCode, chatHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const allAreas = AllAreas.map(({ geometry, ...rest }) => rest);
    let systemPrompt = `
You are a helpful assistant for the Bengaluru Area Dashboard. Respond only based on the provided JSON data.

 Prioritize locality names when answering questions.
 If a specific area is mentioned, provide relevant data for that locality.
 If information is missing or unclear, politely ask for more details or respond with a brief apology.
 Keep all responses concise, clear, and to the point.
`;


    let contextMessage = '';
    if (pinCode) {
      const areaStats = Stats.find(area => Number(area.pinCode) === Number(pinCode));
      if (!areaStats) {
        return res.status(400).json({ error: 'Invalid Pin Code' });
      }

      contextMessage = `Here are the details for pin code ${pinCode}: ${JSON.stringify(areaStats)}. 
      And this is for all areas: ${JSON.stringify(allAreas)}`;
    } else {
      contextMessage = `This is the complete area data: ${JSON.stringify(allAreas)}`;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: contextMessage },
        { role: 'user', content: message },
        ...chatHistory.map((chat) => ({
          role: chat.writer,
          content: chat.message,
        })),
      ],
      max_tokens: 1000,
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

export { aiChat };
