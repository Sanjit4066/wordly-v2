import cron from 'node-cron';
import WordRequest from '../models/WordRequests';
import Word from '../models/Dictionary';
import Notification from '../models/Notifications';
import { processWordWithAI } from '../services/geminiService';
import { DifficultyLevel } from '../models/Dictionary';

// ─── DIFFICULTY BUCKET SUMMARY ────────────────────────────────────────────────
// After each batch run, every processed word is saved to the dictionary
// with its AI-assigned difficulty level. This means:
//
//   User requests "ephemeral"  →  AI classifies as "advanced"
//   Word saved to dictionary with level: "advanced"
//   Users who want to learn advanced words will see "ephemeral"
//   Users at beginner level will NOT see it in their Word of Day
//
// The dictionary is effectively 4 sub-dictionaries in one collection,
// filtered by the `level` field. Querying is as simple as:
//   Word.find({ level: 'advanced' })
// ─────────────────────────────────────────────────────────────────────────────

interface BatchResult {
  word: string;
  level: DifficultyLevel;
  status: 'saved' | 'already_exists' | 'failed';
  failReason?: string;
}

async function processPendingWords(): Promise<void> {
  console.log('\n🕐 [Batch Processor] Starting nightly word processing...');

  // 1. Fetch all pending word requests
  const pendingRequests = await WordRequest.find({ status: 'pending' });

  if (pendingRequests.length === 0) {
    console.log('✅ [Batch Processor] No pending word requests. Skipping.');
    return;
  }

  console.log(`📋 [Batch Processor] Processing ${pendingRequests.length} word(s)...`);

  const results: BatchResult[] = [];

  for (const request of pendingRequests) {
    const { word, requestedBy } = request;

    try {
      // Mark as processing to prevent duplicate runs
      await WordRequest.findByIdAndUpdate(request._id, { status: 'processing' });

      // Check if word was already added by a concurrent run
      const existingWord = await Word.findOne({ word });
      if (existingWord) {
        console.log(`⚠️  [Batch Processor] "${word}" already in dictionary at level: ${existingWord.level}`);
        await WordRequest.findByIdAndUpdate(request._id, {
          status: 'done',
          processedAt: new Date(),
        });
        results.push({ word, level: existingWord.level, status: 'already_exists' });

        // Still notify users even if word pre-existed
        await notifyUsers(requestedBy, word, existingWord.level);
        continue;
      }

      // ── CORE: Call Gemini AI for word data + difficulty classification ──
      console.log(`🤖 [Batch Processor] Calling AI for "${word}"...`);
      const aiData = await processWordWithAI(word);

      // ── Save word to dictionary under its AI-assigned difficulty level ──
      const savedWord = await Word.create({
        word: aiData.word,
        meaning: aiData.meaning,
        sentence: aiData.sentence,
        level: aiData.level,           // ← difficulty bucket assignment
        synonyms: aiData.synonyms,
        antonyms: aiData.antonyms,
        etymology: aiData.etymology,
        partOfSpeech: aiData.partOfSpeech,
        addedVia: 'ai_batch',
      });

      console.log(`✅ [Batch Processor] "${word}" saved → level: "${savedWord.level}"`);

      // Mark request as done
      await WordRequest.findByIdAndUpdate(request._id, {
        status: 'done',
        processedAt: new Date(),
      });

      results.push({ word, level: savedWord.level, status: 'saved' });

      // Notify all users who requested this word
      await notifyUsers(requestedBy, word, savedWord.level);

    } catch (error: any) {
      console.error(`❌ [Batch Processor] Failed for "${word}":`, error.message);

      // Mark request as failed with reason
      await WordRequest.findByIdAndUpdate(request._id, {
        status: 'failed',
        failReason: error.message || 'Unknown AI error',
      });

      results.push({
        word,
        level: 'intermediate', // fallback, won't be used since it failed
        status: 'failed',
        failReason: error.message,
      });
    }

    // Small delay between AI calls to respect rate limits
    await new Promise((res) => setTimeout(res, 500));
  }

  // ── Print batch summary with difficulty breakdown ──
  printBatchSummary(results);
}

async function notifyUsers(
  userIds: string[],
  word: string,
  level: DifficultyLevel
): Promise<void> {
  const notifications = userIds.map((userId) => ({
    userId,
    type: 'word_added' as const,
    message: `Your requested word "${word}" is now in the ${level} dictionary! Tap to learn it.`,
    wordId: word,
    isRead: false,
  }));

  try {
    await Notification.insertMany(notifications);
    console.log(`🔔 [Batch Processor] Notified ${userIds.length} user(s) about "${word}"`);
  } catch (error) {
    console.error(`⚠️  [Batch Processor] Failed to send notifications for "${word}":`, error);
  }
}

function printBatchSummary(results: BatchResult[]): void {
  const saved = results.filter((r) => r.status === 'saved');
  const failed = results.filter((r) => r.status === 'failed');
  const existing = results.filter((r) => r.status === 'already_exists');

  console.log('\n📊 [Batch Processor] Nightly Batch Summary');
  console.log('─'.repeat(50));
  console.log(`   Total processed : ${results.length}`);
  console.log(`   Newly added     : ${saved.length}`);
  console.log(`   Already existed : ${existing.length}`);
  console.log(`   Failed          : ${failed.length}`);

  if (saved.length > 0) {
    console.log('\n   Difficulty Breakdown (newly added words):');

    // Group by difficulty level
    const levels: Record<DifficultyLevel, string[]> = {
      beginner: [],
      intermediate: [],
      advanced: [],
      expert: [],
    };

    saved.forEach((r) => levels[r.level].push(r.word));

    Object.entries(levels).forEach(([level, words]) => {
      if (words.length > 0) {
        console.log(`   📚 ${level.padEnd(14)}: ${words.join(', ')}`);
      }
    });
  }

  if (failed.length > 0) {
    console.log('\n   ⚠️  Failed words (will retry in next batch):');
    failed.forEach((r) => console.log(`   - ${r.word}: ${r.failReason}`));
  }

  console.log('─'.repeat(50));
  console.log('✅ [Batch Processor] Done.\n');
}

// ─── CRON JOB: Runs every day at 11:55 PM ─────────────────────────────────────
export function startBatchWordProcessor(): void {
  console.log('⏰ [Batch Processor] Cron job scheduled: 11:55 PM daily');

  cron.schedule('55 23 * * *', async () => {
    try {
      await processPendingWords();
    } catch (error) {
      console.error('❌ [Batch Processor] Cron job crashed:', error);
    }
  });
}

// ─── MANUAL TRIGGER (for testing) ────────────────────────────────────────────
export async function triggerBatchNow(): Promise<void> {
  await processPendingWords();
}
