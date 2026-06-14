import dotenv from 'dotenv';
dotenv.config();

import connectMongoDB from '../lib/mongodb';
import Word from '../models/Dictionary';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// Use gemini-2.0-flash — the current stable model
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const DELAY_MS = 4500; // 4.5 s between requests

// Placeholder text that the old seed script inserted as a fake second sentence
const PLACEHOLDER = 'The word is commonly used to express this concept in everyday communication.';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ask Gemini for exactly 2 natural example sentences for `word`.
 * Returns an array of exactly 2 strings.
 */
async function getTwoSentences(
  word: string,
  meaning: string,
  existing: string[]
): Promise<string[]> {
  // Keep only real (non-placeholder) existing sentences
  const realExisting = existing.filter((s) => s !== PLACEHOLDER && s.trim().length > 10);

  const existingNote =
    realExisting.length > 0
      ? `The word already has this example sentence — do NOT repeat it:\n"${realExisting[0]}"\n\nGenerate 1 NEW sentence that shows a DIFFERENT context or usage.`
      : `Generate 2 natural, varied example sentences that clearly show different usages/contexts of the word.`;

  const needCount = realExisting.length > 0 ? 1 : 2;

  const prompt = `
You are a vocabulary expert.

Word: "${word}"
Meaning: "${meaning}"

${existingNote}

Return ONLY a valid JSON array of ${needCount} natural example sentence(s). No markdown, no explanation, no backticks.
Example format: ["She was happy to see her old friend after years apart.", "The happy couple danced under the stars all night long."]
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim().replace(/```json|```/g, '').trim();

  const parsed: string[] = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('Response was not an array');

  // Combine real existing + new, take first 2
  const combined = [...realExisting, ...parsed].slice(0, 2);

  // Safety pad
  while (combined.length < 2) {
    combined.push(`The concept of ${word} is often encountered in reading and everyday conversation.`);
  }

  return combined;
}

async function patchSentences() {
  await connectMongoDB();

  // Find all words that have < 2 sentences OR have the ugly placeholder
  const words = await Word.find({
    $or: [
      { sentences: { $size: 0 } },
      { sentences: { $size: 1 } },
      { sentences: { $exists: false } },
      { sentences: { $elemMatch: { $eq: PLACEHOLDER } } },
    ],
  }).select('word meaning sentences level');


  console.log('\n🔧 Wordly — Sentence Patch Script');
  console.log(`📋 Found ${words.length} words with < 2 sentences to patch.`);

  if (words.length === 0) {
    console.log('✅ All words already have 2+ sentences. Nothing to do!');
    process.exit(0);
  }

  console.log(`⏱️  Rate limit: 1 word every ${DELAY_MS / 1000}s (~${Math.round(60000 / DELAY_MS)} RPM)`);
  const estimatedMins = Math.ceil((words.length * DELAY_MS) / 60000);
  console.log(`⏳ Estimated time: ~${estimatedMins} minute(s) for ${words.length} words\n`);

  let patched = 0;
  let failed = 0;
  const failedWords: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const doc = words[i];
    const wordStr = doc.word;
    const existing: string[] = Array.isArray(doc.sentences) ? doc.sentences.filter(Boolean) : [];

    process.stdout.write(`[${i + 1}/${words.length}] "${wordStr}" (${doc.level}) — `);

    try {
      const newSentences = await getTwoSentences(wordStr, doc.meaning, existing);

      await Word.updateOne(
        { _id: doc._id },
        { $set: { sentences: newSentences } }
      );

      patched++;
      console.log(`✅  "${newSentences[0].slice(0, 60)}..."`);

      await delay(DELAY_MS);
    } catch (err: any) {
      failed++;
      failedWords.push(wordStr);
      console.log(`❌  Failed: ${err.message}`);
      await delay(DELAY_MS);
    }

    // Progress summary every 20 words
    if ((i + 1) % 20 === 0) {
      console.log(`\n   📊 Progress: ${patched} patched, ${failed} failed out of ${i + 1} processed\n`);
    }
  }

  console.log('\n' + '═'.repeat(55));
  console.log('🎉 PATCH COMPLETE');
  console.log('═'.repeat(55));
  console.log(`   ✅ Patched  : ${patched}`);
  console.log(`   ❌ Failed   : ${failed}`);

  if (failedWords.length > 0) {
    console.log(`\n⚠️  Failed words (re-run to retry): ${failedWords.join(', ')}`);
  }

  // Verify
  const remaining = await Word.countDocuments({
    $or: [
      { sentences: { $size: 0 } },
      { sentences: { $size: 1 } },
    ],
  });
  console.log(`\n📚 Words still with < 2 sentences: ${remaining}`);
  console.log('═'.repeat(55) + '\n');

  process.exit(0);
}

patchSentences().catch((err) => {
  console.error('❌ Patch script crashed:', err);
  process.exit(1);
});
