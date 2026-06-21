import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Volume2, Loader2, Send, Edit2, Trash2, Check, X, Clock, Mic, MicOff, Play, AlertCircle, Sparkles } from 'lucide-react';
import { searchWord, getSentences, saveSentence, editSentence, deleteSentence } from '../services/api';
import { LEVEL_COLORS } from '../utils/colors';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const WordDetail: React.FC = () => {
  const { term } = useParams<{ term: string }>();
  const navigate = useNavigate();
  const [wordData, setWordData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sentences, setSentences] = useState<any[]>([]);
  const [newSentence, setNewSentence] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechFeedback, setSpeechFeedback] = useState<'idle' | 'listening' | 'success' | 'retry' | 'unsupported'>('idle');
  const [spokenText, setSpokenText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!term) return;
    loadWord();
  }, [term]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const loadWord = async () => {
    setLoading(true);
    try {
      const res = await searchWord(term!);
      if (res.found) {
        setWordData(res.data);
        const sentRes = await getSentences(res.data.word);
        setSentences(sentRes.sentences || []);
      } else {
        toast.info(`"${term}" is queued for processing. Check back tomorrow!`);
        navigate(-1);
      }
    } catch {
      toast.error('Failed to load word.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!wordData || !newSentence.trim()) return;
    setSaving(true);
    try {
      await saveSentence(wordData.word, newSentence.trim());
      const res = await getSentences(wordData.word);
      setSentences(res.sentences || []);
      setNewSentence('');
      toast.success('Sentence saved!');
    } catch {
      toast.error('Failed to save sentence.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (sentenceId: string) => {
    if (!wordData || !editText.trim()) return;
    try {
      await editSentence(wordData.word, sentenceId, editText.trim());
      const res = await getSentences(wordData.word);
      setSentences(res.sentences || []);
      setEditingId(null);
      toast.success('Sentence updated!');
    } catch {
      toast.error('Failed to update.');
    }
  };

  const handleDelete = async (sentenceId: string) => {
    if (!wordData) return;
    try {
      await deleteSentence(wordData.word, sentenceId);
      setSentences(sentences.filter((s: any) => s._id !== sentenceId));
      toast.success('Sentence removed.');
    } catch {
      toast.error('Failed to delete.');
    }
  };

  const playAudio = () => {
    if (!term) return;
    const utterance = new SpeechSynthesisUtterance(term);
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const playRecordedAudio = () => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.play().catch(err => console.error('Playback failed', err));
  };

  const handleSpeech = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopRecording();
      setIsListening(false);
      setSpeechFeedback('idle');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
      setSpeechFeedback('unsupported');
      return;
    }

    setSpeechFeedback('listening');
    setIsListening(true);
    setSpokenText('');
    setAudioUrl(null);
    startRecording();

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setSpokenText(speechToText);

      // Clean punctuation, spaces, and casing
      const cleanTarget = (wordData.word || '').trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
      const cleanSpoken = speechToText.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");

      if (cleanSpoken.includes(cleanTarget) || cleanTarget.includes(cleanSpoken)) {
        setSpeechFeedback('success');
        toast.success(`Excellent! You said: "${speechToText}"`);
      } else {
        setSpeechFeedback('retry');
        toast.error(`Not quite. Heard: "${speechToText}". Try again!`);
      }
    };

    recognition.onerror = (event: any) => {
      stopRecording();
      if (event.error === 'aborted') return;
      console.error(event.error);
      setIsListening(false);
      setSpeechFeedback('retry');
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please check settings.');
      } else {
        toast.error('Speech recognition failed. Try again.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      stopRecording();
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const renderHighlightedStory = (story: string, word: string) => {
    if (!story) return null;
    if (!word) return story;
    const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b(${escapedWord}(?:s|es|ed|ing)?)\\b`, 'gi');
    const parts = story.split(regex);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <span key={i} className="font-bold text-brand-accent underline decoration-dotted underline-offset-4">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-12 h-12 text-brand-accent animate-spin" />
      <p className="text-xs font-bold text-brand-muted uppercase tracking-[0.2em]">Looking up word...</p>
    </div>
  );

  if (!wordData) return <div className="text-center py-20 font-serif italic">Word not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-32">
      <header className="flex items-center justify-between sticky top-24 glass py-4 px-8 z-30 rounded-full border border-brand-border">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-muted hover:text-brand-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border ${LEVEL_COLORS[wordData.level] || ''}`}>
          {wordData.level}
        </span>
      </header>

      {/* Word Hero */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-center">
        <h1 className="text-7xl md:text-9xl font-serif font-black italic tracking-tighter leading-none lowercase text-brand-accent">
          {wordData.word}
        </h1>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-6">
            <button onClick={playAudio} className="flex items-center gap-2 text-brand-muted hover:text-brand-accent transition-colors">
              <Volume2 className="w-5 h-5" />
              <span className="text-lg font-serif italic">Hear it</span>
            </button>
            
            <span className="w-1.5 h-1.5 bg-brand-border rounded-full"></span>
            
            <button
              onClick={handleSpeech}
              className={`flex items-center gap-2 transition-all duration-300 cursor-pointer ${
                speechFeedback === 'listening'
                  ? 'text-red-500 animate-pulse font-bold'
                  : speechFeedback === 'success'
                  ? 'text-emerald-500 font-bold scale-105'
                  : speechFeedback === 'retry'
                  ? 'text-amber-500'
                  : 'text-brand-muted hover:text-brand-accent'
              }`}
              title="Speak to practice pronunciation"
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              <span className="text-lg font-serif italic">
                {speechFeedback === 'listening'
                  ? 'Listening...'
                  : speechFeedback === 'success'
                  ? 'Perfect!'
                  : speechFeedback === 'retry'
                  ? 'Try again'
                  : 'Speak it'}
              </span>
            </button>

            {audioUrl && (
              <>
                <span className="w-1.5 h-1.5 bg-brand-border rounded-full"></span>
                <button
                  onClick={playRecordedAudio}
                  className="flex items-center gap-2 text-brand-muted hover:text-emerald-500 transition-colors cursor-pointer"
                  title="Play back your own voice recording"
                >
                  <Play className="w-5 h-5 text-emerald-500 animate-pulse" />
                  <span className="text-lg font-serif italic text-emerald-500 font-bold">Play me</span>
                </button>
              </>
            )}

            <span className="w-1.5 h-1.5 bg-brand-border rounded-full"></span>
            
            <span className="text-brand-accent font-bold uppercase tracking-[0.2em] text-[10px]">{wordData.partOfSpeech}</span>
          </div>
          
          <AnimatePresence>
            {spokenText && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-xs font-mono uppercase tracking-wider text-brand-muted/80"
              >
                Heard: "{spokenText}"
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.section>

      {/* Definition */}
      <div className="card p-12 space-y-8">
        <p className="text-2xl md:text-3xl font-sans font-medium leading-relaxed text-brand-primary">
          {wordData.meaning}
        </p>
        <div className="space-y-3">
          {(wordData.sentences?.length ? wordData.sentences : [wordData.sentence]).map((s: string, i: number) => (
            <div key={i} className="pl-6 border-l-4 border-brand-accent bg-brand-accent/5 py-5 pr-6 rounded-r-2xl text-xl text-brand-primary font-serif leading-relaxed shadow-sm">
              "{s}"
            </div>
          ))}
        </div>

        {/* Synonyms & Antonyms */}
        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-brand-border">
          {wordData.synonyms?.length > 0 && (
            <div className="space-y-3">
              <p className="technical-label">Synonyms</p>
              <div className="flex flex-wrap gap-2">
                {wordData.synonyms.map((s: string) => (
                  <Link key={s} to={`/word/${s}`} className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-colors ${LEVEL_COLORS[wordData.level] || 'bg-brand-bg text-brand-primary border-brand-border'}`}>{s}</Link>
                ))}
              </div>
            </div>
          )}
          {wordData.antonyms?.length > 0 && (
            <div className="space-y-3">
              <p className="technical-label">Antonyms</p>
              <div className="flex flex-wrap gap-2">
                {wordData.antonyms.map((a: string) => (
                  <Link key={a} to={`/word/${a}`} className="px-3 py-1 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 text-[10px] font-bold rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900 transition-colors">{a}</Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-Life Context Story */}
      {wordData.story && (
        <div className="relative card overflow-hidden p-12 bg-gradient-to-br from-brand-accent/5 via-brand-bg to-brand-bg border border-brand-accent/20 space-y-6 shadow-xl shadow-brand-accent/5">
          {/* Large decorative quotation mark */}
          <span className="absolute font-serif text-brand-accent/10 text-9xl -left-2 -top-6 select-none pointer-events-none">
            &ldquo;
          </span>
          <span className="absolute font-serif text-brand-accent/10 text-9xl -right-2 -bottom-20 select-none pointer-events-none">
            &rdquo;
          </span>
          
          <div className="relative z-10 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent/80 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse"></span>
              Real-Life Context Story
            </p>
            <p className="text-xl md:text-2xl font-serif italic text-brand-primary leading-relaxed pl-6 border-l-4 border-brand-accent/30">
              {renderHighlightedStory(wordData.story, wordData.word)}
            </p>
          </div>
        </div>
      )}

      {/* Etymology */}
      {wordData.etymology && (
        <div className="card p-8 bg-slate-900 dark:bg-black/60 border-slate-800 dark:border-black/60 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Etymology</p>
          <p className="text-sm font-serif italic text-slate-300 leading-relaxed">{wordData.etymology}</p>
        </div>
      )}

      {/* Write Sentences */}
      <div className="card p-10 space-y-8">
        <h4 className="technical-label">Your Sentences</h4>
        <div className="relative user-input-area p-2 rounded-3xl">
          <textarea
            value={newSentence}
            onChange={(e) => setNewSentence(e.target.value)}
            placeholder={`Use "${wordData.word}" in your own sentence...`}
            className="w-full h-36 p-6 bg-white dark:bg-brand-surface border border-brand-accent/30 rounded-3xl font-serif italic text-xl focus:outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10 transition-all resize-none"
          />
          <button
            onClick={handleSave}
            disabled={saving || !newSentence.trim()}
            className="absolute bottom-6 right-6 px-6 py-3 bg-brand-accent text-white rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Save
          </button>
        </div>

        {/* Saved Sentences */}
        <div className="space-y-4">
          {sentences.length === 0 && (
            <p className="text-xs italic text-brand-muted text-center py-4 opacity-50">No sentences yet. Write your first one above!</p>
          )}
          {sentences.map((s: any) => (
            <div key={s._id} className="group bg-white dark:bg-brand-surface p-6 rounded-3xl border border-brand-border space-y-4 hover:shadow-lg transition-all duration-300 relative">
              {editingId === s._id ? (
                <div className="space-y-3">
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-white dark:bg-brand-surface p-4 rounded-xl font-serif italic text-lg focus:outline-none focus:ring-1 ring-brand-accent resize-none h-24 border border-brand-border"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingId(null)} className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-brand-muted hover:text-brand-primary flex items-center gap-1">
                      <X className="w-3 h-3" /> Cancel
                    </button>
                    <button onClick={() => handleEdit(s._id)} className="px-6 py-1.5 bg-brand-primary text-white rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <Check className="w-3 h-3" /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-lg font-serif italic text-brand-primary">"{s.text}"</p>
                    
                    {/* Badges for correctness & source */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s.source && s.source !== 'none' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500">
                          🤖 {s.source === 'ollama' ? 'Local AI' : s.source === 'groq' ? 'Groq AI' : 'Gemini AI'}
                        </span>
                      )}
                      {s.isCorrectUsage !== undefined && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          s.isCorrectUsage 
                            ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' 
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                        }`}>
                          {s.isCorrectUsage ? '✓ Correct' : '⚠ Review'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Grammar Issues */}
                  {s.grammarIssues && s.grammarIssues.length > 0 && (
                    <div className="space-y-1.5 p-4 bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                      <p className="text-[10px] font-bold text-rose-700 uppercase tracking-widest flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Grammar Issues</span>
                      </p>
                      <ul className="list-disc list-inside text-xs text-rose-600 dark:text-rose-400 space-y-1 font-sans">
                        {s.grammarIssues.map((issue: string, idx: number) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Feedback */}
                  {s.feedback && (
                    <p className="text-xs text-brand-muted font-sans leading-relaxed">
                      <span className="font-bold text-brand-primary">Feedback:</span> {s.feedback}
                    </p>
                  )}

                  {/* Flow Suggestion */}
                  {s.flowSuggestion && s.flowSuggestion.trim().toLowerCase() !== s.text.trim().toLowerCase() && (
                    <div className="flex items-center justify-between gap-4 p-4 bg-brand-accent/5 rounded-2xl border border-brand-accent/10">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                          <span>Better Flow Suggestion</span>
                        </p>
                        <p className="text-sm font-serif italic text-brand-primary">
                          "{s.flowSuggestion}"
                        </p>
                      </div>
                      <button
                        onClick={() => setNewSentence(s.flowSuggestion)}
                        className="px-3 py-1.5 bg-brand-accent text-white text-[10px] font-bold uppercase tracking-wider rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex-shrink-0"
                      >
                        Use Suggestion
                      </button>
                    </div>
                  )}

                  {/* Footer with date & actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-brand-border/40">
                    <div className="flex items-center gap-1.5 text-[8px] font-bold text-brand-muted uppercase">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(s._id); setEditText(s.text); }} className="p-2 text-brand-muted hover:text-brand-accent">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(s._id)} className="p-2 text-brand-muted hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WordDetail;
