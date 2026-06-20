import { Router, Request, Response } from 'express';
import fs from 'fs';
import wordListModule from 'word-list';
import Word from '../models/Dictionary';
import WordRequest from '../models/WordRequests';
import UserProgress from '../models/UserProgress';
import { DifficultyLevel } from '../models/Dictionary';

const wordListPath = (wordListModule as any).default || wordListModule;
const wordArray = fs.readFileSync(wordListPath as string, 'utf8').split('\n');
const englishDictionary = new Set(wordArray);

const router = Router();

// ─── GET /api/word/search?q=ephemeral ────────────────────────────────────────
// 1. Check dictionary first
// 2. If found → return immediately (no AI)
// 3. If not found → log word request for nightly batch
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string)?.toLowerCase().trim();
    const userId = req.headers['x-user-id'] as string;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Dictionary hit
    const word = await Word.findOne({ word: q });
    if (word) {
      // Increment searchCount in the background for prioritization
      Word.updateOne({ _id: word._id }, { $inc: { searchCount: 1 } }).catch(err =>
        console.error(`Error incrementing searchCount for "${q}":`, err.message)
      );

      return res.json({
        found: true,
        source: 'dictionary',
        data: word,
      });
    }

    // ── Offline Spelling Check ──
    if (!englishDictionary.has(q)) {
      return res.json({
        found: false,
        validSpelling: false,
        message: `"${q}" does not appear to be spelled correctly.`,
      });
    }

    // Word not in dictionary → create or update word request
    if (userId) {
      const existingRequest = await WordRequest.findOne({ word: q });

      if (existingRequest) {
        if (!existingRequest.requestedBy.includes(userId)) {
          await WordRequest.findByIdAndUpdate(existingRequest._id, {
            $push: { requestedBy: userId },
            $inc: { requestCount: 1 },
          });
        }
      } else {
        await WordRequest.create({
          word: q,
          requestedBy: [userId],
          requestCount: 1,
          status: 'pending',
        });
      }
    }

    return res.json({
      found: false,
      validSpelling: true,
      message: `"${q}" is not in our dictionary yet. We've queued it for processing. Check back after midnight!`,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/word/daily ──────────────────────────────────────────────────────
// Returns a personalized Word of Day based on user's level
// Never repeats a word the user has already seen
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const userLevel = (req.headers['x-user-level'] as DifficultyLevel) || 'beginner';

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Get all words user has already seen
    const seenEntries = await UserProgress.find({ userId }, 'wordId');
    const seenWordIds = seenEntries.map((e) => e.wordId);

    // Find an unseen word at the user's level
    let word = await Word.findOne({
      level: userLevel,
      word: { $nin: seenWordIds },
    }).sort({ createdAt: 1 });

    // Level exhausted — promote to next level
    if (!word) {
      const levelOrder: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
      const currentIndex = levelOrder.indexOf(userLevel);

      for (let i = currentIndex + 1; i < levelOrder.length; i++) {
        word = await Word.findOne({
          level: levelOrder[i],
          word: { $nin: seenWordIds },
        }).sort({ createdAt: 1 });
        if (word) break;
      }
    }

    if (!word) {
      return res.json({
        found: false,
        message: 'You have mastered all available words! New words are added daily.',
      });
    }

    // Record this word in user_progress
    await UserProgress.findOneAndUpdate(
      { userId, wordId: word.word },
      {
        $setOnInsert: {
          userId,
          wordId: word.word,
          level: word.level,
          seenAt: new Date(),
          masteryLevel: 'seen',
          reviewCount: 0,
          lastReviewed: null,
          nextReviewAt: (() => {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            return d;
          })(),
          selfMark: null,
        },
      },
      { upsert: true, new: true }
    );

    return res.json({ found: true, data: word });
  } catch (error: any) {
    console.error('Daily word error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/word/level/:level ───────────────────────────────────────────────
// Returns all words in a specific difficulty bucket
// This is the endpoint that powers the level-based word browser
router.get('/level/:level', async (req: Request, res: Response) => {
  try {
    const level = req.params.level as DifficultyLevel;
    const validLevels = ['beginner', 'intermediate', 'advanced', 'expert'];

    if (!validLevels.includes(level)) {
      return res.status(400).json({
        error: `Invalid level. Must be one of: ${validLevels.join(', ')}`,
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [words, total] = await Promise.all([
      Word.find({ level }).sort({ word: 1 }).skip(skip).limit(limit),
      Word.countDocuments({ level }),
    ]);

    return res.json({
      level,
      words,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Level browse error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/word/stats ──────────────────────────────────────────────────────
// Dictionary stats per difficulty level (admin / dashboard use)
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await Word.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const formatted = stats.reduce((acc: any, s: any) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    res.json({
      total: stats.reduce((sum: number, s: any) => sum + s.count, 0),
      byLevel: formatted,
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/word/requests ──────────────────────────────────────────────────
// Fetch all requests submitted by the specific user
router.get('/requests', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const requests = await WordRequest.find({ requestedBy: userId })
      .sort({ createdAt: -1 })
      .limit(50); // Get recent 50 requests

    const doneWords = requests.filter((r) => r.status === 'done').map((r) => r.word);
    const dictionaryWords = await Word.find({ word: { $in: doneWords } });
    
    const wordsMap = dictionaryWords.reduce((acc: any, w: any) => {
      acc[w.word] = w;
      return acc;
    }, {});

    const enrichedRequests = requests.map((r) => {
      const plain: any = r.toObject();
      if (plain.status === 'done' && wordsMap[plain.word]) {
        plain.dictionaryData = wordsMap[plain.word];
      }
      return plain;
    });

    res.json({ requests: enrichedRequests });
  } catch (error: any) {
    console.error('Failed to fetch requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
