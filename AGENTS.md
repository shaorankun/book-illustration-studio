# AGENTS.md

Project context for AI coding assistants.

## What this is

Book Illustration Studio — a fullstack web app that turns a book's text into character portraits and a chapter illustration via the Gemini API.

Built as a Gradion intern take-home assessment.

## Stack

- **Backend:** Node.js + Express, JSON file storage, in-process mutex
- **Frontend:** React + Vite, Gradion Design System tokens
- **AI:** Gemini JS SDK (`@google/genai`), text model + image model (Nano Banana)
- **Tests:** Vitest (backend pipeline rules + frontend component states)

## Pipeline (5 steps, user-driven, in order)

1. **Style** — user-provided or AI-generated art style
2. **Characters** — structured JSON, max 2 adult characters (server-enforced)
3. **Portraits** — one image per character, sequential generation
4. **Chapters** — structured JSON, max 1 chapter (server-enforced)
5. **Illustrations** — one image per chapter, reuses portraits via conversation chaining

## Key conventions

- One JSON file per project in `data/projects/{id}.json`
- Book text stored in `data/books/{id}.txt`
- Generated images in `data/images/{id}/`
- Users index in `data/users.json`
- All writes go through `withLock(projectId, fn)` — never lock around Gemini calls
- `status` = pipeline progress (CREATED → STYLE_SET → ... → DONE)
- `stepState` = IDLE | RUNNING (separate from status)
- Polling: frontend GETs project every 1.5s while stepState is RUNNING

## Hard rules

- Caps: 2 characters, 1 chapter — enforced server-side in pipeline.js
- No auto-retry of Gemini calls — user-triggered only
- Book sent to Gemini once via file upload, reused via previous_interaction_id
- Stale RUNNING timeout: 180s (configurable via STALE_RUNNING_MS)

## File structure

```
server/
  config.js        — env vars with defaults
  constants.js     — pipeline steps, caps, system instructions
  lock.js          — in-process promise-chain mutex
  store.js         — JSON file CRUD, book/image paths
  session.js       — HMAC-signed cookie auth
  gemini.js        — Gemini SDK adapter (upload, chat, image gen)
  pipeline.js      — state machine, step runners, claim/execute/fail
  app.js           — Express routes
  index.js         — server entry point
web/
  src/
    App.jsx        — routing + shell layout
    api.js         — fetch wrapper
    ui.jsx         — Gradion wordmark, step labels
    styles.css     — Gradion tokens from app-demo.html
    pages/         — Auth, ProjectList, NewProject, ProjectDetail
    components/    — StepPanel, EmptyState
```

## Testing

- `npm test` runs Vitest with two projects: server (node) and web (jsdom)
- Backend tests mock Gemini — never burns quota
- Frontend tests use Testing Library

## Do not

- Implement Veo, Lyria, TTS, SSE, or public deploy
- Auto-retry Gemini calls in a loop
- Re-send the book text on every step
- Lock around the Gemini API call itself
- Hardcode model IDs — use env vars
