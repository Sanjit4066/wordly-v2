import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Notification from '../models/Notifications';
import UserProgress from '../models/UserProgress';
import WordRequest from '../models/WordRequests';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wordly-v2';

async function backfillWelcomeNotifications() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // Find all unique user IDs across our collections
    console.log('Gathering unique user IDs...');
    const progressUsers = await UserProgress.distinct('userId');
    const requestUsers = await WordRequest.distinct('requestedBy');
    const notificationUsers = await Notification.distinct('userId');

    const allUserIds = new Set([...progressUsers, ...requestUsers, ...notificationUsers]);
    console.log(`Found ${allUserIds.size} unique users.`);

    let addedCount = 0;

    for (const userId of allUserIds) {
      // Check if welcome notification exists
      const existing = await Notification.findOne({ userId, type: 'welcome' });
      if (!existing) {
        await Notification.create({
          userId,
          type: 'welcome',
          message: `Welcome to Wordly V2! 🎉 We're thrilled to have you here. Start exploring words!`,
        });
        addedCount++;
        console.log(`Added welcome notification for user: ${userId}`);
      }
    }

    console.log(`Backfill complete. Added ${addedCount} welcome notifications.`);
    process.exit(0);
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  }
}

backfillWelcomeNotifications();
