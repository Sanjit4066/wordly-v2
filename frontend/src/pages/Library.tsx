import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, BookOpen, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { getWordsByLevel, getDictionaryStats, searchWord } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';

type Level = 'beginner' | 'intermediate' | 'advanced' | 'expert';

const LEVEL_COLORS: Record<Level, string> = {
  beginner:     'bg-green-50  dark:bg-green-950  border-green-200  dark:border-green-800  text-green-700  dark:text-green-400',
  intermediate: 'bg-blue-50   dark:bg-blue-950   border-blue-200   dark:border-blue-800   text-blue-700   dark:text-blue-400',
  advanced:     'bg-amber-50  dark:bg-amber-950  border-amber-200  dark:border-amber-800  text-amber-700  dark:text-amber-400',
  expert:       'bg-pink-50   dark:bg-pink-950   border-pink-200   dark:border-pink-800   text-pink-700   dark:text-pink-400',
};

const Library: React.FC = () => {
  const [activeLevel, setActiveLevel] = useState<Level>('intermediate');
  const [words, setWords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setPage(1);
    loadWords(activeLevel, 1);
  }, [activeLevel]);

  useEffect(() => {
    getDictionaryStats().then((res) => setStats(res.byLevel || {}));
  }, []);

  const loadWords = async (level: Level, pageNum: number) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await getWordsByLevel(level, pageNum);
      const newWords = res.words || [];
      
      if (pageNum === 1) {
        setWords(newWords);
      } else {
        setWords(prev => [...prev, ...newWords]);
      }
      
      // If we got fewer than 20 words back, we've hit the end
      setHasMore(newWords.length === 20);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadWords(activeLevel, nextPage);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await searchWord(searchTerm.trim().toLowerCase());
      if (res.found) {
        navigate(`/word/${res.data.word}`);
      } else {
        setSearchResult({ queued: true, word: searchTerm.trim() });
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-16 pb-32">
      <header className="space-y-10">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-brand-accent rounded-full"></div>
            <span className="technical-label">Word Dictionary</span>
          </div>
          <h2 className="text-5xl font-serif font-black italic tracking-tight">Your Lexicon</h2>
          <p className="text-sm text-brand-muted italic">
            {(Object.values(stats) as number[]).reduce((a, b) => a + b, 0)} words across 4 difficulty levels.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-4 items-center bg-white dark:bg-brand-surface p-2 rounded-[2rem] border border-brand-border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input
              type="text"
              placeholder="Search any word..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-4 py-4 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <button type="submit" disabled={searching || !searchTerm.trim()} className="btn-primary px-8 py-3">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResult?.queued && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-serif italic">
            "{searchResult.word}" isn't in our dictionary yet — queued for tonight's batch processing! Check back tomorrow.
          </div>
        )}
      </header>

      {/* Level Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['beginner', 'intermediate', 'advanced', 'expert'] as Level[]).map((level) => (
          <button
            key={level}
            onClick={() => setActiveLevel(level)}
            className={`p-6 rounded-3xl border-2 transition-all text-left space-y-2 ${activeLevel === level ? LEVEL_COLORS[level] + ' border-current' : 'bg-white dark:bg-brand-surface border-brand-border hover:border-brand-accent/30'}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{level}</p>
            <p className="text-3xl font-serif font-black italic">{stats[level] || 0}</p>
            <p className="text-[10px] font-bold opacity-60">words</p>
          </button>
        ))}
      </div>

      {/* Word Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 card animate-pulse bg-brand-bg/50" />)}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {words.length > 0 ? (
            <>
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {words.map((word: any) => (
                <Link key={word.word} to={`/word/${word.word}`}>
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ y: -8 }}
                    className="card p-8 group h-full flex flex-col space-y-6"
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 rounded-2xl bg-brand-bg flex items-center justify-center font-serif italic text-2xl font-black group-hover:bg-brand-accent group-hover:text-white transition-all duration-500">
                        {word.word[0]}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${LEVEL_COLORS[word.level as Level]}`}>
                        {word.level}
                      </span>
                    </div>

                    <div className="flex-1 space-y-3">
                      <h3 className="text-3xl font-serif font-black italic tracking-tight lowercase group-hover:text-brand-accent transition-colors">
                        {word.word}
                      </h3>
                      <p className="text-xs font-bold text-brand-muted uppercase tracking-widest">{word.partOfSpeech}</p>
                      <p className="text-sm font-serif italic text-brand-muted line-clamp-2 leading-relaxed">
                        "{word.meaning}"
                      </p>
                    </div>

                    <div className="pt-4 border-t border-brand-border flex items-center justify-between text-brand-muted group-hover:text-brand-primary transition-colors">
                      <span className="text-[9px] font-bold uppercase tracking-widest">View Word</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </div>
                  </motion.div>
                </Link>
              ))}
            </motion.div>
            
            {hasMore && (
              <motion.div layout className="pt-12 flex justify-center">
                <button 
                  onClick={handleLoadMore} 
                  disabled={loadingMore} 
                  className="btn-secondary px-8 py-4 bg-white dark:bg-brand-surface border border-brand-border shadow-sm hover:border-brand-accent hover:text-brand-accent transition-all duration-300 rounded-full font-serif italic font-bold disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More Words'}
                </button>
              </motion.div>
            )}
            </>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-32 text-center card border-dashed opacity-50 flex flex-col items-center">
              <BookOpen className="w-12 h-12 mb-4 text-brand-muted" />
              <p className="text-lg font-serif italic text-brand-muted">No words at {activeLevel} level yet.</p>
              <p className="text-sm text-brand-muted mt-2">Run the bulk seed script to populate words!</p>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default Library;
