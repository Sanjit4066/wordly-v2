import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectMongoDB from './lib/mongodb';

// Routes
import wordRoutes from './routes/wordRoutes';
import revisionRoutes from './routes/revisionRoutes';
import sentenceRoutes from './routes/sentenceRoutes';
import notificationRoutes from './routes/notificationRoutes';
import quizRoutes from './routes/quizRoutes';
import progressRoutes from './routes/progressRoutes';
import adminRoutes from './routes/adminRoutes';

// Cron jobs
import { startBatchWordProcessor } from './cron/batchWordProcessor';
import { startQuizGenerator } from './cron/quizGenerator';
import { startSpacedRepetitionReminder } from './cron/spacedRepetitionReminder';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/word', wordRoutes);
app.use('/api/revision', revisionRoutes);
app.use('/api/sentences', sentenceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/admin', adminRoutes);

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
    startBatchWordProcessor();       // 11:55 PM daily — batch word processing + difficulty categorization
    startQuizGenerator();             // 11:00 PM every Monday — weekly quiz generation
    startSpacedRepetitionReminder(); // 9:00 AM daily — spaced repetition reminders

    console.log('✅ All cron jobs scheduled\n');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
