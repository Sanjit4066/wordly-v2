import { Router, Request, Response } from 'express';
import UserSentence from '../models/UserSentences';

const router = Router();

// GET /api/sentences/:wordId — fetch all active sentences for a word
router.get('/:wordId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const doc = await UserSentence.findOne({ userId, wordId: req.params.wordId });
    if (!doc) return res.json({ sentences: [] });

    const active = doc.sentences.filter((s) => !s.isDeleted);
    res.json({ sentences: active });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sentences — save a new sentence
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const { wordId, text } = req.body;
    if (!wordId || !text) {
      return res.status(400).json({ error: 'wordId and text are required' });
    }

    const now = new Date();
    const newSentence = { text, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null };

    const doc = await UserSentence.findOneAndUpdate(
      { userId, wordId },
      { $push: { sentences: newSentence } },
      { upsert: true, new: true }
    );

    res.json({ success: true, sentence: doc.sentences[doc.sentences.length - 1] });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/sentences/:wordId/:sentenceId — edit a sentence
router.put('/:wordId/:sentenceId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    await UserSentence.findOneAndUpdate(
      { userId, wordId: req.params.wordId, 'sentences._id': req.params.sentenceId },
      {
        $set: {
          'sentences.$.text': text,
          'sentences.$.updatedAt': new Date(),
        },
      }
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/sentences/:wordId/:sentenceId — soft delete
router.delete('/:wordId/:sentenceId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    await UserSentence.findOneAndUpdate(
      { userId, wordId: req.params.wordId, 'sentences._id': req.params.sentenceId },
      {
        $set: {
          'sentences.$.isDeleted': true,
          'sentences.$.deletedAt': new Date(),
        },
      }
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
