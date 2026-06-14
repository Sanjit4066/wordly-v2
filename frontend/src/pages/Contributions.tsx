import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Clock, CheckCircle2, ChevronRight, Star } from 'lucide-react';
import { getUserRequests } from '../services/api';
import { LEVEL_COLORS } from '../utils/colors';
import { Link } from 'react-router-dom';

const Contributions: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const data = await getUserRequests();
        setRequests(data.requests || []);
      } catch (error) {
        console.error('Failed to fetch requests', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  return (
    <div className="content-area space-y-12 pb-32">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-6">
        <div className="inline-flex items-center gap-3 px-4 py-2 bg-brand-accent/10 rounded-full border border-brand-accent/20">
          <Star className="w-3 h-3 text-brand-accent" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">Your Contributions</span>
        </div>
        <div>
          <h2 className="text-5xl font-serif font-black italic tracking-tight">Community Lexicon</h2>
          <p className="text-sm text-brand-muted italic mt-2 max-w-2xl">
            Words you searched for that weren't in our dictionary. Thanks to you, they were added to Wordly! 
            Your curiosity helps expand our shared knowledge.
          </p>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="card p-12 text-center space-y-4">
          <Sparkles className="w-8 h-8 text-brand-accent mx-auto opacity-50" />
          <p className="font-serif italic text-xl text-brand-primary">No contributions yet.</p>
          <p className="text-sm text-brand-muted max-w-sm mx-auto">
            When you search for a word we don't know in Practice mode, it will appear here after our AI processes it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requests.map((req, i) => {
            const isDone = req.status === 'done';
            const wordData = req.dictionaryData;
            
            return (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                key={req._id}
                className="group p-6 bg-white dark:bg-brand-surface border border-brand-border rounded-3xl hover:border-brand-accent transition-all text-left relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    {isDone && wordData ? (
                      <p className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-2 inline-block ${LEVEL_COLORS[wordData.level]}`}>
                        {wordData.level}
                      </p>
                    ) : (
                      <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md mb-2 inline-block">
                        Pending AI
                      </p>
                    )}
                    <h3 className="text-2xl font-serif font-bold italic text-brand-primary lowercase">{req.word}</h3>
                  </div>
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-500" />
                  )}
                </div>

                {isDone && wordData ? (
                  <div className="space-y-4">
                    <p className="text-sm text-brand-muted line-clamp-2">{wordData.meaning}</p>
                    <Link to={`/word/${req.word}`} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-accent group-hover:translate-x-1 transition-transform">
                      View full details <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-brand-muted italic">
                    Currently in queue for processing. Check back after midnight!
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Contributions;
