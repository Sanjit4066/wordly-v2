import mongoose, { Document, Schema } from 'mongoose';

interface ISentenceEntry {
  text: string;
  isCorrectUsage?: boolean;
  grammarIssues?: string[];
  flowSuggestion?: string;
  feedback?: string;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}

export interface IUserSentence extends Document {
  userId: string;
  wordId: string;
  sentences: ISentenceEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const SentenceEntrySchema = new Schema<ISentenceEntry>(
  {
    text: { type: String, required: true },
    isCorrectUsage: { type: Boolean, default: true },
    grammarIssues: { type: [String], default: [] },
    flowSuggestion: { type: String, default: '' },
    feedback: { type: String, default: '' },
    source: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { _id: true }
);

const UserSentenceSchema = new Schema<IUserSentence>(
  {
    userId: { type: String, required: true },
    wordId: { type: String, required: true },
    sentences: [SentenceEntrySchema],
  },
  {
    timestamps: true,
    collection: 'user_sentences',
  }
);

UserSentenceSchema.index({ userId: 1, wordId: 1 }, { unique: true });

const UserSentence = mongoose.model<IUserSentence>('UserSentence', UserSentenceSchema);
export default UserSentence;
