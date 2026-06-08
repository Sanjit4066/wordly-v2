import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Sparkles, TrendingUp, ArrowRight, BookOpen, Loader2 } from 'lucide-react';
import { searchWord } from '../services/api';
import { toast } from 'sonner';

const Practice: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
      } else {
        toast.info(`"${searchTerm}" queued for tonight's batch processing! Check back tomorrow.`);
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
            className="w-full h-24 pl-20 pr-32 bg-white border-2 border-brand-border rounded-[2.5rem] text-3xl font-serif italic focus:outline-none focus:border-brand-accent focus:ring-4 ring-brand-accent/5 transition-all shadow-xl shadow-brand-primary/5"
          />
          <button
            type="submit"
            disabled={!searchTerm.trim() || loading}
            className="absolute right-4 top-4 bottom-4 px-8 bg-brand-primary text-white rounded-[1.8rem] flex items-center gap-2 hover:bg-brand-accent transition-all disabled:opacity-30 active:scale-95"
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
                className="group p-6 bg-white border border-brand-border rounded-3xl hover:border-brand-accent transition-all text-left"
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
              { step: '03', text: 'If not found → queued for AI processing at 11:55 PM' },
              { step: '04', text: 'Next day → word is in the dictionary with difficulty level' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-brand-border">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent w-6">{item.step}</span>
                <p className="text-sm text-brand-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Practice;
