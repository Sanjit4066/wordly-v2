import { Router, Request, Response } from 'express';
import Notification from '../models/Notifications';

const router = Router();

// GET /api/notifications — latest 20 notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    // Clean up duplicate review_due notifications (keep only the newest)
    const reviewReminders = await Notification.find({ userId, type: 'review_due' }).sort({ createdAt: -1 });
    if (reviewReminders.length > 1) {
      const idsToDelete = reviewReminders.slice(1).map(n => n._id);
      await Notification.deleteMany({ _id: { $in: idsToDelete } });
    }

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ notifications });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notifications/count — unread badge count
router.get('/count', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const count = await Notification.countDocuments({ userId, isRead: false });
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/mark-read — mark all as read
router.put('/mark-read', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications/welcome — create permanent welcome notification
router.post('/welcome', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { displayName } = req.body;
    
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    // Check if the user already has a welcome notification
    const existing = await Notification.findOne({ userId, type: 'welcome' });
    if (existing) {
      return res.json({ success: true, message: 'Already welcomed' });
    }

    const nameToUse = displayName || 'Learner';
    
    // Create the welcome notification
    await Notification.create({
      userId,
      type: 'welcome',
      message: `Welcome to Wordly V2, ${nameToUse}! 🎉 We're thrilled to have you here. Start exploring words!`,
      expiresAt: new Date('2126-01-01'), // Long-lived (100 years) welcome notification
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
