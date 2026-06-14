import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { BookOpen, LayoutDashboard, Zap, LogOut, User as UserIcon, BookMarked, Moon, Sun, Star } from 'lucide-react';
import { LEVEL_TEXT_COLORS } from './utils/colors';
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

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();

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

          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold truncate max-w-[150px]">{profile?.displayName}</p>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${LEVEL_TEXT_COLORS[profile?.level || 'intermediate']}`}>
                {profile?.level} level
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent overflow-hidden">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4" />
              )}
            </div>
          </div>
          <button onClick={logout} className="text-[10px] uppercase font-bold tracking-widest text-brand-muted hover:text-brand-primary transition-colors">
            Sign out
          </button>
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
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
