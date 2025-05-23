import express from 'express';
import { aiChat, summariseChatHistory } from '../controllers/chatController';

const chatRouter = express.Router();

chatRouter.post('/completions', aiChat as any)
chatRouter.post('/summarise', summariseChatHistory as any);

export default chatRouter;