import mongoose, { Document, Schema } from 'mongoose';

export type RequestStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface IWordRequest extends Document {
  word: string;
  requestedBy: string[];
  requestCount: number;
  status: RequestStatus;
  createdAt: Date;
  processedAt: Date | null;
  failReason: string | null;
}

const WordRequestSchema = new Schema<IWordRequest>(
  {
    word: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    requestedBy: {
      type: [String],
      default: [],
    },
    requestCount: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    failReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'word_requests',
  }
);

WordRequestSchema.index({ status: 1 });
WordRequestSchema.index({ word: 1 }, { unique: true });

const WordRequest = mongoose.model<IWordRequest>('WordRequest', WordRequestSchema);
export default WordRequest;
