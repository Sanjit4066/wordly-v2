import { Router, Request, Response } from 'express';
import { triggerBatchNow } from '../cron/batchWordProcessor';
import { triggerQuizGenerationNow } from '../cron/quizGenerator';
import { triggerDailyExpansionNow } from '../cron/dailyDictionaryExpander';
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

// POST /api/admin/trigger-expander — manually kick off the daily dictionary expansion
router.post('/trigger-expander', async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  // Fire-and-forget — expansion takes ~75 min, don't block the HTTP response
  res.json({ success: true, message: 'Daily dictionary expansion started in background. Check server logs for progress.' });

  triggerDailyExpansionNow().catch((err) =>
    console.error('❌ [Admin] Manual expander trigger failed:', err)
  );
});

// GET /api/admin/expansion-status — how many master-list words are still unprocessed
router.get('/expansion-status', async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const totalInDB = await Word.countDocuments({ addedVia: 'ai_batch' });
    const stats = await Word.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const pending = await WordRequest.countDocuments({ status: 'pending' });

    res.json({
      totalAIBatchWords: totalInDB,
      byLevel: stats,
      pendingUserRequests: pending,
      nextRunScheduled: '5:00 AM EST daily (10:00 UTC)',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
