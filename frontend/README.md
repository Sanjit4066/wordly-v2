# Wordly V2 — Frontend

> React 19 + TypeScript + Vite frontend for Wordly V2

## What changed from V1

| V1 | V2 |
|---|---|
| Firebase Firestore for all data | MongoDB via Express API |
| Gemini AI called on every interaction | Pre-processed dictionary, zero AI in frontend |
| Global same Word of Day | Personalized by difficulty level |
| No spaced repetition | Built-in SR with self-assessment |
| No difficulty levels | 4 levels: beginner/intermediate/advanced/expert |

## Setup

```bash
npm install
cp .env.example .env
# Fill in Firebase credentials (auth only — no Firestore needed)
npm run dev
```

## Firebase config

Firebase is used **only for Google Authentication** in V2. All vocabulary data lives in MongoDB.

Get your Firebase config from: https://console.firebase.google.com → Project Settings → Your Apps

## Connecting to backend

The Vite dev server proxies `/api/*` to `http://localhost:5000`. Make sure the backend is running:

```bash
# In the wordly-v2 backend folder
npm run dev
```

## Pages

- `/` — Dashboard: Daily word, morning recall, streak stats
- `/library` — Browse words by difficulty level, search dictionary
- `/practice` — Search any word, queue unknown words for batch processing  
- `/quiz` — Weekly pre-generated MCQ quiz
- `/word/:term` — Full word detail with sentence practice
