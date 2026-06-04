import mongoose, { Document, Schema } from 'mongoose';

interface IQuizQuestion {
  wordId: string;
  question: string;
  options: string[];
  answer: string;
}

export interface IWeeklyQuiz extends Document {
  userId: string;
  weekStart: Date;
  words: string[];
  questions: IQuizQuestion[];
  completed: boolean;
  score: number | null;
  createdAt: Date;
}

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    wordId: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    answer: { type: String, required: true },
  },
  { _id: false }
);

const WeeklyQuizSchema = new Schema<IWeeklyQuiz>(
  {
    userId: { type: String, required: true },
    weekStart: { type: Date, required: true },
    words: { type: [String], default: [] },
    questions: { type: [QuizQuestionSchema], default: [] },
    completed: { type: Boolean, default: false },
    score: { type: Number, default: null },
  },
  {
    timestamps: true,
    collection: 'weekly_quizzes',
  }
);

WeeklyQuizSchema.index({ userId: 1, weekStart: -1 });

const WeeklyQuiz = mongoose.model<IWeeklyQuiz>('WeeklyQuiz', WeeklyQuizSchema);
export default WeeklyQuiz;
