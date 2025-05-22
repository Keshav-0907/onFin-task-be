import express from 'express';
import { aiChat } from '../controllers/chatController';

const chatRouter = express.Router();

chatRouter.post('/completions', aiChat)

export default chatRouter;