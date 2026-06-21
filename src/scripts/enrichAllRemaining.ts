import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectMongoDB from '../lib/mongodb';
import Word from '../models/Dictionary';
import { DifficultyLevel } from '../models/Dictionary';

const CHUNK_SIZE = 10;
const DELAY_MS = 10000; // 10s delay to stay extremely safe under Groq's rate limits

interface AIWordData {
  word: string;
  meaning: string;
  sentences: string[];
  level: DifficultyLevel;
  synonyms: string[];
  antonyms: string[];
  etymology: string;
  partOfSpeech: string;
  story: string;
}

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

function normalizeDifficultyLevel(raw: string): DifficultyLevel {
  const cleaned = raw.toLowerCase().trim();
  if (['beginner', 'basic', 'elementary', 'easy', 'a1', 'a2'].includes(cleaned)) return 'beginner';
  if (['intermediate', 'medium', 'moderate', 'b1', 'b2'].includes(cleaned)) return 'intermediate';
  if (['advanced', 'hard', 'difficult', 'c1'].includes(cleaned)) return 'advanced';
  if (['expert', 'proficient', 'very hard', 'academic', 'rare', 'c2'].includes(cleaned)) return 'expert';
  return 'intermediate';
}

async function processWordsBatchWithGroq(words: string[]): Promise<AIWordData[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing in environment variables');
  }

  const prompt = `
You are a vocabulary expert. Analyze the following English words: ${words.join(', ')}.
Return a JSON array of objects (wrapped in an object with a "data" field or returned directly as a JSON array), where each object has these exact fields:

{
  "word": "the word",
  "meaning": "clear, concise definition in 1-2 sentences",
  "sentences": ["first natural example sentence using the word", "second natural example sentence showing different context"],
  "level": "ONE of: beginner | intermediate | advanced | expert",
  "synonyms": ["up to 4 synonyms"],
  "antonyms": ["up to 4 antonyms"],
  "etymology": "brief origin/history of the word (1-2 sentences)",
  "partOfSpeech": "noun | verb | adjective | adverb | etc.",
  "story": "a narrative micro-story (around 200-250 words) featuring a character, a brief action/conflict, and a resolution that naturally uses the word (or any of its inflected/grammatical forms, such as ran/running for run, or plurals). Avoid general scene descriptions; tell a tiny, complete story."
}

Return ONLY the JSON array. No markdown, no explanation, no backticks.
`;

  let attempts = 0;
  const maxAttempts = 5;
  let delayTime = 15000; // Start with 15s backoff

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (response.status === 429) {
        console.log(`   ⏳ [Groq] Rate limited (429). Waiting ${delayTime / 1000}s before retry (attempt ${attempts}/${maxAttempts})...`);
        await delay(delayTime);
        delayTime *= 2; // Exponential backoff
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from Groq`);
      }

      const data: any = await response.json();
      const rawText = data?.choices?.[0]?.message?.content;
      if (!rawText) {
        throw new Error("Empty response from Groq");
      }

      const parsed = JSON.parse(rawText.trim());
      const parsedArray = Array.isArray(parsed) ? parsed : (parsed.data || parsed.words || []);

      return parsedArray.map((item: any) => {
        let sentences: string[] = [];
        if (Array.isArray(item.sentences) && item.sentences.length > 0) {
          sentences = item.sentences;
        } else if (typeof item.sentence === 'string') {
          sentences = [item.sentence];
        }
        if (sentences.length === 1) sentences.push(sentences[0]);
        if (sentences.length === 0) sentences = ["Example sentence 1.", "Example sentence 2."];

        return {
          word: item.word || '',
          meaning: item.meaning || '',
          sentences: sentences.slice(0, 2),
          level: normalizeDifficultyLevel(item.level || 'intermediate'),
          synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
          antonyms: Array.isArray(item.antonyms) ? item.antonyms : [],
          etymology: item.etymology || '',
          partOfSpeech: item.partOfSpeech || 'unknown',
          story: item.story || '',
        };
      });

    } catch (err: any) {
      if (attempts >= maxAttempts) {
        throw err;
      }
      console.log(`   ⚠️ [Groq] Error: ${err.message || err}. Waiting 10s before retry (attempt ${attempts}/${maxAttempts})...`);
      await delay(10000);
    }
  }

  throw new Error("Failed to process batch via Groq after maximum retry attempts");
}

async function startEnrichment() {
  const startTime = Date.now();
  try {
    await connectMongoDB();
    console.log('🔌 Connected to MongoDB.');

    // 1. Initial count of pending words to log stats
    const totalPendingCount = await Word.countDocuments({ isAiEnriched: false });

    if (totalPendingCount === 0) {
      console.log('✅ All words in the database are already AI-enriched!');
      process.exit(0);
    }

    console.log(`\n📋 Found ${totalPendingCount} words pending AI enrichment.`);
    console.log(`⏱️  Running in dynamic batches of ${CHUNK_SIZE} with a ${DELAY_MS / 1000}s delay between requests.`);
    const totalChunks = Math.ceil(totalPendingCount / CHUNK_SIZE);
    const estDurationMs = totalChunks * DELAY_MS;
    console.log(`⏳ Estimated duration: ~${formatDuration(estDurationMs)}\n`);

    let inserted = 0;
    let failed = 0;
    let batchIndex = 1;
    const failedWords: string[] = [];

    // 2. Loop dynamically
    while (true) {
      // Fetch the next chunk of words directly from database
      const chunkDocs = await Word.find({ isAiEnriched: false }, 'word')
        .sort({ searchCount: -1 })
        .limit(CHUNK_SIZE);

      if (chunkDocs.length === 0) {
        break;
      }

      const chunkToProcess = chunkDocs.map(doc => doc.word);
      const progress = `[Batch ${batchIndex}/${totalChunks}]`;

      try {
        console.log(`🤖 ${progress} Processing ${chunkToProcess.length} words via Groq...`);
        const aiDataArray = await processWordsBatchWithGroq(chunkToProcess);

        let savedInThisBatch = 0;
        for (const aiData of aiDataArray) {
          if (!aiData || !aiData.word) {
            failed++;
            continue;
          }

          const matchedDoc = await Word.findOneAndUpdate(
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
          if (matchedDoc) {
            inserted++;
            savedInThisBatch++;
          } else {
            failed++;
          }
        }

        console.log(`✅ ${progress} Saved ${savedInThisBatch} of ${chunkToProcess.length} words successfully.`);

        // Track any words in the chunk that the AI did not return
        const savedWordsSet = new Set(aiDataArray.map(item => (item?.word || '').toLowerCase()));
        for (const word of chunkToProcess) {
          if (!savedWordsSet.has(word.toLowerCase())) {
            failedWords.push(word);
            failed++;
            // Note: because isAiEnriched remains false, they will naturally be retried in subsequent queries.
          }
        }

      } catch (err: any) {
        failed += chunkToProcess.length;
        failedWords.push(...chunkToProcess);
        console.error(`❌ ${progress} FAILED chunk:`, err.message || err);
      }

      // Print progress summary
      const elapsed = Date.now() - startTime;
      const remainingPending = await Word.countDocuments({ isAiEnriched: false });
      const remainingChunks = Math.ceil(remainingPending / CHUNK_SIZE);
      const etaMs = remainingChunks * DELAY_MS;
      console.log(`   📊 Progress: Enriched: ${inserted} | Failed: ${failed} | Elapsed: ${formatDuration(elapsed)} | ETA: ${formatDuration(etaMs)}\n`);

      batchIndex++;

      // Rate limit delay
      await delay(DELAY_MS);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 Bulk Enrichment Complete!');
    console.log(`   - Enriched: ${inserted}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Total time: ${formatDuration(Date.now() - startTime)}`);
    if (failedWords.length > 0) {
      const uniqueFailed = Array.from(new Set(failedWords));
      console.log(`   - Failed words (need to retry): ${uniqueFailed.slice(0, 100).join(', ')}${uniqueFailed.length > 100 ? '...' : ''}`);
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
