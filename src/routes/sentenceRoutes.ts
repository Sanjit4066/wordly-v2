import { Router, Request, Response } from 'express';
import UserSentence from '../models/UserSentences';
import Word from '../models/Dictionary';
import { reviewSentence } from '../agents/sentenceReview';

const router = Router();

// GET /api/sentences/user/all — fetch all words the user has written sentences for
router.get('/user/all', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const docs = await UserSentence.find({ userId }).sort({ updatedAt: -1 });
    const wordIds = docs.map((d) => d.wordId);

    // Fetch word details for each practiced word
    const wordDetails = await Word.find({ word: { $in: wordIds } }, 'word meaning partOfSpeech level');
    const wordMap = new Map(wordDetails.map((w) => [w.word, w]));

    const result = docs.map((doc) => {
      const activeSentences = doc.sentences.filter((s) => !s.isDeleted);
      const wordInfo = wordMap.get(doc.wordId);
      return {
        wordId: doc.wordId,
        meaning: wordInfo?.meaning || '',
        partOfSpeech: wordInfo?.partOfSpeech || '',
        level: wordInfo?.level || '',
        sentenceCount: activeSentences.length,
        lastPracticed: doc.updatedAt,
        sentences: activeSentences,
      };
    }).filter((d) => d.sentenceCount > 0);

    res.json({ words: result });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

    // Run fallback sentence review
    let reviewResult;
    try {
      reviewResult = await reviewSentence(wordId, text);
    } catch (err: any) {
      console.error(`❌ [SentenceReview Route Error]:`, err.message || err);
      // Fallback: save sentence with default review fields
      reviewResult = {
        isCorrectUsage: true,
        grammarIssues: [],
        flowSuggestion: text,
        feedback: 'AI review was temporarily unavailable.',
        source: 'none',
      };
    }

    const now = new Date();
    const newSentence = {
      text,
      isCorrectUsage: reviewResult.isCorrectUsage,
      grammarIssues: reviewResult.grammarIssues,
      flowSuggestion: reviewResult.flowSuggestion,
      feedback: reviewResult.feedback,
      source: reviewResult.source,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };

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

    const { text, flowSuggestion } = req.body;
    if (text === undefined && flowSuggestion === undefined) {
      return res.status(400).json({ error: 'text or flowSuggestion is required' });
    }

    const updateFields: any = {
      'sentences.$.updatedAt': new Date()
    };
    if (text !== undefined) {
      updateFields['sentences.$.text'] = text;
    }
    if (flowSuggestion !== undefined) {
      updateFields['sentences.$.flowSuggestion'] = flowSuggestion;
    }

    await UserSentence.findOneAndUpdate(
      { userId, wordId: req.params.wordId, 'sentences._id': req.params.sentenceId },
      { $set: updateFields }
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
