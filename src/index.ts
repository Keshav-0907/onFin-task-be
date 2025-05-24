import express from 'express';
import cors from 'cors';
import areaRouter from './routes/areaRoutes';
import dotenv from 'dotenv';
import chatRouter from './routes/chatRoutes';
import { rateLimit } from 'express-rate-limit';


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

dotenv.config();

const app = express();
app.use(express.json());

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://on-fin-task-fe.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the API'
  });
});

app.use('/api/areas', limiter, areaRouter);
app.use('/api/chat', limiter, chatRouter);

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});