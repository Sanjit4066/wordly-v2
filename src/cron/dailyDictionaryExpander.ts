/**
 * dailyDictionaryExpander.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Autonomous daily cron job — runs at 5:00 AM EST (10:00 AM UTC) every day.
 *
 * What it does:
 *   1. Waits for any pending user-requested words to finish processing first
 *   2. Then works through the master word list, picking up to BATCH_SIZE words
 *      that are NOT yet in the dictionary
 *   3. Calls Gemini AI for each word — generates meaning, 2 sentences, level,
 *      synonyms, antonyms, and etymology
 *   4. Saves each word to the dictionary with addedVia: 'ai_batch'
 *   5. Logs a full summary when done
 *
 * Rate limiting:
 *   - 1 word every DELAY_MS milliseconds  ≈ 13 RPM (under Gemini free tier)
 *   - Built-in retry with exponential back-off for 429 errors
 *   - At 4.5 s/word: 1000 words ≈ 75 minutes
 *
 * Schedule: '0 10 * * *'  →  10:00 AM UTC  =  5:00 AM EST / 6:00 AM EDT
 * ─────────────────────────────────────────────────────────────────────────────
 */

import cron from 'node-cron';
import Word from '../models/Dictionary';
import WordRequest from '../models/WordRequests';
import { processWordWithAI, processWordsBatchWithAI } from '../services/geminiService';
import { DifficultyLevel } from '../models/Dictionary';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BATCH_SIZE = 600;       // max words to process per daily run (20 reqs * 30 words = 600)
const CHUNK_SIZE = 30;        // words per single Gemini AI call
const DELAY_MS   = 15000;     // ms between each chunk (rate limiting to 4 RPM)
const MAX_PENDING_WAIT_MS = 10 * 60 * 1000; // wait up to 10 min for user-requests to clear

// ─── MASTER WORD LIST ────────────────────────────────────────────────────────
// 1000+ curated English words across all difficulty levels.
// Words already in the dictionary are automatically skipped.
export const MASTER_WORD_LIST: string[] = [];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours   > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Wait until all user-requested words have been processed (or timeout).
 * This ensures the daily expander never competes with user-requested AI calls.
 */
async function waitForUserRequestsToFinish(): Promise<void> {
  const pollInterval = 30_000; // check every 30 s
  const deadline = Date.now() + MAX_PENDING_WAIT_MS;

  while (Date.now() < deadline) {
    const processingCount = await WordRequest.countDocuments({
      status: 'processing',
    });

    if (processingCount === 0) {
      console.log('✅ [Expander] No active user request processing — starting daily expansion.');
      return;
    }

    console.log(`⏳ [Expander] ${processingCount} user request(s) still actively processing. Waiting 30s...`);
    await delay(pollInterval);
  }

  console.warn('⚠️  [Expander] Timed out waiting for active user requests. Proceeding anyway.');
}

function classifyLevel(word: string): DifficultyLevel {
  const len = word.length;
  if (len <= 5) return 'beginner';
  if (len <= 7) return 'intermediate';
  if (len <= 9) return 'advanced';
  return 'expert';
}

async function getBalancedWordsToProcess(batchSize: number): Promise<string[]> {
  const wordsPerLevel = Math.ceil(batchSize / 4);
  const levels: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
  const toProcess: string[] = [];

  for (const level of levels) {
    const levelWords = await Word.find({ isAiEnriched: false, level }, 'word')
      .sort({ searchCount: -1 })
      .limit(wordsPerLevel);
    levelWords.forEach(w => toProcess.push(w.word));
  }

  // Shuffle the resulting words to mix difficulty levels during execution
  return toProcess.sort(() => Math.random() - 0.5).slice(0, batchSize);
}

// ─── CORE EXPANSION LOGIC ─────────────────────────────────────────────────────

