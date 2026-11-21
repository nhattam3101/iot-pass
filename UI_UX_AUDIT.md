# UI/UX Audit — before → after

Method: ⚠️ single-context review (Impeccable's critique protocol asks for two isolated sub-agents; not spawned, to keep the session on implementation). Evidence: Impeccable detector on `src/`, screenshots via Playwright CLI at 1440 and 375, and code reading. Screenshots: `docs/screenshots/before-*.png` and `after-*.png`.

## Baseline findings (commit d9b9326)

| # | Area | Problem | Severity |
|---|---|---|---|
| 1 | Practice (mobile) | Page title, description, topic select and the range panel pushed the question below the first 375×812 viewport (question started at ~y=700). | High |
| 2 | Practice | No keyboard answering, no focus management between questions. | High |
| 3 | Practice | Retry queue, streak and position lived in component state — lost on refresh or when switching pages. Questions wrapped around forever (`% pool.length`); no end-of-set. | High |
| 4 | Practice | Retry answers incremented `attempts` again, so revisiting a miss in the same session counted as a new attempt. | Medium |
| 5 | Exam | In-progress exam lost on refresh (no autosave); "Submit exam" had no confirmation; time-expired submit only ran while the tab stayed open. | High |
| 6 | Exam | Question map relied on color only; no legend, no accessible names for state. | Medium |
| 7 | Exam results | Flat list only; no per-topic breakdown, no filter for wrong/blank/flagged. | Medium |
| 8 | Visual system | Inter (flagged `overused-font`), decorative grid texture (`codex-grid-background`), uppercase eyebrow labels above every heading, gradient brand tile, 5 identical metric cards, cards inside cards. Random accent mix (emerald, cyan, rose, amber, violet). | Medium |
| 9 | Dashboard | Five equal-weight metrics, no recommendation of what to do next, no recent activity, topic bars showed "studied" only (not correct vs wrong). | Medium |
| 10 | Review | Two lists side by side truncated to 30 items, no way to see your answer vs source answer, no progress indicator. | Medium |
| 11 | Question bank | Edit form open immediately on click (easy accidental edits), no way to revert a local edit, no OCR confidence, imports could override any field (incl. `imagePath`, `slideNumber`). | Medium |
| 12 | Data import | Progress import accepted any JSON with `version: 1`; malformed records could break rendering. | Medium |
| 13 | Misc | Mixed Vietnamese/English copy in one banner; `favicon.ico` 404; no skip link; no `aria-pressed`/labels on icon controls. | Low |

## What changed

| # | Fix |
|---|---|
| 1 | Practice header reduced to title + count + a "Filters" toggle; filters (topic, bookmarked only, range) collapse into one panel. Question now starts at ~y=270 on 375px. |
| 2 | `A–D`/`1–4`, `Enter`/`→`, `S`, `B`/`*`; focus moves to the new question heading and scrolls it into view only if needed. |
| 3 | Pure session model in `src/lib/practice.ts` (`createSession`/`recordAnswer`/`advance`) persisted to LocalStorage per filter+range. Misses return after 2–5 other questions, never duplicated, dropped after 3 misses in a session (kept in Review), set ends with a summary + "drill the ones you missed". |
| 4 | `applyAnswer(..., isRetry)` updates the latest result but does not add an attempt for an in-session retry. First-try accuracy excludes retries. |
| 5 | Exam autosaves to `iot102-active-exam-v1` on every change; restoring after the deadline auto-submits immediately. Native `<dialog>` confirmation shows answered/unanswered/flagged/time left. |
| 6 | Map buttons have names like "Question 7, not answered, flagged", `aria-current`, plus a legend; flags use a dot, not only color. |
| 7 | Results: score, correct / wrong / unanswered / time; per-topic table with mastery bars (weakest first); filter tabs Wrong / Blank / Flagged / All; each item expands into the full question with answer marking and explanation; "Practice the N missed". Past attempts can be reopened from the exam page. |
| 8 | New token system (see DESIGN_SYSTEM.md): one teal accent, semantic ok/bad/warn/fire only for meaning, self-hosted Atkinson Hyperlegible, plain canvas, no eyebrows, panels never nested. Detector: 2 findings → 0. |
| 9 | Dashboard leads with one "Up next" recommendation (resume exam → resume practice → fix misses → weakest topic → uncovered topic → take an exam), then 4 stats in one strip, topic mastery (correct/need-work/unseen), exam score trend (only when ≥2 attempts), recent answers. |
| 10 | Review: "recovered x of y past misses" progress, Missed/Bookmarked tabs, topic filter, expandable items with your answer vs source, one-click "Practice N". |
| 11 | Record dialog is read-only until "Edit locally"; side-by-side slide + Speaker Notes; warns when the answer differs from source; "Revert to source"; OCR confidence badges and filters (low OCR, edited, duplicates, bookmarked). Overrides are sanitized to the 4 editable fields and only stored when they differ from source. |
| 12 | `parseProgress` validates and clamps imported progress; import/export results shown inline (no `alert`). |
| 13 | English copy throughout; inline SVG favicon; skip link; labels on all icon buttons. |

## Not changed (deliberately)

- Question/answer data, topics, OCR output, slide mapping — byte-identical to the checkpoint (enforced by `tests/source-safety.test.ts`).
- LocalStorage keys/shape of `iot102-progress-v1` (exports from the old version still import).
- No light theme (brief: dark-first). No sound or haptics.

## Data issues observed (not fixed — source data)

- 15 questions contain "Hoang Hoang" (OCR picked up the slide watermark "Hoàng Hoàng Buôn Source"): slides 29, 96, 111, 161, 167, 175, 191, 229, 238, 248, 258, 280, 296, 314, 329. Fix belongs in `scripts/build_question_bank.py` / `manual_overrides.json`, then rebuild.
