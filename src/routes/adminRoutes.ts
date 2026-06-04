import { Router, Request, Response } from 'express';
import { triggerBatchNow } from '../cron/batchWordProcessor';
import { triggerQuizGenerationNow } from '../cron/quizGenerator';
import Word from '../models/Dictionary';
import WordRequest from '../models/WordRequests';

const router = Router();

// Simple admin key check (replace with proper auth in production)
function isAdmin(req: Request): boolean {
  return req.headers['x-admin-key'] === process.env.ADMIN_KEY;
}

// POST /api/admin/trigger-batch — manually run the batch processor (for testing)
router.post('/trigger-batch', async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    console.log('🔧 [Admin] Manual batch trigger initiated');
    await triggerBatchNow();
    res.json({ success: true, message: 'Batch processing complete. Check server logs.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/trigger-quiz — manually run quiz generation
router.post('/trigger-quiz', async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    await triggerQuizGenerationNow();
    res.json({ success: true, message: 'Quiz generation complete.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/dictionary-stats — see words per difficulty level
router.get('/dictionary-stats', async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const stats = await Word.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 }, words: { $push: '$word' } } },
      { $sort: { _id: 1 } },
    ]);

    const pending = await WordRequest.countDocuments({ status: 'pending' });
    const failed = await WordRequest.countDocuments({ status: 'failed' });

    res.json({ dictionary: stats, pendingRequests: pending, failedRequests: failed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
