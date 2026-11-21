# QA Final Report — IoT102 Exam Lab 2.0

Branch `redesign/exam-lab-2`, checkpoint before redesign: `d9b9326`. Date: 2026-11-21. Environment: Fedora, Node 24.22, Vite 6.4, headless Chromium 1248 driven by `@playwright/cli` 0.1.25.

## Results

| Check | Baseline (d9b9326) | Now |
|---|---|---|
| `tsc -p tsconfig.app.json --noEmit` | pass | pass |
| `npm test` (vitest) | 8/8 | **70/70** (6 files) |
| `npm run build` | pass, JS 447.7 kB (96.7 kB gz) | pass, JS 484.8 kB (108.1 kB gz), CSS 30 kB, fonts 82 kB |
| Impeccable detector on `src/` | 2 findings | 0 findings |
| Horizontal overflow, 7 views × 375/768/1024/1440 | — | 0 / 28 |
| Browser console errors | 1 (favicon 404) | 0 |

Build warning `"use client" … was ignored` from lucide-react exists at baseline too; harmless.

## Automated tests added

- `tests/practice.test.ts` — retry gap always 2–5; no duplicate queue entries; cleared on correct; dropped after 3 misses so sessions terminate; every question seen exactly once fresh; no immediate repeat; retries excluded from first-try accuracy; streak increment/reset/best; fire level per 5; retry answers don't add attempts.
- `tests/storage.test.ts` — progress save/load round-trip (reload), corrupt storage fallback, import validation and clamping, export→import identity, bank overrides limited to editable fields, unknown ids dropped, exam autosave round-trip.
- `tests/exam-ui.test.tsx` — server-renders `QuestionView` in exam mode for 25 questions (with `revealed` both false and true): no correct/wrong markers, no "the answer is", no Speaker Notes, no explanation text. 50 unique eligible questions across 25 seeds. Unanswered scored as wrong.
- `tests/source-safety.test.ts` — `public/` and `dist/` contain no `credentials.json` / `token.json` / `.env`; both are git-ignored and untracked; the six source data files match their SHA-256 at the checkpoint.

## Real-browser QA (Playwright CLI, scripts in session scratchpad)

| Scenario | Result |
|---|---|
| Dashboard renders, empty state | pass — `docs/screenshots/after-dashboard-1440.png` |
| Practice: keyboard answer (wrong) shows red "Your answer", green "Answer", explanation panel | pass — `after-practice-answered-1440.png` |
| 16 answers `cccccccwcccccccc` | streak 1→7, "Lv 1" at 5, reset to 0 on the miss, missed question returned after 5 other questions labelled "second chance", answered correctly → streak continued |
| Refresh mid-session | same question, "16 of 329", streak 8 — preserved |
| Code question at 375px | code scrolls inside its box, page width 375 — `after-practice-code-375.png` |
| Topic filter (Topics → Networking → Practice) | title "Networking & Protocols", question tagged Networking |
| Exam: start, 6 keyboard answers, flag with F | pass; 0 answer markers or "the answer is" text in DOM before submit |
| Exam refresh | resumes on Q7, "6 answered", flag kept |
| Submit dialog: Keep working / Submit now | both work — `after-exam-submit-dialog-1440.png` |
| Results | score 0.4/10 (2 correct), history +1, autosave cleared — `after-exam-results-1440.png` |
| Bank: record dialog read-only until unlocked | fieldset disabled, textarea not focusable; edit saved as `{question}` override only; Revert → `{}` |
| Reduced motion (`emulateMedia`) | animation duration 0.00001s |
| Keyboard focus | visible 2px teal outline on tab stops |

Not exercised in the browser: time-expired auto-submit (covered by code path: restored exam past deadline → `remaining === 0` → submit; not waited out in real time), file-picker import (covered by unit tests of `parseProgress`/`sanitizeOverrides`, not clicked through), screen-reader output (ARIA added, not verified with NVDA/Orca). Impeccable's URL scan exited 0 with no output; with no Chrome installed it is unclear it rendered, so treat it as not run.

## Tools — what was actually used

| Tool | Status |
|---|---|
| UI UX Pro Max | Cloned, script read (stdlib only, no network), run read-only from the clone. Not installed as a plugin. |
| Impeccable | Launcher read; it downloads a checksum-verified engine to `~/.impeccable`. Used `detect` and `font-fetch` (self-hosted fonts). `npx impeccable install` **not** run — it adds hooks to agent settings. |
| Playwright CLI | `@playwright/cli@0.1.25` installed in the session scratchpad (not `-g`), pointed at the already-cached Chromium 1248 via a scratchpad config. |
| Ponytail | `AGENTS.md` principles applied (reuse, no new deps, tests for logic). Plugin not installed. |
| i-have-adhd | Read as UX guidance (one next action, visible progress, low noise). Not installed. |
| Graphify, last30days, OmniRoute | Not installed — no project need. |

No new npm dependencies were added to the project.

## Security / data notes — action needed

- ⚠️ **The GitHub remote `nhattam3101/iot-pass` is PUBLIC** and already contains `iot102_slides/*.png` (365 slides) and `data/questions.json`/`speaker_notes.json` from earlier commits. This redesign did not push anything and did not rewrite history. If the slides/question bank are private, make the repo private (and consider history if it was ever cloned).
- `dist/` includes all 365 slide PNGs (via the `public/slides` symlink) because the app needs them. Do not deploy `dist/` publicly unless that is authorized.
- `credentials.json` and `token.json` exist locally, are git-ignored, untracked, and absent from `public/` and `dist/`.

## Known limitations

- Vietnamese characters outside latin-ext fall back to the system font.
- 15 question texts contain OCR watermark noise ("Hoang Hoang") — source data, left unchanged (see UI_UX_AUDIT.md).
- Bank import replaces all local edits (as before); it no longer accepts non-editable fields.
