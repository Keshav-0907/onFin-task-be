import express from 'express';
import { aiChat, summariseChatHistory } from '../controllers/chatController';

const chatRouter = express.Router();

chatRouter.post('/completions', aiChat)
chatRouter.post('/summarise', summariseChatHistory);

export default chatRouter;