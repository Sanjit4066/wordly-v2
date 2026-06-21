import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectMongoDB from '../lib/mongodb';
import Word from '../models/Dictionary';
import { processWordsBatchWithAI } from '../services/geminiService';

const CHUNK_SIZE = 30;
const DELAY_MS = 16000; // 16s delay between chunks to safely stay under Gemini's 15 RPM free tier limit

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

async function startEnrichment() {
  const startTime = Date.now();
  try {
    await connectMongoDB();
    console.log('🔌 Connected to MongoDB.');

    // 1. Fetch all words that are not enriched yet
    const toProcessDocs = await Word.find({ isAiEnriched: false }, 'word').sort({ searchCount: -1 });
    const toProcess = toProcessDocs.map(doc => doc.word);

    if (toProcess.length === 0) {
      console.log('✅ All words in the database are already AI-enriched!');
      process.exit(0);
    }

    console.log(`\n📋 Found ${toProcess.length} words pending AI enrichment.`);
    console.log(`⏱️  Running in batches of ${CHUNK_SIZE} with a ${DELAY_MS / 1000}s delay between requests.`);
    const totalChunks = Math.ceil(toProcess.length / CHUNK_SIZE);
    const estDurationMs = totalChunks * DELAY_MS;
    console.log(`⏳ Estimated duration: ~${formatDuration(estDurationMs)}\n`);

    let inserted = 0;
    let failed = 0;
    const failedWords: string[] = [];

    // 2. Loop through in chunks
    for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
      const chunk = toProcess.slice(i, i + CHUNK_SIZE);
      const progress = `[Batch ${Math.floor(i / CHUNK_SIZE) + 1}/${totalChunks}]`;

      // Check if words in chunk are already enriched (to avoid duplicate processing if run repeatedly)
      const chunkToProcess: string[] = [];
      for (const word of chunk) {
        const existsAndEnriched = await Word.exists({ word, isAiEnriched: true });
        if (!existsAndEnriched) {
          chunkToProcess.push(word);
        }
      }

      if (chunkToProcess.length === 0) {
        console.log(`⏭️  ${progress} All words in this chunk are already enriched. Skipping.`);
        continue;
      }

      try {
        console.log(`🤖 ${progress} Processing ${chunkToProcess.length} words via Gemini...`);
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
                meaning: aiData.meaning,
                sentences: aiData.sentences,
                level: aiData.level,
                synonyms: aiData.synonyms,
                antonyms: aiData.antonyms,
                etymology: aiData.etymology,
                partOfSpeech: aiData.partOfSpeech,
                story: aiData.story,
                isAiEnriched: true,
                addedVia: 'ai_batch',
              }
            }
          );
          inserted++;
        }

        console.log(`✅ ${progress} Saved ${aiDataArray.length} words successfully.`);

      } catch (err: any) {
        failed += chunkToProcess.length;
        failedWords.push(...chunkToProcess);
        console.error(`❌ ${progress} FAILED chunk:`, err.message || err);
      }

      // Print progress summary
      const elapsed = Date.now() - startTime;
      const remainingChunks = totalChunks - (Math.floor(i / CHUNK_SIZE) + 1);
      const etaMs = remainingChunks * DELAY_MS;
      console.log(`   📊 Progress: Enriched: ${inserted} | Failed: ${failed} | Elapsed: ${formatDuration(elapsed)} | ETA: ${formatDuration(etaMs)}\n`);

      // Rate limit delay
      await delay(DELAY_MS);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 Bulk Enrichment Complete!');
    console.log(`   - Enriched: ${inserted}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Total time: ${formatDuration(Date.now() - startTime)}`);
    if (failedWords.length > 0) {
      console.log(`   - Failed words (need to retry): ${failedWords.join(', ')}`);
    }
    console.log('═'.repeat(60) + '\n');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error during bulk enrichment:', error);
    process.exit(1);
  }
}

startEnrichment();
