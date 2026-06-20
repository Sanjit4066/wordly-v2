import { GoogleGenerativeAI } from '@google/generative-ai';
import { DifficultyLevel } from '../models/Dictionary';

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing in environment variables');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
}

function normalizeDifficultyLevel(raw: string): DifficultyLevel {
  const cleaned = raw.toLowerCase().trim();
  if (['beginner', 'basic', 'elementary', 'easy', 'a1', 'a2'].includes(cleaned)) return 'beginner';
  if (['intermediate', 'medium', 'moderate', 'b1', 'b2'].includes(cleaned)) return 'intermediate';
  if (['advanced', 'hard', 'difficult', 'c1'].includes(cleaned)) return 'advanced';
  if (['expert', 'proficient', 'very hard', 'academic', 'rare', 'c2'].includes(cleaned)) return 'expert';
  return 'intermediate';
}

/**
 * Retry wrapper with exponential backoff.
 * Handles Gemini 429 (rate limit) errors by waiting and retrying.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 4,
  baseDelayMs = 15000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.status === 429;
      if (is429 && attempt < maxRetries) {
        // Extract retry-after from the error message if available
        const retryMatch = err.message?.match(/retryDelay["\s:]+(\d+)/);
        const waitMs = retryMatch
          ? parseInt(retryMatch[1]) * 1000 + 2000
          : baseDelayMs * attempt; // exponential: 15s, 30s, 45s, 60s
        console.warn(`⏳ [Gemini] Rate limited. Waiting ${Math.round(waitMs / 1000)}s before retry (attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export interface AIWordData {
  word: string;
  meaning: string;
  sentences: string[]; // Always 2 example sentences
  level: DifficultyLevel;
  synonyms: string[];
  antonyms: string[];
  etymology: string;
  partOfSpeech: string;
  story: string;
}

export async function processWordWithAI(word: string): Promise<AIWordData> {
  const prompt = `
You are a vocabulary expert. Analyze the English word "${word}" and return a JSON object with these exact fields:

{
  "word": "${word}",
  "meaning": "clear, concise definition in 1-2 sentences",
  "sentences": ["first natural example sentence using the word", "second natural example sentence showing different context"],
  "level": "ONE of: beginner | intermediate | advanced | expert",
  "synonyms": ["up to 4 synonyms"],
  "antonyms": ["up to 4 antonyms"],
  "etymology": "brief origin/history of the word (1-2 sentences)",
  "partOfSpeech": "noun | verb | adjective | adverb | etc.",
  "story": "a narrative micro-story (around 200-250 words) featuring a character, a brief action/conflict, and a resolution that naturally uses the word. Avoid general scene descriptions; tell a tiny, complete story."
}

Level classification guide:
- beginner: everyday common words (hello, run, happy, food)
- intermediate: moderately complex words most adults know (eloquent, persist, obscure)
- advanced: sophisticated vocabulary for educated readers (ephemeral, laconic, solipsism)
- expert: rare, highly academic, or technical words (sesquipedalian, vellichor, tmesis)

Return ONLY the JSON object. No markdown, no explanation, no backticks.
`;

  const parsed = await withRetry(async () => {
    const result = await getModel().generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  });

  // Handle both old "sentence" (string) and new "sentences" (array) format
  let sentences: string[] = [];
  if (Array.isArray(parsed.sentences) && parsed.sentences.length > 0) {
    sentences = parsed.sentences;
  } else if (typeof parsed.sentence === 'string') {
    sentences = [parsed.sentence];
  }

  // Ensure we always have exactly 2 sentences
  if (sentences.length < 2) {
    sentences.push(`Understanding ${word} broadens your vocabulary and helps you communicate with greater precision.`);
  }

  return {
    word: parsed.word?.toLowerCase() || word.toLowerCase(),
    meaning: parsed.meaning || '',
    sentences: sentences.slice(0, 2), // cap at 2
    level: normalizeDifficultyLevel(parsed.level || 'intermediate'),
    synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
    antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms : [],
    etymology: parsed.etymology || '',
    partOfSpeech: parsed.partOfSpeech || 'unknown',
    story: parsed.story || '',
  };
}

export async function processWordsBatchWithAI(words: string[]): Promise<AIWordData[]> {
  const prompt = `
You are a vocabulary expert. Analyze the following English words: ${words.join(', ')}.
Return a JSON array of objects, where each object has these exact fields:

{
  "word": "the word",
  "meaning": "clear, concise definition in 1-2 sentences",
  "sentences": ["first natural example sentence using the word", "second natural example sentence showing different context"],
  "level": "ONE of: beginner | intermediate | advanced | expert",
  "synonyms": ["up to 4 synonyms"],
  "antonyms": ["up to 4 antonyms"],
  "etymology": "brief origin/history of the word (1-2 sentences)",
  "partOfSpeech": "noun | verb | adjective | adverb | etc.",
  "story": "a narrative micro-story (around 200-250 words) featuring a character, a brief action/conflict, and a resolution that naturally uses the word. Avoid general scene descriptions; tell a tiny, complete story."
}

Level classification guide:
- beginner: everyday common words (hello, run, happy, food)
- intermediate: moderately complex words most adults know (eloquent, persist, obscure)
- advanced: sophisticated vocabulary for educated readers (ephemeral, laconic, solipsism)
- expert: rare, highly academic, or technical words (sesquipedalian, vellichor, tmesis)

Return ONLY the JSON array. No markdown, no explanation, no backticks.
`;

  const parsedArray = await withRetry(async () => {
    const result = await getModel().generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as any[];
  });

  return parsedArray.map(parsed => {
    let sentences: string[] = [];
    if (Array.isArray(parsed.sentences) && parsed.sentences.length > 0) {
      sentences = parsed.sentences;
    } else if (typeof parsed.sentence === 'string') {
      sentences = [parsed.sentence];
    }
    if (sentences.length === 1) sentences.push(sentences[0]);
    if (sentences.length === 0) sentences = ["Example sentence 1.", "Example sentence 2."];

    return {
      word: parsed.word || '',
      meaning: parsed.meaning || '',
      sentences: sentences.slice(0, 2),
      level: normalizeDifficultyLevel(parsed.level),
      synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
      antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms : [],
      etymology: parsed.etymology || '',
      partOfSpeech: parsed.partOfSpeech || 'unknown',
      story: parsed.story || '',
    };
  });
}

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

  const wordList = words.map((w) => `- "${w.word}": ${w.meaning}`).join('\n');

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
    const result = await getModel().generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('❌ Quiz generation failed:', error);
    throw new Error('Failed to generate weekly quiz');
  }
}
