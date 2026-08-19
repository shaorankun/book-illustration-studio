# Book Illustration Studio

Gradion intern take-home: turn book text into two character portraits and one chapter illustration via Gemini. Pipeline follows Google’s *Wind in the Willows* notebook (steps 1–5 only).

## Prerequisites

- Node.js 20+
- A Gemini API key ([AI Studio](https://aistudio.google.com/apikey))

## One command to start

```bash
cp .env.example .env   # then paste GEMINI_API_KEY
./start.sh             # or: npm install && npm start
```

On Windows PowerShell: `copy .env.example .env` then `npm install; npm start`.

UI: http://127.0.0.1:5173  
API: http://127.0.0.1:3001

Docker is not used. JSON files on disk are enough for one local process.

## One command to test

```bash
./test.sh
# or: npm test
```

## Environment

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Required for real generation |
| `GEMINI_TEXT_MODEL` | Default `gemini-2.5-flash` |
| `GEMINI_IMAGE_MODEL` | Default `gemini-2.5-flash-image` (Nano Banana). Colab’s `gemini-3.1-flash-lite-image` failed on our key. |
| `SESSION_SECRET` | Signs the session cookie |
| `DATA_DIR` | JSON + book text + images (default `./data`) |
| `STALE_RUNNING_MS` | Stuck-step timeout (default 180000) |
| `PORT` | API port (default 3001) |

Never commit `.env`.

## Architecture

- **web/** Vite + React, Gradion tokens from `app-demo.html`. Polls `GET /api/projects/:id` every 1.5s while a step is running.
- **server/** Express. Email + name cookie session. One JSON file per project, `users.json` index, book `.txt` and images on disk.
- **Lock:** in-process mutex per `projectId` around read–modify–write only. `POST .../steps/:step` sets `RUNNING` and returns 202; Gemini runs in the background.
- **Gemini:** upload the book once, chain text with `previous_interaction_id`, then a separate image conversation for portraits and the chapter illustration (notebook path A). Server slices to **2 characters / 1 chapter**.

See `DECISIONS.md` and `docs/plan.md`.
