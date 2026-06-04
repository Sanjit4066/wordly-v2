import mongoose, { Document, Schema } from 'mongoose';

export type MasteryLevel = 'seen' | 'practiced' | 'familiar' | 'mastered';
export type SelfMark = 'got_it' | 'needs_practice';

export interface IUserProgress extends Document {
  userId: string;
  wordId: string;
  level: string;
  seenAt: Date;
  masteryLevel: MasteryLevel;
  reviewCount: number;
  lastReviewed: Date | null;
  nextReviewAt: Date;
  selfMark: SelfMark | null;
}

const UserProgressSchema = new Schema<IUserProgress>(
  {
    userId: {
      type: String,
      required: true,
    },
    wordId: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      required: true,
    },
    seenAt: {
      type: Date,
      default: Date.now,
    },
    masteryLevel: {
      type: String,
      enum: ['seen', 'practiced', 'familiar', 'mastered'],
      default: 'seen',
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    lastReviewed: {
      type: Date,
      default: null,
    },
    nextReviewAt: {
      type: Date,
      default: () => {
        // First review due next day
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      },
    },
    selfMark: {
      type: String,
      enum: ['got_it', 'needs_practice', null],
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'user_progress',
  }
);

// Compound unique index — one record per user per word
UserProgressSchema.index({ userId: 1, wordId: 1 }, { unique: true });
UserProgressSchema.index({ userId: 1, nextReviewAt: 1 }); // spaced repetition queries
UserProgressSchema.index({ userId: 1, seenAt: 1 });       // heatmap queries

// Calculate next review date based on Ebbinghaus Forgetting Curve
export function calculateNextReview(
  reviewCount: number,
  selfMark: SelfMark
): { nextReviewAt: Date; masteryLevel: MasteryLevel } {
  const now = new Date();
  let daysToAdd = 1;
  let masteryLevel: MasteryLevel = 'seen';

  if (selfMark === 'needs_practice') {
    daysToAdd = 1;
    // masteryLevel stays the same
  } else {
    // got_it
    switch (reviewCount) {
      case 1:
        daysToAdd = 3;
        masteryLevel = 'practiced';
        break;
      case 2:
        daysToAdd = 7;
        masteryLevel = 'familiar';
        break;
      case 3:
        daysToAdd = 30;
        masteryLevel = 'familiar';
        break;
      case 4:
      default:
        daysToAdd = 60;
        masteryLevel = 'mastered';
        break;
    }
  }

  const nextReviewAt = new Date(now);
  nextReviewAt.setDate(nextReviewAt.getDate() + daysToAdd);

  return { nextReviewAt, masteryLevel };
}

const UserProgress = mongoose.model<IUserProgress>('UserProgress', UserProgressSchema);
export default UserProgress;
