import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserLevel, setUserLevel, sendWelcomeNotification, getUserProfile } from '../services/api';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  level: DifficultyLevel;
  streak: number;
  wordsLearned: number;
  dob: string;
  bio: string;
  githubId: string;
  linkedinId: string;
  instagramId: string;
  maxStreak: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  updateDifficulty: (level: DifficultyLevel) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAndSetProfile = async (uid: string, defaultName: string, defaultPhoto: string) => {
    try {
      const dbProfile = await getUserProfile();
      setProfile({
        uid,
        displayName: dbProfile?.displayName || defaultName,
        photoURL: dbProfile?.photoURL || defaultPhoto,
        level: (getUserLevel() as DifficultyLevel) || 'intermediate',
        streak: 0,
        wordsLearned: 0,
        dob: dbProfile?.dob || '',
        bio: dbProfile?.bio || '',
        githubId: dbProfile?.githubId || '',
        linkedinId: dbProfile?.linkedinId || '',
        instagramId: dbProfile?.instagramId || '',
        maxStreak: dbProfile?.maxStreak || 0,
      });
    } catch (err) {
      console.error('Failed to load profile from DB, falling back:', err);
      setProfile({
        uid,
        displayName: defaultName,
        photoURL: defaultPhoto,
        level: (getUserLevel() as DifficultyLevel) || 'intermediate',
        streak: 0,
        wordsLearned: 0,
        dob: '',
        bio: '',
        githubId: '',
        linkedinId: '',
        instagramId: '',
        maxStreak: 0,
      });
    }
  };

  const refreshProfile = async () => {
    if (!localStorage.getItem('wordly_user_id')) return;
    const uid = localStorage.getItem('wordly_user_id')!;
    const name = profile?.displayName || 'Learner';
    const photo = profile?.photoURL || '';
    await fetchAndSetProfile(uid, name, photo);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Store user ID for API calls
        localStorage.setItem('wordly_user_id', firebaseUser.uid);
        await fetchAndSetProfile(firebaseUser.uid, firebaseUser.displayName || 'Learner', firebaseUser.photoURL || '');
        
        // Ensure user gets a welcome notification permanently
        sendWelcomeNotification(firebaseUser.displayName || 'Learner').catch(err => console.error("Welcome err:", err));
      } else {
        setProfile(null);
        localStorage.removeItem('wordly_user_id');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') return;
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem('wordly_user_id');
    setUser(null);
    setProfile(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const updateDifficulty = (level: DifficultyLevel) => {
    setUserLevel(level);
    if (profile) setProfile({ ...profile, level });
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout, updateDifficulty, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
