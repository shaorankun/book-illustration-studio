# Testing

## What we test

**Backend (Vitest).** The pipeline rules the spec actually grades: you cannot skip a step; a second claim while `RUNNING` is rejected; a failed Gemini call leaves `status` where it was and stores `lastError`; a stuck `RUNNING` step can be cleared and retried; the 2-character / 1-chapter caps are applied on the server even if the model returns more; portraits that already exist are not requested again. Gemini is mocked — these tests must not spend quota.

**Frontend (Testing Library).** Two states that the demo did not really have: the empty project list, and the step panel’s in-progress vs error/retry UI (named step, disabled generate, retry only that step).

## What we deliberately don’t

- Hitting live Gemini or asserting image bytes look like Mole. That is quota and flaky.
- E2E through the browser. Out of scope; the HTTP + state machine tests cover resume/duplicate better than a click script.
- Cookie signing, file serving, and CSS. Low risk relative to the pipeline.
- An integration test of all five steps against the real API. Nice-to-have in the spec; skipped to keep the free-tier budget for manual UAT.

## How

`npm test` (or `./test.sh`). Report from a real run is below.

```
> book-illustration-studio@1.0.0 test
> vitest run

 RUN  v3.2.7 G:/Projects/Book_illustration

 ✓ server server/pipeline.test.js (7 tests) 91ms
 ✓ web  web/src/components/EmptyState.test.jsx (1 test) 56ms
 ✓ web  web/src/components/StepPanel.test.jsx (2 tests) 87ms

 Test Files  3 passed (3)
      Tests  10 passed (10)
   Start at  21:32:11
   Duration  24.20s
```
