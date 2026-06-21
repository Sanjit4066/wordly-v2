import { ProviderUnavailableError, SentenceReview } from "../types";
import { buildReviewPrompt } from "../prompts";

/**
 * Reviews a user's sentence using Groq cloud API.
 */
export async function reviewWithGroq(
  word: string,
  sentence: string
): Promise<SentenceReview> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ProviderUnavailableError("groq", "GROQ_API_KEY is missing in environment variables");
  }

  const prompt = buildReviewPrompt(word, sentence);

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }, // Ensures valid JSON response from Groq
        temperature: 0.2,
      }),
    });
  } catch (err) {
    throw new ProviderUnavailableError("groq", (err as Error).message);
  }

  if (!response.ok) {
    throw new ProviderUnavailableError("groq", `HTTP ${response.status}`);
  }

  const data: any = await response.json();
  const rawText: string = data?.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new ProviderUnavailableError("groq", "empty response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch (err) {
    throw new ProviderUnavailableError("groq", `bad JSON from Groq: ${rawText}`);
  }

  return { ...parsed, source: "groq" } as SentenceReview;
}
