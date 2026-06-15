import cron from 'node-cron';
import WordRequest from '../models/WordRequests';
import Word from '../models/Dictionary';
import Notification from '../models/Notifications';
import { processWordWithAI, processWordsBatchWithAI } from '../services/geminiService';
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

function getEndOfDayIST(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  istTime.setUTCHours(23, 59, 59, 999);
  return new Date(istTime.getTime() - istOffset);
}

async function sendBulkNotificationToUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  const expiryDate = getEndOfDayIST();

  const notifications = userIds.map((userId) => ({
    userId,
    type: 'word_added' as const,
    message: 'Your requested words are processed, you can find them on the Contributions page. Thank you for your contribution to Wordly! ❤️',
    wordId: null,
    isRead: false,
    expiresAt: expiryDate,
  }));

  try {
    await Notification.insertMany(notifications);
    console.log(`🔔 [Batch Processor] Sent summary notification to ${userIds.length} user(s) (expiring at ${expiryDate.toISOString()})`);
  } catch (error) {
    console.error('⚠️  [Batch Processor] Failed to send bulk notifications:', error);
  }
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
  const userIdsToNotify = new Set<string>();

  const CHUNK_SIZE = 30;

  for (let i = 0; i < pendingRequests.length; i += CHUNK_SIZE) {
    const chunkRequests = pendingRequests.slice(i, i + CHUNK_SIZE);
    const chunkWordsToProcess: { word: string; req: any }[] = [];

    // Pre-check for already existing words
    for (const request of chunkRequests) {
      const { word, requestedBy } = request;
      await WordRequest.findByIdAndUpdate(request._id, { status: 'processing' });

      const existingWord = await Word.findOne({ word });
      if (existingWord) {
        console.log(`⚠️  [Batch Processor] "${word}" already in dictionary at level: ${existingWord.level}`);
        await WordRequest.findByIdAndUpdate(request._id, {
          status: 'done',
          processedAt: new Date(),
        });
        results.push({ word, level: existingWord.level, status: 'already_exists' });
        
        // Accumulate users to notify
        requestedBy.forEach((uid) => userIdsToNotify.add(uid));
      } else {
        chunkWordsToProcess.push({ word, req: request });
      }
    }

    if (chunkWordsToProcess.length === 0) continue;

    const wordsOnly = chunkWordsToProcess.map((w) => w.word);

    try {
      console.log(`🤖 [Batch Processor] Calling AI for ${wordsOnly.length} word(s) simultaneously...`);
      const aiDataArray = await processWordsBatchWithAI(wordsOnly);

      for (const reqWrapper of chunkWordsToProcess) {
        const { word, req } = reqWrapper;
        const aiData = aiDataArray.find((a) => a.word.toLowerCase() === word.toLowerCase());

        if (!aiData) {
           throw new Error(`AI did not return data for word: ${word}`);
        }

        const savedWord = await Word.create({
          word: aiData.word.toLowerCase(),
          meaning: aiData.meaning,
          sentences: aiData.sentences,
          level: aiData.level,
          synonyms: aiData.synonyms,
          antonyms: aiData.antonyms,
          etymology: aiData.etymology,
          partOfSpeech: aiData.partOfSpeech,
          addedVia: 'ai_batch',
        });

        console.log(`✅ [Batch Processor] "${word}" saved → level: "${savedWord.level}"`);

        await WordRequest.findByIdAndUpdate(req._id, {
          status: 'done',
          processedAt: new Date(),
        });

        results.push({ word, level: savedWord.level, status: 'saved' });
        
        // Accumulate users to notify
        req.requestedBy.forEach((uid: string) => userIdsToNotify.add(uid));
      }
    } catch (error: any) {
      console.error(`❌ [Batch Processor] Failed chunk starting with "${wordsOnly[0]}":`, error.message);

      for (const reqWrapper of chunkWordsToProcess) {
        const { word, req } = reqWrapper;
        await WordRequest.findByIdAndUpdate(req._id, {
          status: 'failed',
          failReason: error.message || 'Unknown AI error in batch',
        });

        results.push({
          word,
          level: 'intermediate',
          status: 'failed',
          failReason: error.message,
        });
      }
    }

    await new Promise((res) => setTimeout(res, 2000));
  }

  // Send single aggregated notification to all affected users
  await sendBulkNotificationToUsers(Array.from(userIdsToNotify));

  // ── Print batch summary with difficulty breakdown ──
  printBatchSummary(results);
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

// ─── CRON JOB: Runs every day at 4:00 AM IST ───────────────────────────────────
export function startBatchWordProcessor(): void {
  console.log('⏰ [Batch Processor] Cron job scheduled: 4:00 AM IST daily');

  cron.schedule('0 4 * * *', async () => {
    try {
      await processPendingWords();
    } catch (error) {
      console.error('❌ [Batch Processor] Cron job crashed:', error);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });
}

// ─── MANUAL TRIGGER (for testing) ────────────────────────────────────────────
export async function triggerBatchNow(): Promise<void> {
  await processPendingWords();
}
