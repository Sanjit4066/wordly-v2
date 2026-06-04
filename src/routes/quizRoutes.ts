import { Router, Request, Response } from 'express';
import WeeklyQuiz from '../models/WeeklyQuizzes';

const router = Router();

// GET /api/quiz/current — get this week's quiz for the user
router.get('/current', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    // Get start of current week (Monday)
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const quiz = await WeeklyQuiz.findOne({ userId, weekStart });

    if (!quiz) {
      return res.json({
        found: false,
        message: 'Your weekly quiz is being generated. Check back after Monday 11 PM!',
      });
    }

    res.json({ found: true, quiz });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/quiz/:quizId/submit — submit quiz score
router.post('/:quizId/submit', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const { answers } = req.body as { answers: Record<string, string> };

    const quiz = await WeeklyQuiz.findById(req.params.quizId);
    if (!quiz || quiz.userId !== userId) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.completed) {
      return res.status(400).json({ error: 'Quiz already completed' });
    }

    // Calculate score
    let correct = 0;
    const breakdown = quiz.questions.map((q) => {
      const userAnswer = answers[q.wordId];
      const isCorrect = userAnswer === q.answer;
      if (isCorrect) correct++;
      return { wordId: q.wordId, userAnswer, correctAnswer: q.answer, isCorrect };
    });

    const score = Math.round((correct / quiz.questions.length) * 100);

    await WeeklyQuiz.findByIdAndUpdate(quiz._id, {
      completed: true,
      score,
    });

    res.json({ success: true, score, correct, total: quiz.questions.length, breakdown });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
