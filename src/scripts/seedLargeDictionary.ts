import dotenv from 'dotenv';
dotenv.config();

import https from 'https';
import connectMongoDB from '../lib/mongodb';
import Word from '../models/Dictionary';
import { DifficultyLevel } from '../models/Dictionary';

const DATASET_URL = 'https://raw.githubusercontent.com/adambom/dictionary/master/dictionary.json';
const CHUNK_SIZE = 5000;
const TARGET_WORD_COUNT = 30000;

function downloadDataset(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading dictionary dataset from: ${url}...`);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download dictionary. Status Code: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('✅ Download complete.');
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function parsePartOfSpeech(definition: string): string {
  const cleanDef = definition.trim().toLowerCase();
  if (cleanDef.startsWith('n.') || cleanDef.startsWith('pl. n.') || cleanDef.startsWith('n. pl.')) return 'noun';
  if (cleanDef.startsWith('v.') || cleanDef.startsWith('v. t.') || cleanDef.startsWith('v. i.')) return 'verb';
  if (cleanDef.startsWith('a.') || cleanDef.startsWith('adj.')) return 'adjective';
  if (cleanDef.startsWith('adv.')) return 'adverb';
  if (cleanDef.startsWith('prep.')) return 'preposition';
  if (cleanDef.startsWith('conj.')) return 'conjunction';
  if (cleanDef.startsWith('interj.')) return 'interjection';
  if (cleanDef.startsWith('pron.')) return 'pronoun';
  return 'noun'; // default fallback
}

function classifyLevel(word: string): DifficultyLevel {
  const len = word.length;
  if (len <= 5) return 'beginner';
  if (len <= 7) return 'intermediate';
  if (len <= 9) return 'advanced';
  return 'expert';
}

async function startSeeding() {
  try {
    await connectMongoDB();

    // 1. Fetch existing words to prevent duplicate keys in MongoDB
    console.log('🔍 Fetching existing words from database...');
    const existingWords = new Set<string>();
    const dbWords = await Word.distinct('word');
    dbWords.forEach(w => existingWords.add(w.toLowerCase().trim()));
    console.log(`ℹ️  Found ${existingWords.size} words already in the database.`);

    // 2. Download and parse the raw JSON dictionary
    const rawData = await downloadDataset(DATASET_URL);
    console.log('Parsing JSON dictionary...');
    const rawDict = JSON.parse(rawData) as Record<string, string>;
    const rawEntries = Object.entries(rawDict);
    console.log(`Total raw entries parsed: ${rawEntries.length}`);

    // 3. Clean and filter words
    const wordsToInsert: any[] = [];
    const alphabeticalOrder = rawEntries.sort((a, b) => a[0].localeCompare(b[0]));

    for (const [rawWord, definition] of alphabeticalOrder) {
      const word = rawWord.toLowerCase().trim();

      // Filter: Clean single words only (no hyphens, no apostrophes, no spaces, length >= 3)
      if (!/^[a-z]{3,15}$/.test(word)) continue;
      if (existingWords.has(word)) continue;

      const partOfSpeech = parsePartOfSpeech(definition);
      const level = classifyLevel(word);

      // Simple clean definition (remove the leading part of speech tags if any)
      const cleanMeaning = definition.replace(/^[a-z]+\.\s+|^[a-z]+\.\s+[a-z]+\.\s+/, '').trim();

      wordsToInsert.push({
        word,
        meaning: cleanMeaning || 'Definition not available.',
        sentences: [
          `Using the word "${word}" in a sentence helps reinforce its definition and proper context.`,
          `Daily vocabulary practice with terms like "${word}" promotes greater precision in communication.`
        ],
        level,
        synonyms: [],
        antonyms: [],
        etymology: '',
        partOfSpeech,
        addedVia: 'static',
        isAiEnriched: false
      });

      // Stop once we hit our target count (plus existing ones if needed, but let's target adding TARGET_WORD_COUNT new words)
      if (wordsToInsert.length >= TARGET_WORD_COUNT) {
        break;
      }
    }

    console.log(`📋 Prepared ${wordsToInsert.length} clean words to insert into MongoDB.`);

    if (wordsToInsert.length === 0) {
      console.log('✅ No new words to insert. Dictionary is already fully seeded!');
      process.exit(0);
    }

    // 4. Bulk insert in chunks
    console.log(`🚀 Starting bulk insertion of ${wordsToInsert.length} words in chunks of ${CHUNK_SIZE}...`);
    let totalInserted = 0;
    
    for (let i = 0; i < wordsToInsert.length; i += CHUNK_SIZE) {
      const chunk = wordsToInsert.slice(i, i + CHUNK_SIZE);
      
      try {
        await Word.insertMany(chunk, { ordered: false });
        totalInserted += chunk.length;
        console.log(`✅ Seeded chunk ${Math.floor(i / CHUNK_SIZE) + 1} (${chunk.length} words) - Total: ${totalInserted}/${wordsToInsert.length}`);
      } catch (err: any) {
        // Since ordered: false is set, some duplicates might fail but others succeed
        if (err.writeErrors) {
          const succeeded = chunk.length - err.writeErrors.length;
          totalInserted += succeeded;
          console.log(`⚠️  Seeded chunk ${Math.floor(i / CHUNK_SIZE) + 1} with ${err.writeErrors.length} validation/duplicate skips (Inserted: ${succeeded} words)`);
        } else {
          console.error(`❌ Error seeding chunk starting at index ${i}:`, err.message);
        }
      }
    }

    console.log(`\n🎉 Seeding complete! Added ${totalInserted} new words to your library.`);
    const newTotal = await Word.countDocuments();
    console.log(`📚 Total words in dictionary database: ${newTotal}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding script failed:', error);
    process.exit(1);
  }
}

startSeeding();
