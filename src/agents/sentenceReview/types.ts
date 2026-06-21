export class ProviderUnavailableError extends Error {
  provider: string;

  constructor(provider: string, detail: string) {
    super(`${provider} unavailable: ${detail}`);
    this.provider = provider;
  }
}

export interface SentenceReview {
  isCorrectUsage: boolean;
  grammarIssues: string[];
  flowSuggestion: string;
  feedback: string;
  source: string;
}