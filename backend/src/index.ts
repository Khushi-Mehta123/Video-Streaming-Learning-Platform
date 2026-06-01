import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import videoRoutes from './routes/video.routes';
import liveRoutes from './routes/live.routes';
import paymentRoutes from './routes/payment.routes';
import './jobs/video.worker';
import './jobs/mail.worker';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
