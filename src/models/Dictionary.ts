import mongoose, { Document, Schema } from 'mongoose';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface IWord extends Document {
  word: string;
  meaning: string;
  sentences: string[];
  level: DifficultyLevel;
  synonyms: string[];
  antonyms: string[];
  etymology: string;
  partOfSpeech: string;
  createdAt: Date;
  addedVia: 'manual' | 'ai_batch';
}

const WordSchema = new Schema<IWord>(
  {
    word: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    meaning: {
      type: String,
      required: true,
    },
    sentences: {
      type: [String],
      default: [],
    },
    // ─── DIFFICULTY CATEGORIZATION ────────────────────────────────────────────
    // Words are categorized into 4 difficulty buckets:
    //   beginner     → common everyday words (A1-A2 CEFR)
    //   intermediate → moderately complex words (B1-B2 CEFR)
    //   advanced     → sophisticated vocabulary (C1 CEFR)
    //   expert       → rare, academic, or highly technical words (C2 CEFR)
    //
    // During batch processing, the AI classifies each word into one of these
    // levels. This enables personalized Word of Day, level-based word lists,
    // and ensures users learning advanced words only see advanced words.
    // ─────────────────────────────────────────────────────────────────────────
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      required: true,
      index: true, // fast level-based filtering
    },
    synonyms: {
      type: [String],
      default: [],
    },
    antonyms: {
      type: [String],
      default: [],
    },
    etymology: {
      type: String,
      default: '',
    },
    partOfSpeech: {
      type: String,
      required: true,
    },
    addedVia: {
      type: String,
      enum: ['manual', 'ai_batch'],
      default: 'ai_batch',
    },
  },
  {
    timestamps: true,
    collection: 'dictionary',
  }
);

// Compound index for efficient level + recency queries (e.g. Word of Day selection)
// Note: The `word` unique index and `level` index are already declared in the schema
// field definitions above — only the compound index needs to be here.
WordSchema.index({ level: 1, createdAt: -1 });

// Static helper: get all words at a specific difficulty level
WordSchema.statics.getByLevel = function (level: DifficultyLevel) {
  return this.find({ level });
};

// Static helper: count words per difficulty level (for admin stats)
WordSchema.statics.getLevelStats = async function () {
  return this.aggregate([
    { $group: { _id: '$level', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
};

const Word = mongoose.model<IWord>('Word', WordSchema);
export default Word;
