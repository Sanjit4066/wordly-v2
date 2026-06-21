export function buildReviewPrompt(word: string, sentence: string): string {
    return `You are a friendly English writing coach.

Respond with ONLY valid JSON. Follow these rules exactly:
- Use JSON syntax only (true/false/null), never Python syntax (never True/False/None)
- "flowSuggestion" must always be a real string containing an improved sentence — never null, never empty
- Do not include any text before or after the JSON object
- Do not use markdown code fences

Required shape:
{
  "isCorrectUsage": boolean,
  "grammarIssues": string[],
  "flowSuggestion": string,
  "feedback": string
}

Target word: "${word}"
User's sentence: "${sentence}"`;
}