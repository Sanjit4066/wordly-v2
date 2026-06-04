import cron from 'node-cron';
import UserProgress from '../models/UserProgress';
import Word from '../models/Dictionary';
import WeeklyQuiz from '../models/WeeklyQuizzes';
import { generateWeeklyQuiz } from '../services/geminiService';

function getLastMonday(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function generateQuizzesForAllUsers(): Promise<void> {
  console.log('\n📝 [Quiz Generator] Starting weekly quiz generation...');

  const weekStart = getLastMonday();

  // Get all unique userIds who have activity in the past week
  const activeUsers = await UserProgress.distinct('userId', {
    seenAt: { $gte: weekStart },
  });

  console.log(`👥 [Quiz Generator] Found ${activeUsers.length} active user(s) this week`);

  for (const userId of activeUsers) {
    try {
      // Check if quiz already generated for this user this week
      const existingQuiz = await WeeklyQuiz.findOne({ userId, weekStart });
      if (existingQuiz) {
        console.log(`⏭️  [Quiz Generator] Quiz already exists for user ${userId}`);
        continue;
      }

      // Fetch up to 7 words this user learned this week
      const progressEntries = await UserProgress.find({
        userId,
        seenAt: { $gte: weekStart },
      })
        .sort({ seenAt: -1 })
        .limit(7);

      if (progressEntries.length === 0) {
        console.log(`⚠️  [Quiz Generator] No words found for user ${userId} this week`);
        continue;
      }

      const wordIds = progressEntries.map((p) => p.wordId);
      const wordDocs = await Word.find({ word: { $in: wordIds } });

      const wordData = wordDocs.map((w) => ({
        wordId: w.word,
        word: w.word,
        meaning: w.meaning,
      }));

      // Generate MCQ questions via AI
      console.log(`🤖 [Quiz Generator] Generating ${wordData.length} questions for user ${userId}...`);
      const questions = await generateWeeklyQuiz(wordData);

      await WeeklyQuiz.create({
        userId,
        weekStart,
        words: wordIds,
        questions,
        completed: false,
        score: null,
      });

      console.log(`✅ [Quiz Generator] Quiz created for user ${userId} (${questions.length} questions)`);

      // Delay between users to respect rate limits
      await new Promise((res) => setTimeout(res, 1000));
    } catch (error: any) {
      console.error(`❌ [Quiz Generator] Failed for user ${userId}:`, error.message);
    }
  }

  console.log('✅ [Quiz Generator] Weekly quiz generation complete.\n');
}

// ─── CRON JOB: Every Monday at 11:00 PM ──────────────────────────────────────
export function startQuizGenerator(): void {
  console.log('⏰ [Quiz Generator] Cron job scheduled: 11:00 PM every Monday');

  cron.schedule('0 23 * * 1', async () => {
    try {
      await generateQuizzesForAllUsers();
    } catch (error) {
      console.error('❌ [Quiz Generator] Cron job crashed:', error);
    }
  });
}

export async function triggerQuizGenerationNow(): Promise<void> {
  await generateQuizzesForAllUsers();
}
