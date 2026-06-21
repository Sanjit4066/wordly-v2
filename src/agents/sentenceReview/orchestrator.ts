import { SentenceReview } from "./types";
import { reviewWithOllama } from "./providers/ollama";
import { reviewWithGroq } from "./providers/groq";

/**
 * Orchestrates the fallback chain for reviewing a sentence.
 * 
 * TODO Tasks:
 * 1. Define an array of providers/functions in order of priority (Ollama first, then Gemini).
 * 2. Loop through each provider in the chain.
 * 3. Inside a try/catch block, execute the provider function.
 * 4. If a provider fails (e.g. throws a ProviderUnavailableError), catch the error,
 *    log a warning (e.g., console.warn(`⚠️ [Orchestrator] Provider ${name} failed, falling back...`)),
 *    and continue to the next provider in the chain.
 * 5. Return the first successful SentenceReview.
 * 6. If all providers fail, throw an error or return a fallback default review object
 *    (we should discuss which approach you prefer here!).
 */
export async function reviewSentenceOrchestrator(
  word: string,
  sentence: string
): Promise<SentenceReview> {
  const providers = [
    { name: "ollama", fn: reviewWithOllama },
    { name: "groq", fn: reviewWithGroq },
  ];

  const errors: Error[] = [];

  for (const provider of providers) {
    try {
      console.log(`🤖 [SentenceReview] Trying provider: ${provider.name}`);
      const review = await provider.fn(word, sentence);
      return review;
    } catch (err: any) {
      console.warn(`⚠️ [SentenceReview] Provider ${provider.name} failed:`, err.message || err);
      errors.push(err);
    }
  }

  // If all providers fail, throw a combined error
  throw new Error(`All sentence review providers failed: ${errors.map(e => e.message).join("; ")}`);
}
