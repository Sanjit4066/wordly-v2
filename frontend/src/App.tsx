import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { BookOpen, LayoutDashboard, Zap, LogOut, User as UserIcon, BookMarked, Moon, Sun, Star, Github, Linkedin, Instagram, ChevronRight, Trophy, Flame } from 'lucide-react';
import { LEVEL_TEXT_COLORS } from './utils/colors';
import { getStreak, getMastery } from './services/api';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Practice from './pages/Practice';
import Quiz from './pages/Quiz';
import WordDetail from './pages/WordDetail';
import Landing from './pages/Landing';
import YourWords from './pages/YourWords';
import Contributions from './pages/Contributions';

import Profile from './pages/Profile';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFullBio, setShowFullBio] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [dropdownStats, setDropdownStats] = useState<{
    streak: number;
    mastered: number;
    familiar: number;
    loading: boolean;
  }>({
    streak: 0,
    mastered: 0,
    familiar: 0,
    loading: false,
  });

  const toggleDropdown = async () => {
    const nextShow = !showDropdown;
    setShowDropdown(nextShow);
    if (nextShow) {
      setDropdownStats((prev) => ({ ...prev, loading: true }));
      try {
        const [streakRes, masteryRes] = await Promise.all([
          getStreak(),
          getMastery(),
        ]);
        setDropdownStats({
          streak: streakRes.streak || 0,
          mastered: masteryRes.mastery?.mastered || 0,
          familiar: masteryRes.mastery?.familiar || 0,
          loading: false,
        });
      } catch (err) {
        console.error('Failed to load dropdown stats:', err);
        setDropdownStats((prev) => ({ ...prev, loading: false }));
      }
    } else {
      setShowFullBio(false);
    }
  };

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowFullBio(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  const navItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Library', path: '/library', icon: BookOpen },
    { name: 'Practice', path: '/practice', icon: Zap },
    { name: 'Your Words', path: '/your-words', icon: BookMarked },
    { name: 'Contributions', path: '/contributions', icon: Star },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-primary font-sans flex flex-col transition-colors duration-300">
      {/* Top Nav */}
      <header className="h-20 glass sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 shrink-0">
        <div className="flex items-center gap-10">
          <Link to="/" className="text-2xl font-serif font-black tracking-tight italic">
            Wordly<span className="text-brand-accent">.</span>
          </Link>
          <nav className="hidden md:flex gap-8">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className={`nav-link ${isActive ? 'active' : ''}`}>
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl border border-brand-border bg-brand-surface flex items-center justify-center text-brand-muted hover:text-brand-accent hover:border-brand-accent transition-all duration-300"
            aria-label="Toggle dark mode"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />
            }
          </button>

          <div className="relative" ref={dropdownRef}>
            <div
              onClick={toggleDropdown}
              className="hidden sm:flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all select-none"
            >
              <div className="text-right">
                <p className="text-xs font-bold truncate max-w-[150px]">{profile?.displayName}</p>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${LEVEL_TEXT_COLORS[profile?.level || 'intermediate']}`}>
                  {profile?.level} level
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent overflow-hidden">
                {profile?.photoURL || user?.photoURL ? (
                  <img src={profile?.photoURL || user?.photoURL || undefined} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-4 h-4" />
                )}
              </div>
            </div>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute right-0 top-14 bg-white/95 dark:bg-brand-surface/95 backdrop-blur-xl border border-brand-accent/20 dark:border-brand-accent/30 rounded-[2rem] shadow-[0_24px_60px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.35)] ring-8 ring-brand-accent/5 z-50 p-5 w-72 space-y-4"
                >
                  {/* Profile Info Header */}
                  <div className="flex items-center gap-3.5 pb-3.5 border-b border-brand-border/60">
                    <div className="w-12 h-12 rounded-full border-2 border-brand-accent/25 flex items-center justify-center text-brand-accent overflow-hidden shadow-inner shrink-0">
                      {profile?.photoURL || user?.photoURL ? (
                        <img src={profile?.photoURL || user?.photoURL || undefined} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-lg font-serif font-black italic text-brand-primary truncate leading-tight">{profile?.displayName}</p>
                      {user?.email && (
                        <p className="text-xs text-brand-muted truncate font-sans tracking-tight leading-normal">{user.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Micro Dashboard Stats */}
                  <div className="bg-brand-bg/50 dark:bg-brand-bg/10 rounded-2xl p-3 border border-brand-border/40 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted/75">Linguistic Progress</span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-brand-accent/10 ${LEVEL_TEXT_COLORS[profile?.level || 'intermediate']}`}>
                        {profile?.level}
                      </span>
                    </div>

                    {dropdownStats.loading ? (
                      <div className="flex items-center justify-center py-3">
                        <span className="text-[10px] font-mono text-brand-muted animate-pulse">Synchronizing...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded-xl bg-white dark:bg-brand-surface border border-brand-border/40 hover:border-orange-500/30 transition-colors">
                          <Flame className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                          <p className="text-xs font-bold font-mono">{dropdownStats.streak}d</p>
                          <p className="text-[8px] font-black uppercase text-brand-muted tracking-widest">Streak</p>
                        </div>
                        <div className="text-center p-2 rounded-xl bg-white dark:bg-brand-surface border border-brand-border/40 hover:border-brand-accent/30 transition-colors">
                          <Trophy className="w-4 h-4 text-brand-accent mx-auto mb-1" />
                          <p className="text-xs font-bold font-mono">{dropdownStats.mastered}</p>
                          <p className="text-[8px] font-black uppercase text-brand-muted tracking-widest">Mastered</p>
                        </div>
                        <div className="text-center p-2 rounded-xl bg-white dark:bg-brand-surface border border-brand-border/40 hover:border-blue-500/30 transition-colors">
                          <BookOpen className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                          <p className="text-xs font-bold font-mono">{dropdownStats.familiar}</p>
                          <p className="text-[8px] font-black uppercase text-brand-muted tracking-widest">Familiar</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Collapsible Bio */}
                  <div className="space-y-1">
                    {profile?.bio ? (
                      showFullBio ? (
                        <div className="space-y-1.5 bg-brand-bg/30 dark:bg-brand-bg/5 p-2.5 rounded-2xl border border-brand-border/30">
                          <p className="text-xs text-brand-muted font-serif italic whitespace-pre-wrap leading-relaxed">
                            {profile.bio}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowFullBio(false);
                            }}
                            className="text-[9px] font-bold uppercase tracking-wider text-brand-accent hover:underline cursor-pointer focus:outline-none"
                          >
                            Hide Bio
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 justify-between">
                          <p className="text-xs text-brand-muted font-serif italic truncate flex-1 pl-1">
                            {profile.bio}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowFullBio(true);
                            }}
                            className="text-[9px] font-bold uppercase tracking-wider text-brand-accent hover:underline shrink-0 cursor-pointer focus:outline-none"
                          >
                            See Bio
                          </button>
                        </div>
                      )
                    ) : (
                      <p className="text-xs text-brand-muted/40 font-serif italic pl-1">No bio yet.</p>
                    )}
                  </div>

                  {/* View Profile Navigation */}
                  <div className="pt-2">
                    <Link
                      to="/profile"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold text-brand-muted hover:text-brand-primary hover:bg-brand-bg dark:hover:bg-brand-bg/10 border border-transparent hover:border-brand-border/60 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-brand-accent" />
                        <span>Account Profile</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* CONNECT ME Submenu */}
                  <div className="space-y-2 pt-3 border-t border-brand-border/60">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-muted/70 px-1">Connect Me</p>
                    <div className="flex justify-center gap-3 pt-1">
                      {profile?.githubId ? (
                        <a
                          href={`https://github.com/${profile.githubId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-9 h-9 rounded-full flex items-center justify-center border border-brand-border/60 text-brand-muted hover:bg-[#24292e] hover:text-white hover:border-[#24292e] transition-all shadow-sm"
                          title={`GitHub: @${profile.githubId}`}
                        >
                          <Github className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="w-9 h-9 rounded-full flex items-center justify-center border border-brand-border/30 bg-brand-bg/50 text-brand-muted/20 cursor-not-allowed" title="No GitHub Connected">
                          <Github className="w-4 h-4" />
                        </span>
                      )}

                      {profile?.linkedinId ? (
                        <a
                          href={profile.linkedinId.startsWith('http') ? profile.linkedinId : `https://linkedin.com/in/${profile.linkedinId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-9 h-9 rounded-full flex items-center justify-center border border-brand-border/60 text-brand-muted hover:bg-[#0077b5] hover:text-white hover:border-[#0077b5] transition-all shadow-sm"
                          title="LinkedIn"
                        >
                          <Linkedin className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="w-9 h-9 rounded-full flex items-center justify-center border border-brand-border/30 bg-brand-bg/50 text-brand-muted/20 cursor-not-allowed" title="No LinkedIn Connected">
                          <Linkedin className="w-4 h-4" />
                        </span>
                      )}

                      {profile?.instagramId ? (
                        <a
                          href={`https://instagram.com/${profile.instagramId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-9 h-9 rounded-full flex items-center justify-center border border-brand-border/60 text-brand-muted hover:bg-gradient-to-tr hover:from-[#f9ce34] hover:via-[#ee2a7b] hover:to-[#6228d7] hover:text-white hover:border-transparent transition-all shadow-sm"
                          title={`Instagram: @${profile.instagramId}`}
                        >
                          <Instagram className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="w-9 h-9 rounded-full flex items-center justify-center border border-brand-border/30 bg-brand-bg/50 text-brand-muted/20 cursor-not-allowed" title="No Instagram Connected">
                          <Instagram className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sign Out */}
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-100 dark:hover:border-red-950/40 rounded-2xl transition-all flex items-center gap-2 cursor-pointer group"
                  >
                    <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        <div className="content-area">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-brand-border bg-white dark:bg-brand-surface text-center transition-colors duration-300">
        <div className="max-w-2xl mx-auto px-6 space-y-4">
          <h3 className="text-xl font-serif font-black italic">Wordly.</h3>
          <p className="text-sm text-brand-muted max-w-sm mx-auto leading-relaxed">
            A refined digital companion for expanding your linguistic repertoire.
          </p>
          <div className="pt-8 flex items-center justify-center gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted opacity-50">
            <span>© 2026 Wordly V2</span>
            <span className="w-1 h-1 bg-brand-border rounded-full"></span>
            <span>MongoDB + Gemini AI</span>
          </div>
        </div>
      </footer>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 h-16 bg-brand-primary text-brand-bg rounded-2xl flex items-center justify-around px-4 shadow-2xl z-50 transition-colors duration-300">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center space-y-1 transition-all ${isActive ? 'text-brand-accent scale-110' : 'opacity-40'}`}
            >
              <item.icon className="w-5 h-5" />
            </Link>
          );
        })}
        <button onClick={toggleTheme} className="opacity-40 hover:opacity-100 transition-opacity">
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button onClick={logout} className="opacity-40 hover:opacity-100 transition-opacity">
          <LogOut className="w-5 h-5" />
        </button>
      </nav>
    </div>
  );
};

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return user ? <Layout>{children}</Layout> : <Navigate to="/welcome" />;
};

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Toaster position="top-center" richColors />
          <Routes>
            <Route path="/welcome" element={<Landing />} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/library" element={<PrivateRoute><Library /></PrivateRoute>} />
            <Route path="/practice" element={<PrivateRoute><Practice /></PrivateRoute>} />
            <Route path="/your-words" element={<PrivateRoute><YourWords /></PrivateRoute>} />
            <Route path="/quiz" element={<PrivateRoute><Quiz /></PrivateRoute>} />
            <Route path="/contributions" element={<PrivateRoute><Contributions /></PrivateRoute>} />
            <Route path="/word/:term" element={<PrivateRoute><WordDetail /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
