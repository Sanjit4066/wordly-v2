import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookMarked, ChevronDown, MessageSquareQuote, Calendar, Loader2 } from 'lucide-react';
import { getUserWords } from '../services/api';
import { Link } from 'react-router-dom';

const LEVEL_COLORS: Record<string, string> = {
  beginner:     'bg-green-50  dark:bg-green-950  border-green-200  dark:border-green-800  text-green-700  dark:text-green-400',
  intermediate: 'bg-blue-50   dark:bg-blue-950   border-blue-200   dark:border-blue-800   text-blue-700   dark:text-blue-400',
  advanced:     'bg-amber-50  dark:bg-amber-950  border-amber-200  dark:border-amber-800  text-amber-700  dark:text-amber-400',
  expert:       'bg-pink-50   dark:bg-pink-950   border-pink-200   dark:border-pink-800   text-pink-700   dark:text-pink-400',
};

const YourWords: React.FC = () => {
  const [words, setWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  useEffect(() => {
    getUserWords()
      .then((res) => setWords(res.words || []))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-16 pb-32">
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-brand-accent rounded-full" />
          <span className="technical-label">Your Practice Journal</span>
        </div>
        <h2 className="text-5xl font-serif font-black italic tracking-tight">
          Your Words
        </h2>
        <p className="text-sm text-brand-muted font-serif italic">
          {words.length > 0
            ? `${words.length} word${words.length !== 1 ? 's' : ''} you've practised so far — click any to see your sentences.`
            : 'Words you practise will appear here.'}
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
        </div>
      ) : words.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-20 text-center space-y-6 border-dashed"
        >
          <BookMarked className="w-14 h-14 text-brand-accent/40 mx-auto" />
          <h3 className="text-2xl font-serif font-black italic text-brand-muted">
            No words practised yet
          </h3>
          <p className="text-sm text-brand-muted font-serif italic max-w-xs mx-auto leading-relaxed">
            Head to the{' '}
            <Link to="/" className="text-brand-accent underline">
              Home
            </Link>{' '}
            page and write a sentence using today's word to get started.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {words.map((item: any, idx: number) => (
            <motion.div
              key={item.wordId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="card overflow-hidden"
            >
              {/* Word header row — clickable to expand */}
              <button
                onClick={() =>
                  setExpandedWord(expandedWord === item.wordId ? null : item.wordId)
                }
                className="w-full flex items-center justify-between p-6 md:p-8 text-left group"
              >
                <div className="flex items-center gap-6">
                  {/* Letter icon */}
                  <div className="w-12 h-12 rounded-2xl bg-brand-bg flex items-center justify-center font-serif italic text-2xl font-black text-brand-accent group-hover:bg-brand-accent group-hover:text-white transition-all duration-400 shrink-0">
                    {item.wordId[0]}
                  </div>

                  <div>
                    <Link
                      to={`/word/${item.wordId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-2xl md:text-3xl font-serif font-black italic tracking-tight lowercase text-brand-primary hover:text-brand-accent transition-colors"
                    >
                      {item.wordId}
                    </Link>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted font-sans">
                        {item.partOfSpeech}
                      </span>
                      {item.level && (
                        <span
                          className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${LEVEL_COLORS[item.level] || 'bg-brand-bg border-brand-border text-brand-muted'}`}
                        >
                          {item.level}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {/* Sentence count badge */}
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-brand-bg rounded-xl border border-brand-border">
                    <MessageSquareQuote className="w-3.5 h-3.5 text-brand-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      {item.sentenceCount} sentence{item.sentenceCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Last practiced date */}
                  <div className="hidden md:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                    <Calendar className="w-3 h-3" />
                    {formatDate(item.lastPracticed)}
                  </div>

                  <motion.div
                    animate={{ rotate: expandedWord === item.wordId ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 text-brand-muted" />
                  </motion.div>
                </div>
              </button>

              {/* Expanded sentences */}
              <AnimatePresence>
                {expandedWord === item.wordId && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 md:px-8 pb-8 space-y-4 border-t border-brand-border pt-6">
                      {/* Word meaning */}
                      {item.meaning && (
                        <p className="text-sm font-serif italic text-brand-muted mb-4">
                          {item.meaning}
                        </p>
                      )}

                      {/* User sentences */}
                      <p className="technical-label mb-3">Your Sentences</p>
                      {item.sentences.map((s: any, i: number) => (
                        <motion.div
                          key={s._id || i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="pl-5 border-l-4 border-brand-accent bg-brand-accent/5 py-4 pr-5 rounded-r-2xl text-base text-brand-primary font-serif leading-relaxed"
                        >
                          "{s.text}"
                          <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                            {formatDate(s.createdAt)}
                          </div>
                        </motion.div>
                      ))}

                      <Link
                        to={`/word/${item.wordId}`}
                        className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-accent hover:underline mt-2"
                      >
                        View full word detail →
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default YourWords;
