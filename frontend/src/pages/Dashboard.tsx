import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Trophy, Flame, BookOpen, TrendingUp,
  Volume2, CheckCircle2, ArrowRight,
  Loader2, RotateCcw, Send, Bell, Settings,
  Star, BookMarked
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { LEVEL_COLORS } from '../utils/colors';
import {
  getDailyWord, getYesterdayWord, submitSelfMark, saveSentence,
  getSentences, getStreak, getMastery, getNotificationCount,
  markNotificationsRead, getNotifications, markMastery
} from '../services/api';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

// ── Daily quote — wide variety of inspiring categories ─────────────────────
const QUOTES = [
  // Learning & Growth
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "Education is not the filling of a pail, but the lighting of a fire.", author: "W.B. Yeats" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
  { text: "Anyone who stops learning is old, whether at twenty or eighty.", author: "Henry Ford" },
  // Practice & Consistency
  { text: "Practice is the hardest part of learning, and training is the essence of transformation.", author: "Ann Voskamp" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  // Words & Language
  { text: "A word after a word after a word is power.", author: "Margaret Atwood" },
  { text: "The limits of my language mean the limits of my world.", author: "Ludwig Wittgenstein" },
  { text: "Words can inspire, and words can destroy. Choose yours well.", author: "Robin Sharma" },
  { text: "Every word was once a poem.", author: "Ralph Waldo Emerson" },
  { text: "The difference between the right word and almost the right word is a great matter.", author: "Mark Twain" },
  // Curiosity & Wonder
  { text: "Curiosity is the engine of achievement.", author: "Ken Robinson" },
  { text: "The wisest mind has something yet to learn.", author: "George Santayana" },
  { text: "Wonder is the beginning of wisdom.", author: "Socrates" },
  { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  // Perseverance
  { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Every master was once a disaster.", author: "T. Harv Eker" },
  { text: "Mistakes are proof that you are trying.", author: "Jennifer Lim" },
  // Inspiration
  { text: "Your only limit is your mind.", author: "Anonymous" },
  { text: "Dream big, start small, but most of all, start.", author: "Simon Sinek" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
];

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

const Dashboard: React.FC = () => {
  const { profile, updateDifficulty } = useAuth();

  const [todayWord, setTodayWord] = useState<any>(() => {
    const cached = sessionStorage.getItem('wordly_today_word');
    if (!cached) return null;
    try {
      const parsed = JSON.parse(cached);
      // Invalidate cache if it has a placeholder or fewer than 2 real sentences
      const sentences: string[] = Array.isArray(parsed.sentences) ? parsed.sentences : [];
      const PLACEHOLDER = 'The word is commonly used to express this concept in everyday communication.';
      const realSentences = sentences.filter((s: string) => s !== PLACEHOLDER && s.trim().length > 10);
      if (realSentences.length < 2) {
        sessionStorage.removeItem('wordly_today_word');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [yesterdayWord, setYesterdayWord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [wakingUp, setWakingUp] = useState(false);
  const [phase, setPhase] = useState<'CHECKING' | 'REVIEW' | 'DISCOVERY'>('CHECKING');
  const [selfMark, setSelfMark] = useState<'got_it' | 'needs_practice' | null>(null);
  const [markLoading, setMarkLoading] = useState(false);
  const [sentence, setSentence] = useState('');
  const [savingSentence, setSavingSentence] = useState(false);
  const [savedSentences, setSavedSentences] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [mastery, setMastery] = useState<any>({});
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  // For manually marking mastery
  const [wordMastery, setWordMastery] = useState<string | null>(null);
  const [markingMastery, setMarkingMastery] = useState(false);

  const dailyQuote = getDailyQuote();
  const initialized = useRef(false);
  const levelMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadDashboard();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (levelMenuRef.current && !levelMenuRef.current.contains(e.target as Node)) {
        setShowLevelMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadDashboard = async (attempt = 1) => {
    setLoading(true);
    try {
      const [yesterdayRes, streakRes, masteryRes, notifRes] = await Promise.all([
        getYesterdayWord(),
        getStreak(),
        getMastery(),
        getNotificationCount(),
      ]);

      setWakingUp(false);
      setStreak(streakRes.streak || 0);
      setMastery(masteryRes.mastery || {});
      setNotifCount(notifRes.count || 0);

      if (yesterdayRes.found) {
        setYesterdayWord(yesterdayRes.word);
        setPhase('REVIEW');

        if (!todayWord) {
          const todayRes = await getDailyWord();
          if (todayRes.found) {
            setTodayWord(todayRes.data);
            sessionStorage.setItem('wordly_today_word', JSON.stringify(todayRes.data));
            const sentencesRes = await getSentences(todayRes.data.word);
            setSavedSentences(sentencesRes.sentences || []);
          }
        }
      } else if (todayWord) {
        setPhase('DISCOVERY');
        const sentencesRes = await getSentences(todayWord.word);
        setSavedSentences(sentencesRes.sentences || []);
      } else {
        const todayRes = await getDailyWord();
        if (todayRes.found) {
          setTodayWord(todayRes.data);
          sessionStorage.setItem('wordly_today_word', JSON.stringify(todayRes.data));
          // ✅ Fix: use todayRes.data.word, NOT todayWord.word (state not updated yet)
          const sentencesRes = await getSentences(todayRes.data.word);
          setSavedSentences(sentencesRes.sentences || []);
        }
        setPhase('DISCOVERY');
      }
      setLoading(false);
    } catch (err: any) {
      // Only retry on network/fetch errors (backend cold start), not JS bugs
      const isNetworkError = !err?.message || err.message.includes('fetch') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('Load failed');
      const delays = [5000, 10000, 20000];
      if (isNetworkError && attempt <= 3) {
        setWakingUp(true);
        setTimeout(() => loadDashboard(attempt + 1), delays[attempt - 1]);
        // Don't call setLoading(false) — keep spinner showing during retry
      } else {
        setWakingUp(false);
        setLoading(false);
        console.error('Dashboard error:', err);
        toast.error('Failed to load dashboard. Please refresh the page.');
      }
    }
  };

  const handleSelfMark = async (mark: 'got_it' | 'needs_practice') => {
    if (!yesterdayWord) return;
    setMarkLoading(true);
    try {
      await submitSelfMark(yesterdayWord.word, mark);
      setSelfMark(mark);
      toast.success(mark === 'got_it' ? '✅ Great recall!' : '📚 Keep practicing!');
      setTimeout(() => {
        setPhase('DISCOVERY');
      }, 1200);
    } catch (err) {
      toast.error('Failed to submit. Try again.');
    } finally {
      setMarkLoading(false);
    }
  };

  const handleSaveSentence = async () => {
    if (!todayWord || !sentence.trim()) return;
    setSavingSentence(true);
    try {
      await saveSentence(todayWord.word, sentence.trim());
      const sentencesRes = await getSentences(todayWord.word);
      setSavedSentences(sentencesRes.sentences || []);
      setSentence('');
      toast.success('Sentence saved!');
    } catch (err) {
      toast.error('Failed to save sentence.');
    } finally {
      setSavingSentence(false);
    }
  };

  const handleShowNotifs = async () => {
    setShowNotifs(!showNotifs);
    if (!showNotifs) {
      const res = await getNotifications();
      setNotifications(res.notifications || []);
      await markNotificationsRead();
      setNotifCount(0);
    }
  };

  const handleLevelChange = (level: 'beginner' | 'intermediate' | 'advanced' | 'expert') => {
    updateDifficulty(level);
    setShowLevelMenu(false);   // ← close immediately
    sessionStorage.removeItem('wordly_today_word');
    toast.success(`Level changed to ${level}! Your next word will be at ${level} level.`);
  };

  const handleMarkMastery = async (level: 'mastered' | 'familiar') => {
    if (!todayWord) return;
    setMarkingMastery(true);
    try {
      await markMastery(todayWord.word, level);
      setWordMastery(level);
      // Refresh mastery counts
      const masteryRes = await getMastery();
      setMastery(masteryRes.mastery || {});
      toast.success(level === 'mastered' ? '🏆 Marked as Mastered!' : '📖 Marked as Familiar!');
    } catch (err) {
      toast.error('Failed to update mastery.');
    } finally {
      setMarkingMastery(false);
    }
  };

  const playAudio = (term: string) => {
    const utterance = new SpeechSynthesisUtterance(term);
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
        {wakingUp ? (
          <div className="text-center space-y-2">
            <p className="text-lg font-serif italic text-brand-primary">Waking up the backend...</p>
            <p className="text-sm text-brand-muted">Free tier servers sleep after inactivity.<br />This takes up to 50 seconds on first load.</p>
          </div>
        ) : (
          <p className="text-sm font-serif italic text-brand-muted">Loading your dashboard...</p>
        )}
      </div>
    );
  }

  const statsRow = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: 'Streak', value: `${streak} days`, icon: Flame, color: 'text-orange-500' },
        { label: 'Mastered', value: mastery.mastered || 0, icon: Trophy, color: 'text-brand-accent' },
        { label: 'Familiar', value: mastery.familiar || 0, icon: BookOpen, color: 'text-blue-500' },
        { label: 'Practiced', value: mastery.practiced || 0, icon: TrendingUp, color: 'text-green-500' },
      ].map((stat) => (
        <div key={stat.label} className="card p-6 space-y-2">
          <stat.icon className={`w-5 h-5 ${stat.color}`} />
          <p className="text-2xl font-serif font-black italic">{stat.value}</p>
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">{stat.label}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-12 pb-20">

      {/* ── Daily Quote — centered oval pill at the very top ─────────────────── */}
      <div className="flex justify-center pt-2">
        <div
          className="relative max-w-2xl w-full px-10 py-6 rounded-[3rem] text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(226,125,96,0.10) 0%, rgba(226,125,96,0.04) 60%, transparent 100%)',
            border: '1.5px solid rgba(226,125,96,0.25)',
            boxShadow: '0 4px 32px rgba(226,125,96,0.08)',
          }}
        >
          {/* decorative big quote mark */}
          <span
            className="absolute -top-4 left-1/2 -translate-x-1/2 text-5xl font-serif leading-none select-none"
            style={{ color: 'rgba(226,125,96,0.35)' }}
          >
            "
          </span>
          <p className="text-base md:text-lg font-serif italic text-brand-primary leading-relaxed mt-2">
            {dailyQuote.text}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent mt-3">
            — {dailyQuote.author}
          </p>
        </div>
      </div>

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-brand-accent rounded-full" />
            <span className="technical-label">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-serif font-black italic tracking-tight leading-tight">
            Hello {profile?.displayName?.split(' ')[0]},<br />
            <span className="text-brand-accent italic">Ready for your daily word?</span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button onClick={handleShowNotifs} className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-2xl text-brand-muted hover:text-brand-primary transition-all">
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span className="bg-brand-accent text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{notifCount}</span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-12 w-80 bg-white dark:bg-brand-surface border border-brand-border rounded-3xl shadow-2xl z-50 p-4 space-y-3 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-brand-muted italic text-center py-4">No notifications yet</p>
                ) : notifications.map((n: any) => (
                  <div key={n._id} className="p-3 bg-brand-bg rounded-2xl text-sm text-brand-primary">{n.message}</div>
                ))}
              </div>
            )}
          </div>

          {/* Level selector */}
          <div className="relative" ref={levelMenuRef}>
            <button
              onClick={() => setShowLevelMenu(!showLevelMenu)}
              className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-2xl transition-all ${LEVEL_COLORS[profile?.level || 'intermediate']}`}
            >
              <Settings className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{profile?.level}</span>
            </button>
            {showLevelMenu && (
              <div className="absolute right-0 top-12 bg-white dark:bg-brand-surface border border-brand-border rounded-3xl shadow-2xl z-50 p-3 space-y-1 w-44">
                <p className="text-[9px] font-bold uppercase tracking-widest text-brand-muted px-3 pb-2">Change Level</p>
                {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => handleLevelChange(d)}
                    className={`w-full text-left px-4 py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all ${profile?.level === d ? 'bg-brand-accent text-white' : 'text-brand-muted hover:text-brand-primary hover:bg-brand-bg'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* REVIEW PHASE */}
      {phase === 'REVIEW' && yesterdayWord && (
        <section className="space-y-10 animate-in fade-in duration-700">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse" />
            <h4 className="technical-label">Morning Recall — Yesterday's Word</h4>
          </div>

          <div className="card p-10 md:p-16 space-y-10">
            <div className="text-center space-y-4">
              <p className="technical-label">Do you remember this word?</p>
              <h3 className="text-7xl md:text-9xl font-serif font-black italic text-brand-accent lowercase">
                {yesterdayWord.word}
              </h3>
              <div className="flex items-center justify-center gap-4 text-brand-muted">
                <span className="text-sm font-serif italic">{yesterdayWord.partOfSpeech}</span>
                <span className="w-1 h-1 bg-brand-border rounded-full" />
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${LEVEL_COLORS[yesterdayWord.level]}`}>{yesterdayWord.level}</span>
              </div>
            </div>

            {selfMark === null ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-lg mx-auto">
                <button onClick={() => handleSelfMark('got_it')} disabled={markLoading}
                  className="p-8 bg-green-50 dark:bg-green-950 border-2 border-green-200 dark:border-green-800 rounded-3xl text-green-700 dark:text-green-400 font-bold hover:bg-green-100 dark:hover:bg-green-900 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto" />
                  <p className="text-sm uppercase tracking-widest">Got it!</p>
                </button>
                <button onClick={() => handleSelfMark('needs_practice')} disabled={markLoading}
                  className="p-8 bg-amber-50 dark:bg-amber-950 border-2 border-amber-200 dark:border-amber-800 rounded-3xl text-amber-700 dark:text-amber-400 font-bold hover:bg-amber-100 dark:hover:bg-amber-900 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 space-y-2">
                  <RotateCcw className="w-8 h-8 mx-auto" />
                  <p className="text-sm uppercase tracking-widest">Need Practice</p>
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-full ${selfMark === 'got_it' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {selfMark === 'got_it' ? <CheckCircle2 className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                  <span className="font-bold">{selfMark === 'got_it' ? 'Great recall!' : 'Keep practicing!'}</span>
                </div>
              </div>
            )}

            <div className="border-t border-brand-border pt-8 space-y-4">
              <p className="technical-label">Definition</p>
              <p className="text-xl font-serif italic text-brand-muted">{yesterdayWord.meaning}</p>
              {/* Show up to 2 example sentences */}
              {(yesterdayWord.sentences?.length
                ? yesterdayWord.sentences.slice(0, 2)
                : yesterdayWord.sentence ? [yesterdayWord.sentence] : []
              ).map((s: string, i: number) => (
                <p key={i} className="text-sm text-brand-primary font-medium">"{s}"</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DISCOVERY PHASE */}
      {phase === 'DISCOVERY' && todayWord && (
        <section className="space-y-12 animate-in fade-in duration-1000">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle2 className="w-4 h-4 text-brand-accent" />
            <h4 className="technical-label">Today's Word</h4>
          </div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card p-12 md:p-20">
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h3 className="text-7xl md:text-9xl font-serif font-black italic tracking-tighter text-brand-accent lowercase">
                    {todayWord.word}
                  </h3>
                  <div className="flex items-center gap-6 text-sm font-medium text-brand-muted mt-4 uppercase tracking-widest">
                    <button onClick={() => playAudio(todayWord.word)} className="flex items-center gap-2 hover:text-brand-accent transition-colors">
                      <Volume2 className="w-4 h-4" />
                      <span>Hear it</span>
                    </button>
                    <span className="w-1.5 h-1.5 bg-brand-border rounded-full" />
                    <span>{todayWord.partOfSpeech}</span>
                  </div>
                </div>
                <div className="pt-6">
                  <span className={`px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${LEVEL_COLORS[todayWord.level]}`}>
                    {todayWord.level} level
                  </span>
                </div>
              </div>

              <div className="max-w-3xl space-y-10">
                <p className="text-2xl md:text-3xl font-sans text-brand-primary leading-tight font-medium">
                  {todayWord.meaning}
                </p>

                {/* Example sentences — show up to 2 */}
                <div className="space-y-3">
                  {(todayWord.sentences?.length >= 2
                    ? todayWord.sentences.slice(0, 2)
                    : todayWord.sentences?.length === 1
                    ? [todayWord.sentences[0], todayWord.sentence].filter(Boolean)
                    : todayWord.sentence
                    ? [todayWord.sentence]
                    : []
                  ).map((s: string, i: number) => (
                    <div key={i} className="pl-6 border-l-4 border-brand-accent bg-brand-accent/5 py-5 pr-6 rounded-r-2xl text-xl text-brand-primary font-serif leading-relaxed shadow-sm">
                      "{s}"
                    </div>
                  ))}
                </div>

                {/* Synonyms & Antonyms */}
                {(todayWord.synonyms?.length > 0 || todayWord.antonyms?.length > 0) && (
                  <div className="grid grid-cols-2 gap-6 pt-6 border-t border-brand-border">
                    {todayWord.synonyms?.length > 0 && (
                      <div className="space-y-3">
                        <p className="technical-label">Synonyms</p>
                        <div className="flex flex-wrap gap-2">
                          {todayWord.synonyms.map((s: string) => (
                            <Link key={s} to={`/word/${s}`} className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-colors ${LEVEL_COLORS[todayWord.level] || 'bg-brand-bg text-brand-primary border-brand-border'}`}>{s}</Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {todayWord.antonyms?.length > 0 && (
                      <div className="space-y-3">
                        <p className="technical-label">Antonyms</p>
                        <div className="flex flex-wrap gap-2">
                          {todayWord.antonyms.map((a: string) => (
                            <Link key={a} to={`/word/${a}`} className="px-3 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded-lg border border-red-200 hover:bg-red-100 transition-colors">{a}</Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Etymology */}
                {todayWord.etymology && (
                  <div className="p-6 bg-slate-900 dark:bg-black/60 rounded-2xl space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Etymology</p>
                    <p className="text-sm text-slate-300 font-serif italic">{todayWord.etymology}</p>
                  </div>
                )}

                {/* Write Your Own Sentence */}
                <div className="pt-6 border-t border-brand-border space-y-6">
                  <h4 className="technical-label">Write Your Own Sentence</h4>
                  <div className="relative user-input-area p-2 rounded-3xl">
                    <textarea
                      value={sentence}
                      onChange={(e) => setSentence(e.target.value)}
                      placeholder={`Use "${todayWord.word}" in your own sentence...`}
                      className="w-full h-32 p-6 bg-white dark:bg-brand-surface border border-brand-accent/30 rounded-3xl font-serif italic text-lg focus:outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10 transition-all resize-none"
                    />
                    <button
                      onClick={handleSaveSentence}
                      disabled={savingSentence || !sentence.trim()}
                      className="absolute bottom-6 right-6 p-3 bg-brand-accent text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all disabled:opacity-30"
                    >
                      {savingSentence ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Saved sentences */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="technical-label">Your Sentences ({savedSentences.length})</p>
                      {savedSentences.length > 0 && (
                        <Link to={`/word/${todayWord.word}`} className="text-[10px] font-bold uppercase tracking-widest text-brand-accent hover:underline">
                          View All →
                        </Link>
                      )}
                    </div>
                    {savedSentences.length === 0 ? (
                      <p className="text-sm font-serif italic text-brand-muted opacity-50">
                        No sentences yet — write your first one above!
                      </p>
                    ) : (
                      savedSentences.map((s: any) => (
                        <div key={s._id} className="p-4 bg-brand-bg rounded-2xl border border-brand-border text-sm font-serif italic text-brand-primary">
                          "{s.text}"
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Link to={`/word/${todayWord.word}`} className="btn-primary px-12 py-5 flex items-center gap-3 w-fit">
                  <span>Deep Dive</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>

          {/* ── Mark as Mastered / Familiar ─────────────────────────────────── */}
          <div className="card p-8 space-y-5">
            <div className="flex items-center gap-3">
              <Star className="w-4 h-4 text-brand-accent" />
              <h4 className="technical-label">Mark Your Progress</h4>
            </div>
            <p className="text-sm font-serif italic text-brand-muted">
              How well do you know <span className="font-bold not-italic text-brand-primary">{todayWord.word}</span>?
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => handleMarkMastery('mastered')}
                disabled={markingMastery || wordMastery === 'mastered'}
                className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${wordMastery === 'mastered' ? 'bg-brand-accent text-white shadow-lg' : 'bg-brand-accent/10 text-brand-accent border border-brand-accent/30 hover:bg-brand-accent hover:text-white'} disabled:opacity-60`}
              >
                <Trophy className="w-4 h-4" />
                {wordMastery === 'mastered' ? 'Mastered ✓' : 'Mark as Mastered'}
              </button>
              <button
                onClick={() => handleMarkMastery('familiar')}
                disabled={markingMastery || wordMastery === 'familiar'}
                className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${wordMastery === 'familiar' ? 'bg-blue-500 text-white shadow-lg' : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-500 hover:text-white'} disabled:opacity-60`}
              >
                <BookMarked className="w-4 h-4" />
                {wordMastery === 'familiar' ? 'Familiar ✓' : 'Mark as Familiar'}
              </button>
            </div>
          </div>

          {/* ── Stats Row — at the bottom ────────────────────────────────────── */}
          {statsRow}

        </section>
      )}

      {/* Stats if not in discovery phase yet */}
      {phase !== 'DISCOVERY' && statsRow}

      {phase === 'DISCOVERY' && !todayWord && !loading && (
        <div className="card p-16 text-center space-y-6 bg-white">
          <BookOpen className="w-12 h-12 text-brand-accent mx-auto" />
          <h3 className="text-3xl font-serif font-black italic">You've mastered all available words!</h3>
          <p className="text-brand-muted font-serif italic">New words are added daily. Check back tomorrow.</p>
        </div>
      )}

      {/* Profile footer */}
      {profile?.photoURL && (
        <div className="flex items-center gap-4 pt-8 border-t border-brand-border mt-8">
          <img src={profile.photoURL} alt={profile.displayName} className="w-12 h-12 rounded-full border-2 border-brand-border" />
          <div>
            <p className="text-sm font-bold">{profile.displayName}</p>
            <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">{profile.level} level · {streak} day streak</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
