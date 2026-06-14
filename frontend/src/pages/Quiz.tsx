import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, CheckCircle2, XCircle, ArrowRight, Sparkles, BookOpen, Lightbulb, Loader2 } from 'lucide-react';
import { getCurrentQuiz, submitQuiz } from '../services/api';
import { Link } from 'react-router-dom';

const Quiz: React.FC = () => {
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadQuiz();
  }, []);

  const loadQuiz = async () => {
    setLoading(true);
    try {
      const res = await getCurrentQuiz();
      if (res.found) setQuiz(res.quiz);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (option: string) => {
    if (selectedOption !== null) return;
    setSelectedOption(option);
    const wordId = quiz.questions[currentIndex].wordId;
    setAnswers((prev) => ({ ...prev, [wordId]: option }));
  };

  const handleNext = async () => {
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex((c) => c + 1);
      setSelectedOption(null);
    } else {
      // Submit quiz
      const res = await submitQuiz(quiz._id, answers);
      setResult(res);
      setFinished(true);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <Sparkles className="w-12 h-12 text-brand-accent animate-pulse" />
      <div className="text-center space-y-2">
        <p className="text-2xl font-serif italic">Loading your quiz...</p>
        <p className="technical-label">Fetching this week's questions</p>
      </div>
    </div>
  );

  if (!quiz) return (
    <div className="max-w-xl mx-auto py-24 text-center space-y-10 card p-16">
      <div className="w-20 h-20 bg-brand-bg rounded-3xl flex items-center justify-center mx-auto">
        <BookOpen className="w-8 h-8 text-brand-accent" />
      </div>
      <div className="space-y-4">
        <h2 className="text-4xl font-serif font-black italic tracking-tight">No Quiz Yet</h2>
        <p className="text-brand-muted leading-relaxed font-serif italic text-lg">
          Your weekly quiz is generated every Monday at 11 PM based on words you've learned that week. Keep learning daily words to unlock quizzes!
        </p>
      </div>
      <Link to="/" className="btn-primary inline-block">Go learn a word</Link>
    </div>
  );

  if (finished && result) return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="max-w-2xl mx-auto py-16 text-center space-y-12 card p-16"
    >
      <div className="space-y-4">
        <div className="w-20 h-20 bg-brand-accent rounded-full flex items-center justify-center mx-auto shadow-xl shadow-brand-accent/20 mb-6">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-5xl font-serif font-black italic tracking-tight">Quiz Complete!</h2>
        <p className="technical-label">Your linguistic mastery has grown</p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="p-8 bg-brand-bg rounded-[2rem] space-y-1">
          <p className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Score</p>
          <p className="text-4xl font-serif font-black italic">{result.score}%</p>
        </div>
        <div className="p-8 bg-brand-bg rounded-[2rem] space-y-1">
          <p className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Correct</p>
          <p className="text-4xl font-serif font-black italic text-brand-accent">{result.correct}/{result.total}</p>
        </div>
      </div>

      <div className="space-y-4">
        {result.breakdown?.map((b: any, i: number) => (
          <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border ${b.isCorrect ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
            {b.isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
            <div className="text-left">
              <p className="text-sm font-bold text-brand-primary">{b.wordId}</p>
              {!b.isCorrect && <p className="text-xs text-brand-muted">Correct: {b.correctAnswer}</p>}
            </div>
          </div>
        ))}
      </div>

      <Link to="/" className="text-xs font-bold uppercase tracking-widest text-brand-muted hover:text-brand-primary transition-all border-b-2 border-transparent hover:border-brand-accent pb-1 inline-block">
        Return to home
      </Link>
    </motion.div>
  );

  const currentQuestion = quiz.questions[currentIndex];

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-brand-accent rounded-full"></div>
          <span className="technical-label">Weekly Quiz</span>
        </div>
        <div className="flex items-center gap-6 bg-white dark:bg-brand-surface p-2 px-4 rounded-full border border-brand-border">
          <div className="w-32 h-1 bg-brand-bg rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-accent"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>
          <span className="mono-data text-[10px]">{currentIndex + 1} / {quiz.questions.length}</span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="space-y-12"
        >
          <div className="card p-12 md:p-20 min-h-[280px] flex flex-col justify-center text-center">
            <h3 className="text-3xl md:text-5xl font-serif font-medium leading-relaxed italic text-brand-primary">
              "{currentQuestion.question}"
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentQuestion.options.map((option: string, idx: number) => {
              const isSelected = selectedOption === option;
              const isCorrect = option === currentQuestion.answer;
              const showResult = selectedOption !== null;

              let styles = 'bg-white dark:bg-brand-surface border-brand-border hover:border-brand-accent hover:bg-brand-bg';
              if (showResult) {
                if (isCorrect) styles = 'bg-brand-accent border-brand-accent text-white shadow-lg';
                else if (isSelected) styles = 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400';
                else styles = 'bg-brand-bg border-brand-border opacity-40 cursor-not-allowed';
              }

              return (
                <button
                  key={idx}
                  disabled={showResult}
                  onClick={() => handleOptionSelect(option)}
                  className={`w-full p-8 rounded-[2rem] border-2 text-left transition-all duration-300 flex items-center justify-between group ${styles}`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 block">Option 0{idx + 1}</span>
                    <span className="text-lg font-serif italic">{option}</span>
                  </div>
                  {showResult && isCorrect && <CheckCircle2 className="w-6 h-6 shrink-0" />}
                  {showResult && isSelected && !isCorrect && <XCircle className="w-6 h-6 shrink-0" />}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {selectedOption !== null && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card p-10 space-y-6">
          <div className="flex items-center gap-3">
            <Lightbulb className="w-4 h-4 text-brand-accent" />
            <h4 className="technical-label">Did you know?</h4>
          </div>
          <p className="text-xl text-brand-muted leading-relaxed font-serif italic border-l-4 border-brand-bg pl-8">
            The correct answer is: <strong className="text-brand-primary">{currentQuestion.answer}</strong>
          </p>
          <button onClick={handleNext} className="w-full btn-primary flex items-center justify-center gap-3">
            {currentIndex === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default Quiz;
