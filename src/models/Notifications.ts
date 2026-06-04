import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType = 'word_added' | 'review_due' | 'streak_reminder';

export interface INotification extends Document {
  userId: string;
  type: NotificationType;
  message: string;
  wordId: string | null;
  isRead: boolean;
  createdAt: Date;
  expiresAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['word_added', 'review_due', 'streak_reminder'],
      required: true,
    },
    message: { type: String, required: true },
    wordId: { type: String, default: null },
    isRead: { type: Boolean, default: false, index: true },
    expiresAt: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d;
      },
    },
  },
  {
    timestamps: true,
    collection: 'notifications',
  }
);

// TTL index — MongoDB auto-deletes docs after expiresAt
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
NotificationSchema.index({ userId: 1, isRead: 1 });

const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
export default Notification;
