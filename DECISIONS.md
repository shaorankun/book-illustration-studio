# Decisions

Written as we actually chose them — not backfilled.

## Node for the whole stack

Tuan’s call. One language for backend and frontend, faster to ship in one day. Cost: Python would have copied the cookbook SDK more literally; we map `interactions` / REST ourselves instead.

## JSON files plus an in-process lock per project

Tuan’s call after comparing SQLite. Spec allows JSON if writes cannot overlap. One Node process, state isolated per user/project, mutex keyed by `projectId` around read–modify–write only (not around the Gemini call). Overlapping Generate (second tab, double-click, refresh-then-click) must see `RUNNING` and must not fire Gemini twice.

Accepted limits: two Node processes writing the same folder would race (RAM lock does not span processes). We are not deploying that way. No transactions.

## Illustration consistency: conversation chaining only (notebook path A)

Tuan’s call. Portraits and the chapter illustration share one image-model conversation via `previous_interaction_id`. We tell the model to reuse earlier character images. We do **not** attach portrait bytes on the chapter request (notebook path B).

Tradeoff: this is the required Wind-in-the-Willows pipeline and cheaper (no extra image tokens on step 5). The real cost is weaker likeness — the model can drift face, clothes, or palette. Path B (pass portrait files as reference images) would be more stable; we skipped it to finish in one day. If we had another day, we would add those two portrait parts on the illustration call without changing the rest of the pipeline.

## Polling, not SSE

Tuan’s call. While `stepState` is `RUNNING`, the UI GETs the project every 1–2 seconds. SSE/WebSocket is assessment §08; we are not doing bonus work.

## Models

Pinned in `.env` / `.env.example` because the notebook default `gemini-3.1-flash-lite-image` returned “model does not support image generation” on Tuan’s key in Colab.

- Text: `gemini-2.5-flash` (override with `GEMINI_TEXT_MODEL`)
- Image: `gemini-2.5-flash-image` (Nano Banana; override with `GEMINI_IMAGE_MODEL`)

If a key later supports a newer Nano Banana id, change the env var — do not scatter hardcoded ids. No automatic Gemini retries.

## Known issue: Gemini free tier does not support image generation

During local testing, `gemini-2.5-flash-image` (Nano Banana) returned errors on the free tier — the model is available but image generation is gated. I temporarily swapped the image calls to HuggingFace (FLUX.1-schnell) to validate the full pipeline end-to-end: portrait generation, per-item reveal via polling, chapter illustrations, and conversation chaining. Everything works correctly.

Per the spec (§03, §05.3), the code is pinned to Gemini models. When a paid key or a key with image generation access is used, the pipeline runs as designed. The HuggingFace fallback was test-only and is not in the committed code.

---

## Where I overrode the AI

### 1. Single `status` field instead of separate `status` + `stepState`

AI proposed a single enum tracking pipeline progress. I pushed back — one field cannot express "step 3 done, step 4 currently running" which is exactly what a refresh mid-step needs to read correctly. Split into two fields: `status` (which step is done) and `stepState` (IDLE/RUNNING). Cost: two fields to keep in sync, and a stranded `stepState` needs a timeout to clear. Worth it.

### 2. In-process mutex instead of file-level locking

AI suggested `proper-persist` or database transactions for write safety. Overcomplicated — we have one Node process, state isolated per user/project. I replaced with a simple promise-chain lock keyed by `projectId` around read–modify–write only (not around the Gemini call itself). Overlapping Generate must see `RUNNING` and must not fire Gemini twice. This lock does exactly that. Two Node processes writing the same folder would race, but we're not deploying that way.

### 3. Polling instead of SSE/WebSocket

AI wanted to add Server-Sent Events for real-time updates. Overkill for this scope — the spec lists SSE as bonus (§08), not required. Polling GET every 1.5s while `stepState` is `RUNNING` is simpler, works reliably, and covers the "resumable on refresh" requirement. The UI just shows the existing in-flight state until it lands. No new infrastructure, no connection management.

### 4. JSON files on disk instead of SQLite/Postgres

AI kept suggesting a "real database". Spec explicitly allows JSON if writes cannot overlap (§5.2). One JSON file per project, `users.json` index, book text and images on disk. State isolated per user, mutex per project. No transactions needed. The real cost is no concurrent Node processes writing the same folder — accepted limit, not a problem at this scope.

---

If we had one more day: attach the two portraits as reference images on the chapter illustration call (path B), so character consistency does not depend on chat memory alone.
