# Plan

Ship a local Book Illustration Studio in one day: Node API + Vite/React, JSON storage, Gemini text + image chaining.

1. Identity (email + name, cookie) and projects (title + book text on disk).
2. State machine with per-project lock: no skipped steps, no duplicate Gemini calls, retry-able failures, stale RUNNING recovery.
3. Gemini adapter matching the notebook: file upload once, `previous_interaction_id` for text, separate image conversation for portraits then the chapter illustration. Caps 2 / 1 on the server.
4. Frontend copied from `app-demo.html` tokens. Poll GET while a step runs. Per-portrait progress.
5. Tests on step rules (backend) and empty/loading/error (frontend). Real test report in TESTING.md.