async function runDailyExpansion(): Promise<void> {
  const startTime = Date.now();
  console.log('\n' + '═'.repeat(60));
  console.log('🌅 [Daily Expander] Starting 5:00 AM EST dictionary expansion run');
  console.log(`📅 ${new Date().toUTCString()}`);
  console.log('═'.repeat(60));

  // Step 1: Let user-requested word processing finish first
  await waitForUserRequestsToFinish();

  // Step 2: Find static words in database to enrich
  const toProcess = await getBalancedWordsToProcess(BATCH_SIZE);

  if (toProcess.length === 0) {
    console.log('✅ [Expander] All words in the database are already AI-enriched!');
    return;
  }

  console.log(`\n📋 [Expander] ${toProcess.length} word(s) to process (batch cap: ${BATCH_SIZE})`);
  console.log(`⏱️  Rate: 1 word every ${DELAY_MS / 1000}s ≈ ${Math.round(60000 / DELAY_MS)} RPM`);
  const estMinutes = Math.ceil((toProcess.length * DELAY_MS) / 60000);
  console.log(`⏳ Estimated time: ~${estMinutes} minute(s)\n`);

  // Counters
  let inserted = 0;
  let skipped  = 0;
  let failed   = 0;
  const failedWords: string[] = [];

  // By-level breakdown
  const byLevel: Record<DifficultyLevel, number> = {
    beginner: 0, intermediate: 0, advanced: 0, expert: 0,
  };

  // Step 3: Process words in chunks
  for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
    const chunk = toProcess.slice(i, i + CHUNK_SIZE);
    const progress = `[chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(toProcess.length / CHUNK_SIZE)}]`;

    // Filter out any words that were added/enriched by another process in the meantime
    const chunkToProcess: string[] = [];
    for (const word of chunk) {
      const existsAndEnriched = await Word.exists({ word, isAiEnriched: true });
      if (existsAndEnriched) {
        skipped++;
      } else {
        chunkToProcess.push(word);
      }
    }

    if (chunkToProcess.length === 0) continue;

    try {
      process.stdout.write(`🤖 ${progress} Processing ${chunkToProcess.length} words... `);

      const aiDataArray = await processWordsBatchWithAI(chunkToProcess);

      for (const aiData of aiDataArray) {
        if (!aiData || !aiData.word) {
           failed++;
           continue;
        }
        await Word.findOneAndUpdate(
          { word: aiData.word.toLowerCase() },
          {
            $set: {
              meaning:     aiData.meaning,
              sentences:   aiData.sentences,
              level:       aiData.level,
              synonyms:    aiData.synonyms,
              antonyms:    aiData.antonyms,
              etymology:   aiData.etymology,
              partOfSpeech: aiData.partOfSpeech,
              story:       aiData.story,
              isAiEnriched: true,
              addedVia:    'ai_batch',
            }
          }
        );

        byLevel[aiData.level]++;
        inserted++;
      }
      process.stdout.write(`✅ saved!\n`);

      // Progress summary
      const elapsed   = Date.now() - startTime;
      const avgMs     = elapsed / (i + CHUNK_SIZE);
      const remainingChunks = Math.ceil((toProcess.length - (i + CHUNK_SIZE)) / CHUNK_SIZE);
      const etaMs     = remainingChunks * (avgMs * CHUNK_SIZE + DELAY_MS);
      console.log(`   📊 inserted:${inserted} skipped:${skipped} failed:${failed} | elapsed:${formatDuration(elapsed)} | eta:${formatDuration(etaMs)}\n`);

    } catch (err: any) {
      failed += chunkToProcess.length;
      failedWords.push(...chunkToProcess);
      process.stdout.write(`❌ FAILED — ${err.message?.slice(0, 80)}\n`);
    }

    // Rate-limit delay between chunks
    await delay(DELAY_MS);
  }

  // Step 4: Final summary
  const totalTime = Date.now() - startTime;
  console.log('\n' + '═'.repeat(60));
  console.log('🎉 [Daily Expander] Run Complete');
  console.log('═'.repeat(60));
  console.log(`   ✅ Inserted    : ${inserted}`);
  console.log(`   ⏭️  Skipped     : ${skipped}`);
  console.log(`   ❌ Failed      : ${failed}`);
  console.log(`   ⏱️  Total time  : ${formatDuration(totalTime)}`);

  if (inserted > 0) {
    console.log('\n   📚 Breakdown by difficulty:');
    (Object.entries(byLevel) as [DifficultyLevel, number][])
      .filter(([, count]) => count > 0)
      .forEach(([level, count]) =>
        console.log(`      ${level.padEnd(14)}: ${count} words`)
      );
  }

  if (failedWords.length > 0) {
    console.log(`\n   ⚠️  Failed words (will retry tomorrow):\n      ${failedWords.join(', ')}`);
  }

  // Remaining unprocessed words
  const remaining = await Word.countDocuments({ isAiEnriched: false });
  if (remaining > 0) {
    console.log(`\n   🔜 Still in queue: ${remaining} more word(s) across future runs`);
  } else {
    console.log('\n   🏁 All dictionary words are now AI-enriched!');
  }
  console.log('═'.repeat(60) + '\n');
}

// ─── CRON SCHEDULE ────────────────────────────────────────────────────────────
// '0 5 * * *' → 5:00 AM IST
// node-cron uses the specified timezone option.

export function startDailyDictionaryExpander(): void {
  const schedule = process.env.EXPANDER_CRON || '0 5 * * *';

  console.log('⏰ [Daily Expander] Cron job scheduled: 5:00 AM IST daily');

  cron.schedule(schedule, async () => {
    try {
      await runDailyExpansion();
    } catch (error) {
      console.error('❌ [Daily Expander] Cron job crashed:', error);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });
}

// ─── MANUAL TRIGGER (for testing / admin API) ─────────────────────────────────
export async function triggerDailyExpansionNow(): Promise<void> {
  await runDailyExpansion();
}
