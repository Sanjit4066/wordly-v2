import cron from 'node-cron';
import UserProgress from '../models/UserProgress';
import Notification from '../models/Notifications';

async function sendReviewReminders(): Promise<void> {
  console.log('\n🔔 [SR Reminder] Checking for due reviews...');

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Find all progress entries where review is due today or overdue
  const dueEntries = await UserProgress.find({
    nextReviewAt: { $lte: today },
    masteryLevel: { $ne: 'mastered' }, // skip already mastered words
  });

  // Group by userId
  const byUser: Record<string, string[]> = {};
  for (const entry of dueEntries) {
    if (!byUser[entry.userId]) byUser[entry.userId] = [];
    byUser[entry.userId].push(entry.wordId);
  }

  const userIds = Object.keys(byUser);
  console.log(`📋 [SR Reminder] ${userIds.length} user(s) have words due for review`);

  // Create one notification per user
  const notifications = userIds.map((userId) => {
    const wordCount = byUser[userId].length;
    return {
      userId,
      type: 'review_due' as const,
      message:
        wordCount === 1
          ? `You have 1 word ready for review today. Keep your streak going!`
          : `You have ${wordCount} words ready for review today. Keep your streak going!`,
      wordId: null,
      isRead: false,
    };
  });

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
    console.log(`✅ [SR Reminder] Sent ${notifications.length} review reminder(s)`);
  } else {
    console.log('✅ [SR Reminder] No reminders needed today');
  }
}

// ─── CRON JOB: Every day at 9:00 AM ──────────────────────────────────────────
export function startSpacedRepetitionReminder(): void {
  console.log('⏰ [SR Reminder] Cron job scheduled: 9:00 AM daily');

  cron.schedule('0 9 * * *', async () => {
    try {
      await sendReviewReminders();
    } catch (error) {
      console.error('❌ [SR Reminder] Cron job crashed:', error);
    }
  });
}
