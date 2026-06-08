import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserLevel, setUserLevel } from '../services/api';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  level: DifficultyLevel;
  streak: number;
  wordsLearned: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  updateDifficulty: (level: DifficultyLevel) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Store user ID for API calls
        localStorage.setItem('wordly_user_id', firebaseUser.uid);

        setProfile({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Learner',
          photoURL: firebaseUser.photoURL || '',
          level: (getUserLevel() as DifficultyLevel) || 'intermediate',
          streak: 0,
          wordsLearned: 0,
        });
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
    await signOut(auth);
  };

  const updateDifficulty = (level: DifficultyLevel) => {
    setUserLevel(level);
    if (profile) setProfile({ ...profile, level });
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout, updateDifficulty }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
