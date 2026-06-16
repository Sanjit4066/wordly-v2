import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Sparkles, TrendingUp, ArrowRight, BookOpen, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { searchWord, getUserRequests } from '../services/api';
import { toast } from 'sonner';

const Practice: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const navigate = useNavigate();

  const loadRequests = async () => {
    try {
      const res = await getUserRequests();
      setRequests(res.requests || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadRequests();

    // Set up timer to refresh requests automatically at 11:55 PM
    let timeoutId: any;
    
    const scheduleRefresh = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(4, 0, 0, 0);
      
      if (now.getTime() >= target.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      
      const delay = target.getTime() - now.getTime();
      
      timeoutId = setTimeout(() => {
        loadRequests();
        scheduleRefresh(); // Schedule the next rollover
      }, delay);
    };

    scheduleRefresh();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // Filter requests to show only those in the current day's window (rollover at 4:00 AM)
  const currentDayRequests = useMemo(() => {
    const now = new Date();
    
    // Calculate 4:00 AM of today in local time
    const today0400 = new Date(now);
    today0400.setHours(4, 0, 0, 0);

    let start: Date;
    let end: Date;

    if (now.getTime() >= today0400.getTime()) {
      start = today0400;
      end = new Date(today0400);
      end.setDate(end.getDate() + 1);
    } else {
      start = new Date(today0400);
      start.setDate(start.getDate() - 1);
      end = today0400;
    }

    return requests.filter((req) => {
      if (!req.createdAt) return false;
      const reqDate = new Date(req.createdAt);
      return reqDate.getTime() >= start.getTime() && reqDate.getTime() < end.getTime();
    });
  }, [requests]);

  const suggestions = [
    { word: 'ephemeral', mood: 'poetic' },
    { word: 'resilient', mood: 'strong' },
    { word: 'eloquent', mood: 'elegant' },
    { word: 'laconic', mood: 'concise' },
    { word: 'serendipity', mood: 'lucky' },
    { word: 'tenacious', mood: 'persistent' },
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const res = await searchWord(searchTerm.trim().toLowerCase());
      if (res.found) {
        navigate(`/word/${res.data.word}`);
      } else if (res.validSpelling === false) {
        toast.error(res.message);
      } else {
        toast.info(`"${searchTerm}" queued for tonight's batch processing! Check back tomorrow.`);
        setSearchTerm('');
        loadRequests();
      }
    } catch {
      toast.error('Search failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-20 pt-12">
      <header className="space-y-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <Sparkles className="w-5 h-5 text-brand-accent" />
          <h4 className="technical-label">Word Search</h4>
        </div>
        <h1 className="text-6xl md:text-8xl font-serif font-black italic tracking-tighter leading-tight">
          Search. Practice.<br />
          <span className="text-brand-accent">Master any word.</span>
        </h1>
        <p className="text-xl font-serif italic text-brand-muted max-w-2xl mx-auto leading-relaxed">
          Search for any word. If it's in our dictionary, you'll see it instantly. If not, we'll process it tonight.
        </p>
      </header>

      <section className="relative max-w-2xl mx-auto">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none">
            <Search className="w-6 h-6 text-brand-muted group-focus-within:text-brand-accent transition-colors" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter a word to explore..."
            className="w-full h-24 pl-20 pr-32 bg-white dark:bg-brand-surface border-2 border-brand-border rounded-[2.5rem] text-3xl font-serif italic focus:outline-none focus:border-brand-accent focus:ring-4 ring-brand-accent/5 transition-all shadow-xl shadow-brand-primary/5"
          />
          <button
            type="submit"
            disabled={!searchTerm.trim() || loading}
            className="absolute right-4 top-4 bottom-4 px-8 bg-brand-primary text-brand-bg rounded-[1.8rem] flex items-center gap-2 hover:bg-brand-accent hover:text-white transition-all disabled:bg-brand-bg disabled:text-brand-muted disabled:border disabled:border-brand-border disabled:active:scale-100 active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          </button>
        </form>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <h5 className="technical-label flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-accent" />
            Suggested Words
          </h5>
          <div className="grid grid-cols-2 gap-4">
            {suggestions.map((s) => (
              <button
                key={s.word}
                onClick={() => navigate(`/word/${s.word}`)}
                className="group p-6 bg-white dark:bg-brand-surface border border-brand-border rounded-3xl hover:border-brand-accent transition-all text-left"
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-brand-muted group-hover:text-brand-accent transition-colors">{s.mood}</p>
                <p className="text-2xl font-serif font-bold italic text-brand-primary lowercase mt-2">{s.word}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <h5 className="technical-label flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-accent" />
            How it works
          </h5>
          <div className="space-y-4">
            {[
              { step: '01', text: 'Search any English word above' },
              { step: '02', text: 'If found in dictionary → see full details instantly' },
              { step: '03', text: 'If not found → queued for AI processing at 4:00 AM' },
              { step: '04', text: 'Next day → word is in the dictionary with difficulty level' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-4 p-4 bg-white dark:bg-brand-surface rounded-2xl border border-brand-border">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent w-6">{item.step}</span>
                <p className="text-sm text-brand-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {currentDayRequests.length > 0 && (
        <section className="space-y-8 pt-8 border-t border-brand-border">
          <div className="flex items-center justify-between">
            <h5 className="technical-label flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-accent" />
              Your Requested Words
            </h5>
            <span className="text-[10px] text-brand-muted uppercase tracking-wider font-mono">
              Resets at 4:00 AM daily
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {currentDayRequests.map((req) => (
              <div key={req._id} className="p-4 bg-white dark:bg-brand-surface border border-brand-border rounded-2xl flex items-center justify-between">
                <span className="font-serif italic font-bold text-brand-primary lowercase">{req.word}</span>
                {req.status === 'pending' && <Clock className="w-4 h-4 text-amber-500" />}
                {req.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {req.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Practice;
