import dotenv from 'dotenv';
dotenv.config();
import connectMongoDB from '../lib/mongodb';
import Word from '../models/Dictionary';
import { MASTER_WORD_LIST } from '../cron/dailyDictionaryExpander';

async function check() {
  try {
    await connectMongoDB();
    
    // Get total words in dictionary
    const total = await Word.countDocuments();
    console.log(`Total words in dictionary: ${total}`);

    // Get count of words added via expander ('ai_batch')
    const expanderTotal = await Word.countDocuments({ addedVia: 'ai_batch' });
    console.log(`Words added via expander (ai_batch): ${expanderTotal}`);

    // Get count of words added today (June 16, 2026 IST, which is 2026-06-15T23:30:00.000Z to 2026-06-16T23:30:00.000Z)
    const todayStart = new Date('2026-06-15T23:30:00.000Z');
    const todayEnd = new Date('2026-06-16T23:30:00.000Z');
    
    const addedToday = await Word.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });
    console.log(`Words created today (June 16 IST): ${addedToday}`);

    // Let's get the breakdown of words created today by addedVia
    const breakdown = await Word.aggregate([
      { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: '$addedVia', count: { $sum: 1 } } }
    ]);
    console.log('Today\'s breakdown by source:', breakdown);

    // Simulate getBalancedWordsToProcess
    const existingWords = await Word.distinct('word');
    const existingSet = new Set<string>(existingWords);
    const batchSize = 600;

    const remainingByLevel: Record<string, string[]> = {
      beginner: MASTER_WORD_LIST.slice(0, 334).map((w) => w.toLowerCase().trim()).filter((w) => !existingSet.has(w)),
      intermediate: MASTER_WORD_LIST.slice(334, 610).map((w) => w.toLowerCase().trim()).filter((w) => !existingSet.has(w)),
      advanced: MASTER_WORD_LIST.slice(610, 850).map((w) => w.toLowerCase().trim()).filter((w) => !existingSet.has(w)),
      expert: MASTER_WORD_LIST.slice(850, 1210).map((w) => w.toLowerCase().trim()).filter((w) => !existingSet.has(w)),
    };

    console.log('--- Remaining by level (filtered against DB) ---');
    console.log(`beginner: ${remainingByLevel.beginner.length}`);
    console.log(`intermediate: ${remainingByLevel.intermediate.length}`);
    console.log(`advanced: ${remainingByLevel.advanced.length}`);
    console.log(`expert: ${remainingByLevel.expert.length}`);

    const stats = await Word.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]);

    const currentCounts: Record<string, number> = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      expert: 0,
    };
    stats.forEach((s) => {
      if (s._id) {
        currentCounts[s._id] = s.count;
      }
    });

    console.log('--- Current DB counts ---', currentCounts);

    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const toProcess: string[] = [];
    const tempCounts = { ...currentCounts };

    let steps = 0;
    while (toProcess.length < batchSize) {
      steps++;
      let bestLevel: string | null = null;
      let minCount = Infinity;

      for (const level of levels) {
        if (remainingByLevel[level].length > 0 && tempCounts[level] < minCount) {
          minCount = tempCounts[level];
          bestLevel = level;
        }
      }

      if (!bestLevel) {
        console.log(`Stopped in simulation after ${toProcess.length} words because bestLevel is null.`);
        break;
      }

      const word = remainingByLevel[bestLevel].pop()!;
      toProcess.push(word);
      tempCounts[bestLevel]++;
    }

    console.log(`Simulation returned ${toProcess.length} words to process.`);

    // Let's print the absolute most recent 5 words in the database
    const recent = await Word.find().sort({ createdAt: -1 }).limit(5);

    if (recent.length > 0) {
      console.log('Recent 5 words in dictionary:', recent.map(w => `${w.word} (${w.level}) created at ${w.createdAt}`));
    }

    process.exit(0);
  } catch (e) {
    console.error('FATAL:', e);
    process.exit(1);
  }
}
check();
