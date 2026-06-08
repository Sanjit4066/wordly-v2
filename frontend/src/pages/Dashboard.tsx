import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, Flame, BookOpen, ChevronRight, TrendingUp,
  Clock, Zap, Volume2, CheckCircle2, ArrowRight,
  Loader2, RotateCcw, Send, BrainCircuit, Lightbulb, Bell
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getDailyWord, getYesterdayWord, submitSelfMark, saveSentence, getSentences, getStreak, getMastery, getNotificationCount, markNotificationsRead, getNotifications } from '../services/api';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const Dashboard: React.FC = () => {
  const { profile, updateDifficulty } = useAuth();
  const [todayWord, setTodayWord] = useState<any>(null);
  const [yesterdayWord, setYesterdayWord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadDashboard();
  }, [profile?.level]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [yesterdayRes, todayRes, streakRes, masteryRes, notifRes] = await Promise.all([
        getYesterdayWord(),
        getDailyWord(),
        getStreak(),
        getMastery(),
        getNotificationCount(),
      ]);

      setStreak(streakRes.streak || 0);
      setMastery(masteryRes.mastery || {});
      setNotifCount(notifRes.count || 0);

      if (yesterdayRes.found) {
        setYesterdayWord(yesterdayRes.word);
        setPhase('REVIEW');
      } else if (todayRes.found) {
        setTodayWord(todayRes.data);
        const sentencesRes = await getSentences(todayRes.data.word);
        setSavedSentences(sentencesRes.sentences || []);
        setPhase('DISCOVERY');
      } else {
        setPhase('DISCOVERY');
      }
    } catch (err) {
      toast.error('Failed to load dashboard. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleSelfMark = async (mark: 'got_it' | 'needs_practice') => {
    if (!yesterdayWord) return;
    setMarkLoading(true);
    try {
      await submitSelfMark(yesterdayWord.word, mark);
      setSelfMark(mark);
      toast.success(mark === 'got_it' ? '✅ Great recall! Loading today\'s word...' : '📚 Keep practicing! Loading today\'s word...');
      setTimeout(async () => {
        const todayRes = await getDailyWord();
        if (todayRes.found) {
          setTodayWord(todayRes.data);
          setPhase('DISCOVERY');
        }
      }, 1500);
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

  const playAudio = (term: string) => {
    const utterance = new SpeechSynthesisUtterance(term);
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-10 w-48 bg-black/5 rounded" />
        <div className="h-64 bg-white rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-20 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-brand-accent rounded-full"></div>
            <span className="technical-label">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          <h2 className="text-5xl md:text-7xl font-serif font-black italic tracking-tight leading-tight">
            Hello {profile?.displayName?.split(' ')[0]},<br />
            <span className="text-brand-accent italic">Ready for your daily word?</span>
          </h2>
        </div>

        <div className="flex flex-col gap-4 w-full md:w-auto">
          {/* Notification Bell */}
          <div className="relative">
            <button onClick={handleShowNotifs} className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-2xl text-brand-muted hover:text-brand-primary transition-all">
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span className="bg-brand-accent text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{notifCount}</span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-12 w-80 bg-white border border-brand-border rounded-3xl shadow-2xl z-50 p-4 space-y-3 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-brand-muted italic text-center py-4">No notifications yet</p>
                ) : notifications.map((n: any) => (
                  <div key={n._id} className="p-3 bg-brand-bg rounded-2xl text-sm text-brand-primary">
                    {n.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Difficulty Selector */}
          <div className="flex flex-col gap-3 p-1 bg-white border border-brand-border rounded-3xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted px-4 pt-2 text-center">Difficulty</p>
            <div className="flex gap-1 p-1 flex-wrap">
              {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => updateDifficulty(d)}
                  className={`px-3 py-2 rounded-2xl text-[9px] font-bold uppercase tracking-widest transition-all ${profile?.level === d ? 'bg-brand-accent text-white shadow-lg' : 'text-brand-muted hover:text-brand-primary'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Streak', value: `${streak} days`, icon: Flame, color: 'text-orange-500' },
          { label: 'Mastered', value: mastery.mastered || 0, icon: Trophy, color: 'text-brand-accent' },
          { label: 'Familiar', value: mastery.familiar || 0, icon: BookOpen, color: 'text-blue-500' },
          { label: 'Practiced', value: mastery.practiced || 0, icon: TrendingUp, color: 'text-green-500' },
        ].map((stat) => (
          <div key={stat.label} className="card p-6 bg-white space-y-2">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <p className="text-2xl font-serif font-black italic">{stat.value}</p>
            <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* REVIEW PHASE */}
      {phase === 'REVIEW' && yesterdayWord && (
        <section className="space-y-10 animate-in fade-in duration-700">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse"></div>
            <h4 className="technical-label">Morning Recall — Yesterday's Word</h4>
          </div>

          <div className="card p-10 md:p-16 bg-white space-y-10">
            <div className="text-center space-y-4">
              <p className="technical-label">Do you remember this word?</p>
              <h3 className="text-7xl md:text-9xl font-serif font-black italic text-brand-accent lowercase">
                {yesterdayWord.word}
              </h3>
              <div className="flex items-center justify-center gap-4 text-brand-muted">
                <span className="text-sm font-serif italic">{yesterdayWord.partOfSpeech}</span>
                <span className="w-1 h-1 bg-brand-border rounded-full"></span>
                <span className="text-[10px] font-bold uppercase tracking-widest">{yesterdayWord.level}</span>
              </div>
            </div>

            {selfMark === null ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-lg mx-auto">
                <button
                  onClick={() => handleSelfMark('got_it')}
                  disabled={markLoading}
                  className="p-8 bg-green-50 border-2 border-green-200 rounded-3xl text-green-700 font-bold hover:bg-green-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 space-y-2"
                >
                  <CheckCircle2 className="w-8 h-8 mx-auto" />
                  <p className="text-sm uppercase tracking-widest">Got it!</p>
                </button>
                <button
                  onClick={() => handleSelfMark('needs_practice')}
                  disabled={markLoading}
                  className="p-8 bg-amber-50 border-2 border-amber-200 rounded-3xl text-amber-700 font-bold hover:bg-amber-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 space-y-2"
                >
                  <RotateCcw className="w-8 h-8 mx-auto" />
                  <p className="text-sm uppercase tracking-widest">Need Practice</p>
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-full ${selfMark === 'got_it' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {selfMark === 'got_it' ? <CheckCircle2 className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                  <span className="font-bold">{selfMark === 'got_it' ? 'Great recall!' : 'Keep practicing!'}</span>
                </div>
                <p className="text-sm text-brand-muted italic">Loading today's word...</p>
              </div>
            )}

            {/* Show the full meaning */}
            <div className="border-t border-brand-border pt-8 space-y-4">
              <p className="technical-label">Definition</p>
              <p className="text-xl font-serif italic text-brand-muted">{yesterdayWord.meaning}</p>
              <p className="text-sm text-brand-primary font-medium">"{yesterdayWord.sentence}"</p>
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

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="card p-12 md:p-20 bg-white"
          >
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
                    <span className="w-1.5 h-1.5 bg-brand-border rounded-full"></span>
                    <span>{todayWord.partOfSpeech}</span>
                  </div>
                </div>
                <div className="px-4 py-2 bg-brand-bg rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted border border-brand-border">
                  {todayWord.level} level
                </div>
              </div>

              <div className="max-w-3xl space-y-10">
                <p className="text-2xl md:text-3xl font-sans text-brand-primary leading-tight font-medium">
                  {todayWord.meaning}
                </p>

                <div className="pl-6 border-l-4 border-brand-accent bg-brand-accent/5 py-5 pr-6 rounded-r-2xl text-xl text-brand-primary font-serif leading-relaxed shadow-sm">
                  "{todayWord.sentence}"
                </div>

                {/* Synonyms & Antonyms */}
                {(todayWord.synonyms?.length > 0 || todayWord.antonyms?.length > 0) && (
                  <div className="grid grid-cols-2 gap-6 pt-6 border-t border-brand-border">
                    {todayWord.synonyms?.length > 0 && (
                      <div className="space-y-3">
                        <p className="technical-label">Synonyms</p>
                        <div className="flex flex-wrap gap-2">
                          {todayWord.synonyms.map((s: string) => (
                            <Link key={s} to={`/word/${s}`} className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-lg border border-green-200 hover:bg-green-100 transition-colors">{s}</Link>
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
                  <div className="p-6 bg-slate-900 rounded-2xl space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Etymology</p>
                    <p className="text-sm text-slate-300 font-serif italic">{todayWord.etymology}</p>
                  </div>
                )}

                {/* Write a sentence */}
                <div className="pt-6 border-t border-brand-border space-y-4">
                  <h4 className="technical-label">Write Your Own Sentence</h4>
                  <div className="relative user-input-area p-2 rounded-3xl">
                    <textarea
                      value={sentence}
                      onChange={(e) => setSentence(e.target.value)}
                      placeholder={`Use "${todayWord.word}" in your own sentence...`}
                      className="w-full h-32 p-6 bg-white border border-brand-accent/30 rounded-3xl font-serif italic text-lg focus:outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10 transition-all resize-none"
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
                  {savedSentences.length > 0 && (
                    <div className="space-y-3 pt-4">
                      <p className="technical-label text-[9px]">Your saved sentences</p>
                      {savedSentences.map((s: any) => (
                        <div key={s._id} className="p-4 bg-brand-bg rounded-2xl border border-brand-border text-sm font-serif italic text-brand-primary">
                          "{s.text}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Link to={`/word/${todayWord.word}`} className="btn-primary px-12 py-5 flex items-center gap-3 w-fit">
                  <span>Deep Dive</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      )}

      {phase === 'DISCOVERY' && !todayWord && !loading && (
        <div className="card p-16 text-center space-y-6 bg-white">
          <BookOpen className="w-12 h-12 text-brand-accent mx-auto" />
          <h3 className="text-3xl font-serif font-black italic">You've mastered all available words!</h3>
          <p className="text-brand-muted font-serif italic">New words are added daily. Check back tomorrow.</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
