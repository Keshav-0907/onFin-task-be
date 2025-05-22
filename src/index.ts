import express from 'express';
import cors from 'cors';
import areaRouter from './routes/areaRoutes';
import dotenv from 'dotenv';
import chatRouter from './routes/chatRoutes';


dotenv.config();

const app = express();
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the API'
  });
});

app.use('/api/areas', areaRouter);
app.use('/api/chat', chatRouter);

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});