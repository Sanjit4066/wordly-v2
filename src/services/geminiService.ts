import { GoogleGenerativeAI } from '@google/generative-ai';
import { DifficultyLevel } from '../models/Dictionary';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ─── DIFFICULTY LEVEL CLASSIFICATION ─────────────────────────────────────────
// Maps AI-returned levels to our standard 4-tier system
// ─────────────────────────────────────────────────────────────────────────────
function normalizeDifficultyLevel(raw: string): DifficultyLevel {
  const cleaned = raw.toLowerCase().trim();
  if (['beginner', 'basic', 'elementary', 'easy', 'a1', 'a2'].includes(cleaned)) return 'beginner';
  if (['intermediate', 'medium', 'moderate', 'b1', 'b2'].includes(cleaned)) return 'intermediate';
  if (['advanced', 'hard', 'difficult', 'c1'].includes(cleaned)) return 'advanced';
  if (['expert', 'proficient', 'very hard', 'academic', 'rare', 'c2'].includes(cleaned)) return 'expert';
  return 'intermediate'; // safe default
}

export interface AIWordData {
  word: string;
  meaning: string;
  sentence: string;
  level: DifficultyLevel;
  synonyms: string[];
  antonyms: string[];
  etymology: string;
  partOfSpeech: string;
}

// ─── BATCH WORD PROCESSOR ─────────────────────────────────────────────────────
// Called once per unknown word during the 11:55 PM cron job.
// Returns full word data INCLUDING a difficulty level classification.
// The level field determines which difficulty bucket the word lands in:
//   beginner   → common words users can learn on day 1
//   intermediate → words for users with basic vocabulary
//   advanced   → words users see when they select "advanced" mode
//   expert     → rare/academic words for power users
// ─────────────────────────────────────────────────────────────────────────────
export async function processWordWithAI(word: string): Promise<AIWordData> {
  const prompt = `
You are a vocabulary expert. Analyze the English word "${word}" and return a JSON object with these exact fields:

{
  "word": "${word}",
  "meaning": "clear, concise definition in 1-2 sentences",
  "sentence": "one natural example sentence using the word",
  "level": "ONE of: beginner | intermediate | advanced | expert",
  "synonyms": ["up to 4 synonyms"],
  "antonyms": ["up to 4 antonyms"],
  "etymology": "brief origin/history of the word (1-2 sentences)",
  "partOfSpeech": "noun | verb | adjective | adverb | etc."
}

Level classification guide:
- beginner: everyday common words (hello, run, happy, food)
- intermediate: moderately complex words most adults know (eloquent, persist, obscure)
- advanced: sophisticated vocabulary for educated readers (ephemeral, laconic, solipsism)
- expert: rare, highly academic, or technical words (sesquipedalian, vellichor, tmesis)

Return ONLY the JSON object. No markdown, no explanation, no backticks.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip any accidental markdown fences
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      word: parsed.word?.toLowerCase() || word.toLowerCase(),
      meaning: parsed.meaning || '',
      sentence: parsed.sentence || '',
      level: normalizeDifficultyLevel(parsed.level || 'intermediate'),
      synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
      antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms : [],
      etymology: parsed.etymology || '',
      partOfSpeech: parsed.partOfSpeech || 'unknown',
    };
  } catch (error) {
    console.error(`❌ AI failed for word "${word}":`, error);
    throw new Error(`AI processing failed for word: ${word}`);
  }
}

// ─── WEEKLY QUIZ GENERATOR ─────────────────────────────────────────────────────
// Called once per user every Monday at 11 PM.
// Pre-generates MCQ questions stored in weekly_quizzes — zero AI at quiz time.
// ─────────────────────────────────────────────────────────────────────────────
export interface QuizQuestion {
  wordId: string;
  question: string;
  options: string[];
  answer: string;
}

export async function generateWeeklyQuiz(
  words: { wordId: string; word: string; meaning: string }[]
): Promise<QuizQuestion[]> {
  if (words.length === 0) return [];

  const wordList = words
    .map((w) => `- "${w.word}": ${w.meaning}`)
    .join('\n');

  const prompt = `
You are a vocabulary quiz creator. Generate one multiple-choice question for each word below.

Words:
${wordList}

Return a JSON array with one object per word:
[
  {
    "wordId": "<word string>",
    "question": "What does 'X' mean?",
    "options": ["correct meaning", "wrong option 2", "wrong option 3", "wrong option 4"],
    "answer": "correct meaning"
  }
]

Rules:
- Shuffle the options so the correct answer is not always first
- Wrong options should be plausible but clearly different from the correct meaning
- Keep questions simple and clear
- Return ONLY the JSON array. No markdown, no explanation.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed: QuizQuestion[] = JSON.parse(cleaned);
    return parsed;
  } catch (error) {
    console.error('❌ Quiz generation failed:', error);
    throw new Error('Failed to generate weekly quiz');
  }
}
