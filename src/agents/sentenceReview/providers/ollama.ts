import { ProviderUnavailableError, SentenceReview } from "../types";
import { buildReviewPrompt } from "../prompts";

export async function reviewWithOllama(
    word: string,
    sentence: string
): Promise<SentenceReview> {
    // Build the prompt text using the template you already wrote in prompts.ts
    const prompt = buildReviewPrompt(word, sentence);

    let response: Response;
    try {
        // Call Ollama's local API — this is the same request your curl command made,
        // just written as a fetch() call instead of a terminal command
        response = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama3.2:3b",
                messages: [{ role: "user", content: prompt }],
                stream: false,
                options: {
                    num_predict: 1024,
                }
            }),
        });
    } catch (err) {
        // fetch throws (not a normal HTTP error) if Ollama isn't running at all
        throw new ProviderUnavailableError("ollama", (err as Error).message);
    }

    if (!response.ok) {
        throw new ProviderUnavailableError("ollama", `HTTP ${response.status}`);
    }

    // Parse Ollama's response envelope — remember from your curl test,
    // the model's actual reply text lives at data.message.content
    const data: any = await response.json();
    const rawText: string = data?.message?.content;

    if (!rawText) {
        throw new ProviderUnavailableError("ollama", "empty response");
    }

    // The model's reply is SUPPOSED to be JSON (we asked for it in the prompt),
    // but small models sometimes wrap it in ```json fences anyway — strip those defensively
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        throw new ProviderUnavailableError("ollama", `bad JSON from model: ${cleaned}`);
    }

    // Attach which provider answered, so the rest of your app knows where this came from
    return { ...parsed, source: "ollama" } as SentenceReview;
}