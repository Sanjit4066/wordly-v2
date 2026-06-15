import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load env vars before anything else!
dotenv.config();
import connectMongoDB from './lib/mongodb';

// Routes
import wordRoutes from './routes/wordRoutes';
import revisionRoutes from './routes/revisionRoutes';
import sentenceRoutes from './routes/sentenceRoutes';
import notificationRoutes from './routes/notificationRoutes';
import quizRoutes from './routes/quizRoutes';
import progressRoutes from './routes/progressRoutes';
import adminRoutes from './routes/adminRoutes';
import userRoutes from './routes/userRoutes';

// Cron jobs
import { startBatchWordProcessor } from './cron/batchWordProcessor';
import { startQuizGenerator } from './cron/quizGenerator';
import { startSpacedRepetitionReminder } from './cron/spacedRepetitionReminder';
import { startDailyDictionaryExpander } from './cron/dailyDictionaryExpander';
import { startKeepAlive } from './cron/keepAlive';

// (dotenv.config() moved to top of file)
const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://wordly-v2.vercel.app',
  process.env.FRONTEND_URL,
  'http://localhost:5173',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/word', wordRoutes);
app.use('/api/revision', revisionRoutes);
app.use('/api/sentences', sentenceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n🚀 Wordly V2 backend running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health\n`);
    });

    // Start all cron jobs
    startKeepAlive();                    // Every 14 mins  — keep backend awake on free tiers
    startBatchWordProcessor();           // 11:55 PM daily  — user-requested word batch processing
    startQuizGenerator();                // 11:00 PM Monday — weekly quiz generation
    startSpacedRepetitionReminder();     //  9:00 AM daily  — spaced repetition reminders
    startDailyDictionaryExpander();      //  5:00 AM EST    — autonomous 1000-word dictionary expansion

    console.log('✅ All cron jobs scheduled\n');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
