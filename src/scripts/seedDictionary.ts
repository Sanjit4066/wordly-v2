import dotenv from 'dotenv';
dotenv.config();

import connectMongoDB from '../lib/mongodb';
import Word from '../models/Dictionary';

const seedWords = [
  // ─── BEGINNER ─────────────────────────────────────────────────────────────
  {
    word: 'happy', meaning: 'Feeling or showing pleasure or contentment.', sentence: 'She was happy to see her old friend.', level: 'beginner', synonyms: ['joyful', 'cheerful', 'pleased', 'content'], antonyms: ['sad', 'unhappy', 'miserable'], etymology: 'From Old Norse "happ" meaning luck or chance.', partOfSpeech: 'adjective', addedVia: 'manual',
  },
  {
    word: 'brave', meaning: 'Ready to face and endure danger or pain without showing fear.', sentence: 'The brave firefighter ran into the burning building.', level: 'beginner', synonyms: ['courageous', 'bold', 'fearless'], antonyms: ['cowardly', 'timid'], etymology: 'From Latin "barbarus" meaning wild or fierce.', partOfSpeech: 'adjective', addedVia: 'manual',
  },
  {
    word: 'calm', meaning: 'Not showing or feeling nervousness, anger, or other strong emotions.', sentence: 'He remained calm during the crisis.', level: 'beginner', synonyms: ['serene', 'peaceful', 'tranquil'], antonyms: ['agitated', 'anxious', 'turbulent'], etymology: 'From Greek "kauma" meaning heat of the day, when everything is still.', partOfSpeech: 'adjective', addedVia: 'manual',
  },
  {
    word: 'curious', meaning: 'Eager to know or learn something.', sentence: 'The curious child asked many questions.', level: 'beginner', synonyms: ['inquisitive', 'interested', 'nosy'], antonyms: ['indifferent', 'uninterested'], etymology: 'From Latin "curiosus" meaning careful, diligent, curious.', partOfSpeech: 'adjective', addedVia: 'manual',
  },

  // ─── INTERMEDIATE ─────────────────────────────────────────────────────────
  {
    word: 'eloquent', meaning: 'Fluent or persuasive in speaking or writing.', sentence: 'The eloquent speaker moved the entire audience to tears.', level: 'intermediate', synonyms: ['articulate', 'fluent', 'expressive'], antonyms: ['inarticulate', 'tongue-tied'], etymology: 'From Latin "eloqui" meaning to speak out.', partOfSpeech: 'adjective', addedVia: 'manual',
  },
  {
    word: 'resilient', meaning: 'Able to recover quickly from difficulties; tough.', sentence: 'Children are often more resilient than adults expect.', level: 'intermediate', synonyms: ['tough', 'adaptable', 'robust'], antonyms: ['fragile', 'vulnerable'], etymology: 'From Latin "resilire" meaning to spring back.', partOfSpeech: 'adjective', addedVia: 'manual',
  },
  {
    word: 'ambiguous', meaning: 'Open to more than one interpretation; not having one obvious meaning.', sentence: 'The ambiguous wording of the contract caused legal disputes.', level: 'intermediate', synonyms: ['unclear', 'vague', 'equivocal'], antonyms: ['clear', 'definite', 'unambiguous'], etymology: 'From Latin "ambiguus" meaning doubtful, from "ambigere" to wander.', partOfSpeech: 'adjective', addedVia: 'manual',
  },
  {
    word: 'persist', meaning: 'To continue firmly in a course of action despite difficulty or opposition.', sentence: 'She persisted in her efforts despite repeated failures.', level: 'intermediate', synonyms: ['persevere', 'endure', 'continue'], antonyms: ['give up', 'quit', 'abandon'], etymology: 'From Latin "persistere" meaning to stand firm.', partOfSpeech: 'verb', addedVia: 'manual',
  },

  // ─── ADVANCED ──────────────────────────────────────────────────────────────
  {
    word: 'ephemeral', meaning: 'Lasting for a very short time; transitory.', sentence: 'The ephemeral beauty of cherry blossoms makes them all the more precious.', level: 'advanced', synonyms: ['transient', 'fleeting', 'momentary', 'short-lived'], antonyms: ['permanent', 'eternal', 'enduring'], etymology: 'From Greek "ephemeros" meaning lasting only a day.', partOfSpeech: 'adjective', addedVia: 'manual',
  },
  {
    word: 'laconic', meaning: 'Using very few words; brief and concise in speech or expression.', sentence: 'His laconic reply — "No" — ended the discussion.', level: 'advanced', synonyms: ['terse', 'concise', 'succinct', 'brief'], antonyms: ['verbose', 'loquacious', 'wordy'], etymology: 'From Greek "Lakonikos" referring to Sparta (Laconia), whose inhabitants were known for their brief speech.', partOfSpeech: 'adjective', addedVia: 'manual',
  },
  {
    word: 'serendipity', meaning: 'The occurrence of events by chance in a happy or beneficial way.', sentence: 'By pure serendipity, she ran into her future business partner at the airport.', level: 'advanced', synonyms: ['chance', 'luck', 'fortuitousness'], antonyms: ['misfortune', 'design', 'intention'], etymology: 'Coined by Horace Walpole in 1754 from the Persian fairy tale "The Three Princes of Serendip".', partOfSpeech: 'noun', addedVia: 'manual',
  },
  {
    word: 'melancholy', meaning: 'A feeling of pensive sadness, typically with no obvious cause.', sentence: 'The grey skies filled him with a deep melancholy.', level: 'advanced', synonyms: ['sadness', 'gloom', 'sorrow', 'despondency'], antonyms: ['happiness', 'joy', 'elation'], etymology: 'From Greek "melas" (black) + "khole" (bile), based on the ancient theory of humours.', partOfSpeech: 'noun', addedVia: 'manual',
  },

  // ─── EXPERT ────────────────────────────────────────────────────────────────
  {
    word: 'solipsism', meaning: 'The theory or view that the self is the only thing that can be known to exist.', sentence: 'His philosophical solipsism made meaningful conversation nearly impossible.', level: 'expert', synonyms: ['self-absorption', 'egocentrism'], antonyms: ['altruism', 'empathy'], etymology: 'From Latin "solus" (alone) + "ipse" (self).', partOfSpeech: 'noun', addedVia: 'manual',
  },
  {
    word: 'limerence', meaning: 'The state of being infatuated with another person, characterized by obsessive thoughts and a desire for reciprocation.', sentence: 'Her limerence for him consumed her every waking thought.', level: 'expert', synonyms: ['infatuation', 'obsession'], antonyms: ['indifference', 'aversion'], etymology: 'Coined by psychologist Dorothy Tennov in 1979 from her research on romantic obsession.', partOfSpeech: 'noun', addedVia: 'manual',
  },
  {
    word: 'eudaimonia', meaning: 'A Greek concept of human flourishing and living well; the highest form of happiness achieved through virtue.', sentence: 'Aristotle believed eudaimonia was the ultimate goal of human life.', level: 'expert', synonyms: ['flourishing', 'well-being', 'fulfillment'], antonyms: ['misery', 'suffering'], etymology: 'From Greek "eu" (good) + "daimon" (spirit), literally meaning "good spirit".', partOfSpeech: 'noun', addedVia: 'manual',
  },
];

async function seed() {
  await connectMongoDB();

  console.log(`\n🌱 Seeding ${seedWords.length} words across 4 difficulty levels...`);

  let inserted = 0;
  let skipped = 0;

  for (const wordData of seedWords) {
    try {
      await Word.findOneAndUpdate(
        { word: wordData.word },
        { $setOnInsert: wordData },
        { upsert: true }
      );
      inserted++;
    } catch {
      skipped++;
    }
  }

  // Print summary by level
  const stats = await Word.aggregate([
    { $group: { _id: '$level', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log('\n📚 Dictionary Summary After Seeding:');
  stats.forEach((s: any) => console.log(`   ${s._id.padEnd(14)}: ${s.count} word(s)`));
  console.log(`\n✅ Done. Inserted: ${inserted}, Skipped (already exist): ${skipped}\n`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
