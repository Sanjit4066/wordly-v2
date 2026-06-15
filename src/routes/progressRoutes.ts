import { Router, Request, Response } from 'express';
import UserProgress from '../models/UserProgress';

const router = Router();

// GET /api/progress/heatmap — calendar activity data (GitHub-style)
router.get('/heatmap', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const entries = await UserProgress.find(
      { userId, seenAt: { $gte: sixMonthsAgo } },
      'seenAt'
    );

    // Group by date string
    const heatmap: Record<string, number> = {};
    entries.forEach((e) => {
      const dateKey = e.seenAt.toISOString().split('T')[0];
      heatmap[dateKey] = (heatmap[dateKey] || 0) + 1;
    });

    res.json({ heatmap });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/progress/streak — current streak count
router.get('/streak', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const entries = await UserProgress.find({ userId }, 'seenAt').sort({ seenAt: -1 });

    const uniqueDates = [
      ...new Set(entries.map((e) => e.seenAt.toISOString().split('T')[0])),
    ].sort((a, b) => (a > b ? -1 : 1));

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = today;

    for (const date of uniqueDates) {
      if (date === checkDate) {
        streak++;
        const prev = new Date(checkDate);
        prev.setDate(prev.getDate() - 1);
        checkDate = prev.toISOString().split('T')[0];
      } else {
        break;
      }
    }

    res.json({ streak });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/progress/mastery — mastery breakdown
router.get('/mastery', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const breakdown = await UserProgress.aggregate([
      { $match: { userId } },
      { $group: { _id: '$masteryLevel', count: { $sum: 1 } } },
    ]);

    const formatted = breakdown.reduce((acc: any, b: any) => {
      acc[b._id] = b.count;
      return acc;
    }, { seen: 0, practiced: 0, familiar: 0, mastered: 0 });

    res.json({ mastery: formatted });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/progress/words/:level — get words for a specific mastery level
router.get('/words/:level', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const { level } = req.params;
    const validLevels = ['seen', 'practiced', 'familiar', 'mastered'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ error: 'Invalid mastery level' });
    }

    const entries = await UserProgress.find(
      { userId, masteryLevel: level },
      'wordId seenAt'
    ).sort({ seenAt: -1 });

    const words = entries.map(e => e.wordId);
    
    res.json({ words });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/progress/mark — manually set a word's mastery level
router.post('/mark', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const { wordId, masteryLevel } = req.body;
    const validLevels = ['seen', 'practiced', 'familiar', 'mastered'];
    if (!wordId || !validLevels.includes(masteryLevel)) {
      return res.status(400).json({ error: 'wordId and valid masteryLevel required' });
    }

    await UserProgress.findOneAndUpdate(
      { userId, wordId },
      { $set: { masteryLevel } },
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
