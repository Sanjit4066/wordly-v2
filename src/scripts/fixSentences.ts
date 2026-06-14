/**
 * fixSentences.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Directly patches the 15 manually-seeded words that have a generic placeholder
 * as their second sentence with high-quality, real example sentences.
 * No AI API calls needed — runs instantly.
 *
 * Usage:  npx ts-node src/scripts/fixSentences.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from 'dotenv';
dotenv.config();

import connectMongoDB from '../lib/mongodb';
import Word from '../models/Dictionary';

// High-quality replacement sentences for each manually seeded word.
// Each entry: [realSentence1, realSentence2]
const SENTENCE_MAP: Record<string, [string, string]> = {
  // ── BEGINNER ─────────────────────────────────────────────────────────────
  happy: [
    'She was happy to see her old friend after years apart.',
    'The children were happy playing in the park on a sunny afternoon.',
  ],
  brave: [
    'The brave firefighter ran into the burning building to save the trapped family.',
    'It takes a brave person to stand up and speak the truth when it is unpopular.',
  ],
  calm: [
    'He remained calm during the crisis, which helped everyone around him focus.',
    'The calm surface of the lake reflected the mountains perfectly at dawn.',
  ],
  curious: [
    'The curious child asked many questions about how aeroplanes stay in the sky.',
    'She was curious about the strange noise coming from behind the old bookshelf.',
  ],

  // ── INTERMEDIATE ─────────────────────────────────────────────────────────
  eloquent: [
    'The eloquent speaker moved the entire audience to tears with her tribute.',
    'His eloquent defence of the proposal convinced even the most sceptical board members.',
  ],
  resilient: [
    'Children are often more resilient than adults expect when facing hardship.',
    'The resilient startup rebuilt itself stronger after losing its biggest client.',
  ],
  ambiguous: [
    'The ambiguous wording of the contract caused a lengthy legal dispute.',
    'His ambiguous smile left everyone wondering whether he was pleased or disappointed.',
  ],
  persist: [
    'She persisted in her efforts despite repeated failures and discouraging setbacks.',
    'The scientist chose to persist with the experiment even when early results were unclear.',
  ],

  // ── ADVANCED ─────────────────────────────────────────────────────────────
  ephemeral: [
    'The ephemeral beauty of cherry blossoms makes them all the more precious.',
    'Fame can be ephemeral — celebrities who seem unstoppable often fade from public memory within a decade.',
  ],
  laconic: [
    'His laconic reply — simply "No" — ended the three-hour negotiation instantly.',
    'The laconic general issued only three words before the battle: "Do not yield."',
  ],
  serendipity: [
    'By pure serendipity, she ran into her future business partner at an airport café.',
    'The discovery of penicillin was a famous case of scientific serendipity.',
  ],
  melancholy: [
    'The grey autumn skies filled him with a deep, inexplicable melancholy.',
    'There was a gentle melancholy in her eyes as she read the old letters from home.',
  ],

  // ── EXPERT ───────────────────────────────────────────────────────────────
  solipsism: [
    'His philosophical solipsism made meaningful conversation nearly impossible — he doubted the very existence of others.',
    'The novel explores solipsism through a narrator who gradually loses faith in any reality beyond his own mind.',
  ],
  limerence: [
    'Her limerence for him consumed her every waking thought and made concentration impossible.',
    'Psychologists distinguish limerence from mature love by its obsessive, involuntary nature.',
  ],
  eudaimonia: [
    'Aristotle believed eudaimonia — true flourishing — was the ultimate goal of human life.',
    'Modern positive psychology echoes the ancient idea of eudaimonia: that genuine happiness comes from meaning, not just pleasure.',
  ],
};

async function fixSentences() {
  await connectMongoDB();

  const wordList = Object.keys(SENTENCE_MAP);
  console.log('\n🔧 Wordly — Direct Sentence Fix Script');
  console.log(`📋 Patching ${wordList.length} words with high-quality example sentences...\n`);

  let patched = 0;
  let notFound = 0;

  for (const word of wordList) {
    const sentences = SENTENCE_MAP[word];
    const result = await Word.updateOne(
      { word },
      { $set: { sentences } }
    );

    if (result.matchedCount === 0) {
      console.log(`⚠️  "${word}" — not found in DB (skipping)`);
      notFound++;
    } else {
      console.log(`✅  "${word}" → ["${sentences[0].slice(0, 55)}...", "${sentences[1].slice(0, 55)}..."]`);
      patched++;
    }
  }

  // Verify remaining bad sentences
  const remaining = await Word.countDocuments({
    $or: [
      { sentences: { $size: 0 } },
      { sentences: { $size: 1 } },
      { sentences: { $elemMatch: { $eq: 'The word is commonly used to express this concept in everyday communication.' } } },
    ],
  });

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 FIX COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   ✅ Patched  : ${patched}`);
  console.log(`   ⚠️  Not found: ${notFound}`);
  console.log(`   📚 Words still needing sentences: ${remaining}`);
  console.log('═'.repeat(60) + '\n');

  process.exit(0);
}

fixSentences().catch((err) => {
  console.error('❌ Fix script crashed:', err);
  process.exit(1);
});
