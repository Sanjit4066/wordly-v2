// V2 API Service — replaces all Firebase/Firestore calls
// All requests go to http://localhost:5000/api/*

const BASE = '/api';

// Get user ID from localStorage (set after Firebase auth)
export function getUserId(): string {
  return localStorage.getItem('wordly_user_id') || 'anonymous';
}

export function getUserLevel(): string {
  return localStorage.getItem('wordly_user_level') || 'intermediate';
}

export function setUserLevel(level: string) {
  localStorage.setItem('wordly_user_level', level);
}

const headers = () => ({
  'Content-Type': 'application/json',
  'x-user-id': getUserId(),
  'x-user-level': getUserLevel(),
  'x-admin-key': 'wordly-admin-123',
});

// ─── WORD ────────────────────────────────────────────────────────────────────

export async function searchWord(query: string) {
  const res = await fetch(`${BASE}/word/search?q=${encodeURIComponent(query)}`, { headers: headers() });
  return res.json();
}

export async function getDailyWord() {
  const res = await fetch(`${BASE}/word/daily`, { headers: headers() });
  return res.json();
}

export async function getWordsByLevel(level: string, page = 1) {
  const res = await fetch(`${BASE}/word/level/${level}?page=${page}&limit=20`, { headers: headers() });
  return res.json();
}

export async function getDictionaryStats() {
  const res = await fetch(`${BASE}/word/stats`, { headers: headers() });
  return res.json();
}

export async function getUserRequests() {
  const res = await fetch(`${BASE}/word/requests`, { headers: headers() });
  return res.json();
}

// ─── REVISION ────────────────────────────────────────────────────────────────

export async function getYesterdayWord() {
  const res = await fetch(`${BASE}/revision/yesterday`, { headers: headers() });
  return res.json();
}

export async function getDueRevisions() {
  const res = await fetch(`${BASE}/revision/due`, { headers: headers() });
  return res.json();
}

export async function submitSelfMark(wordId: string, selfMark: 'got_it' | 'needs_practice') {
  const res = await fetch(`${BASE}/revision/self-mark`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ wordId, selfMark }),
  });
  return res.json();
}

// ─── SENTENCES ───────────────────────────────────────────────────────────────

export async function getSentences(wordId: string) {
  const res = await fetch(`${BASE}/sentences/${wordId}`, { headers: headers() });
  return res.json();
}

export async function saveSentence(wordId: string, text: string) {
  const res = await fetch(`${BASE}/sentences`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ wordId, text }),
  });
  return res.json();
}

export async function editSentence(wordId: string, sentenceId: string, text: string) {
  const res = await fetch(`${BASE}/sentences/${wordId}/${sentenceId}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function deleteSentence(wordId: string, sentenceId: string) {
  const res = await fetch(`${BASE}/sentences/${wordId}/${sentenceId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return res.json();
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

export async function getNotifications() {
  const res = await fetch(`${BASE}/notifications`, { headers: headers() });
  return res.json();
}

export async function getNotificationCount() {
  const res = await fetch(`${BASE}/notifications/count`, { headers: headers() });
  return res.json();
}

export async function markNotificationsRead() {
  const res = await fetch(`${BASE}/notifications/mark-read`, {
    method: 'PUT',
    headers: headers(),
  });
  return res.json();
}

export async function sendWelcomeNotification(displayName: string) {
  const res = await fetch(`${BASE}/notifications/welcome`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ displayName }),
  });
  return res.json();
}

// ─── QUIZ ────────────────────────────────────────────────────────────────────

export async function getCurrentQuiz() {
  const res = await fetch(`${BASE}/quiz/current`, { headers: headers() });
  return res.json();
}

export async function submitQuiz(quizId: string, answers: Record<string, string>) {
  const res = await fetch(`${BASE}/quiz/${quizId}/submit`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ answers }),
  });
  return res.json();
}

// ─── PROGRESS ────────────────────────────────────────────────────────────────

export async function getHeatmap() {
  const res = await fetch(`${BASE}/progress/heatmap`, { headers: headers() });
  return res.json();
}

export async function getStreak() {
  const res = await fetch(`${BASE}/progress/streak`, { headers: headers() });
  return res.json();
}

export async function getMastery() {
  const res = await fetch(`${BASE}/progress/mastery`, { headers: headers() });
  return res.json();
}

export async function markMastery(wordId: string, masteryLevel: 'seen' | 'practiced' | 'familiar' | 'mastered') {
  const res = await fetch(`${BASE}/progress/mark`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ wordId, masteryLevel }),
  });
  return res.json();
}

export async function getUserWords() {
  const res = await fetch(`${BASE}/sentences/user/all`, { headers: headers() });
  return res.json();
}
