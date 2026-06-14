export type Level = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export const LEVEL_COLORS: Record<string, string> = {
  beginner:     'bg-green-50  dark:bg-green-950  border-green-200  dark:border-green-800  text-green-700  dark:text-green-400',
  intermediate: 'bg-blue-50   dark:bg-blue-950   border-blue-200   dark:border-blue-800   text-blue-700   dark:text-blue-400',
  advanced:     'bg-amber-50  dark:bg-amber-950  border-amber-200  dark:border-amber-800  text-amber-700  dark:text-amber-400',
  expert:       'bg-pink-50   dark:bg-pink-950   border-pink-200   dark:border-pink-800   text-pink-700   dark:text-pink-400',
};

export const LEVEL_TEXT_COLORS: Record<string, string> = {
  beginner:     'text-green-600  dark:text-green-400',
  intermediate: 'text-blue-600   dark:text-blue-400',
  advanced:     'text-amber-600  dark:text-amber-400',
  expert:       'text-pink-600   dark:text-pink-400',
};
