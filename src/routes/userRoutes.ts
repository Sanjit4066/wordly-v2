import { Router, Request, Response } from 'express';
import UserProfile from '../models/UserProfile';

const router = Router();

// GET /api/user/profile — fetch user profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      // Return a blank default profile object if user hasn't created one
      return res.json({
        userId,
        displayName: 'Learner',
        photoURL: '',
        dob: '',
        bio: '',
        githubId: '',
        linkedinId: '',
        instagramId: '',
        maxStreak: 0,
      });
    }

    res.json(profile);
  } catch (error: any) {
    console.error('Failed to get user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/user/profile — update user profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const { displayName, photoURL, dob, bio, githubId, linkedinId, instagramId, maxStreak } = req.body;

    // Enforce 50 words max bio
    const words = (bio || '').trim().split(/\s+/).filter(Boolean);
    if (words.length > 50) {
      return res.status(400).json({ error: 'Bio cannot exceed 50 words' });
    }

    const updatedProfile = await UserProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          displayName,
          photoURL,
          dob,
          bio,
          githubId,
          linkedinId,
          instagramId,
          maxStreak: maxStreak !== undefined ? Number(maxStreak) : 0,
        },
      },
      { new: true, upsert: true }
    );

    res.json(updatedProfile);
  } catch (error: any) {
    console.error('Failed to update user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
