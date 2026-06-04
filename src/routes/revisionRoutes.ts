import { Router, Request, Response } from 'express';
import UserProgress from '../models/UserProgress';
import Word from '../models/Dictionary';
import { calculateNextReview, SelfMark } from '../models/UserProgress';

const router = Router();

// ─── GET /api/revision/due ────────────────────────────────────────────────────
// Returns all words due for review today (spaced repetition)
router.get('/due', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const now = new Date();

    const dueProgress = await UserProgress.find({
      userId,
      nextReviewAt: { $lte: now },
      masteryLevel: { $ne: 'mastered' },
    }).sort({ nextReviewAt: 1 });

    const wordIds = dueProgress.map((p) => p.wordId);
    const words = await Word.find({ word: { $in: wordIds } });

    const wordMap = Object.fromEntries(words.map((w) => [w.word, w]));

    const result = dueProgress.map((p) => ({
      progress: p,
      word: wordMap[p.wordId] || null,
    }));

    res.json({ due: result, count: result.length });
  } catch (error: any) {
    console.error('Revision due error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/revision/yesterday ─────────────────────────────────────────────
// Returns yesterday's Word of Day for self-assessment
router.get('/yesterday', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const progress = await UserProgress.findOne({
      userId,
      seenAt: { $gte: yesterday, $lte: endOfYesterday },
    });

    if (!progress) {
      return res.json({
        found: false,
        message: "No word was learned yesterday. Don't forget your daily word!",
      });
    }

    const word = await Word.findOne({ word: progress.wordId });
    if (!word) {
      return res.json({ found: false, message: 'Word data not found.' });
    }

    res.json({ found: true, word, progress });
  } catch (error: any) {
    console.error('Yesterday revision error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/revision/self-mark ────────────────────────────────────────────
// User submits self-assessment result (got_it / needs_practice)
router.post('/self-mark', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const { wordId, selfMark } = req.body as { wordId: string; selfMark: SelfMark };

    if (!wordId || !['got_it', 'needs_practice'].includes(selfMark)) {
      return res.status(400).json({ error: 'wordId and selfMark (got_it | needs_practice) required' });
    }

    const progress = await UserProgress.findOne({ userId, wordId });
    if (!progress) {
      return res.status(404).json({ error: 'Progress entry not found' });
    }

    const newReviewCount = progress.reviewCount + 1;
    const { nextReviewAt, masteryLevel } = calculateNextReview(newReviewCount, selfMark);

    // Keep masteryLevel if needs_practice (don't demote)
    const updatedMastery =
      selfMark === 'needs_practice' ? progress.masteryLevel : masteryLevel;

    await UserProgress.findByIdAndUpdate(progress._id, {
      selfMark,
      reviewCount: newReviewCount,
      lastReviewed: new Date(),
      nextReviewAt,
      masteryLevel: updatedMastery,
    });

    res.json({
      success: true,
      nextReviewAt,
      masteryLevel: updatedMastery,
      reviewCount: newReviewCount,
    });
  } catch (error: any) {
    console.error('Self mark error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
