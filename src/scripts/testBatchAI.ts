import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const modelsToTest = [
  'gemini-flash-latest', 
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-pro-latest'
];

async function test() {
  const words = ['apple', 'banana', 'ephemeral', 'solipsism', 'fast'];
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
  "partOfSpeech": "noun | verb | adjective | adverb | etc."
}
Return ONLY the JSON array. No markdown, no explanation, no backticks.
`;
  
  for (const m of modelsToTest) {
    try {
      console.log(`Testing model: ${m}`);
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      console.log(`✅ SUCCESS on ${m}! Returned ${parsed.length} items.`);
      return; // Exit on first success
    } catch(e: any) {
      console.error(`❌ FAILED on ${m}: ${e.message}`);
    }
  }
}
test();
