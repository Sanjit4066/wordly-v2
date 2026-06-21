import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProviderUnavailableError, SentenceReview } from "../types";
import { buildReviewPrompt } from "../prompts";

/**
 * Reviews a user's sentence using Gemini AI.
 * 
 * TODO Tasks:
 * 1. Initialize the GoogleGenerativeAI client using the process.env.GEMINI_API_KEY.
 *    If the API key is missing, throw a ProviderUnavailableError.
 * 2. Get the generative model 'gemini-2.0-flash'.
 * 3. Build the prompt using buildReviewPrompt(word, sentence).
 * 4. Call model.generateContent(prompt) to get the review.
 * 5. Handle potential errors by wrapping the API call in a try/catch.
 *    If it throws, catch it and wrap it in a ProviderUnavailableError.
 * 6. Clean the response text by removing markdown code blocks, then parse the JSON.
 * 7. Return the parsed object as a SentenceReview with source: "gemini".
 */
export async function reviewWithGemini(
  word: string,
  sentence: string
): Promise<SentenceReview> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderUnavailableError("gemini", "GEMINI_API_KEY is missing in environment variables");
  }

  const prompt = buildReviewPrompt(word, sentence);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();

    if (!rawText) {
      throw new Error("empty response from Gemini API");
    }

    const cleaned = rawText.replace(/```json|```/g, "").trim();
    
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`bad JSON from Gemini: ${cleaned}`);
    }

    return { ...parsed, source: "gemini" } as SentenceReview;
  } catch (err: any) {
    throw new ProviderUnavailableError("gemini", err.message || "Unknown error");
  }
}
