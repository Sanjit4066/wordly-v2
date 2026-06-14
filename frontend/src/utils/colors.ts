export type Level = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-50 border-green-200 text-green-700',
  intermediate: 'bg-blue-50 border-blue-200 text-blue-700',
  advanced: 'bg-amber-50 border-amber-200 text-amber-700',
  expert: 'bg-pink-50 border-pink-200 text-pink-700',
};

export const LEVEL_TEXT_COLORS: Record<string, string> = {
  beginner: 'text-green-600',
  intermediate: 'text-blue-600',
  advanced: 'text-amber-600',
  expert: 'text-pink-600',
};
