# IoT102 Exam Lab — Design System

Dark-first, quiet, built for reading questions for long stretches. One accent (teal) for "you can act here"; green/red only for answer correctness; orange only for the streak. Source of truth: `src/styles.css` (tokens) + `tailwind.config.js` (Tailwind names) + `src/components/ui.tsx` (primitives).

## How it was derived

- **UI UX Pro Max** (`search.py --design-system "edtech exam practice quiz dark mode"`) proposed purple + claymorphism + rounded "friendly" fonts. Rejected: it contradicts the brief (no purple AI gradients) and suits children's apps. Narrower domain queries were used instead: `--domain color "developer tool dark technical teal"` → slate neutrals + green run-accent (adopted, shifted to teal); `--domain typography` → mono + sans pairing for technical content (adopted: one sans for UI, one mono only for code/timer); `--domain ux` → reduced-motion, loading/confirmation feedback rules.
- **Impeccable** detector flagged the old UI for `overused-font` (Inter) and `codex-grid-background` (decorative grid texture). Its craft floor bans eyebrow labels over headings, nested cards and decorative glass — all present before, all removed.

## Color tokens (`:root`, RGB channels)

| Token | Hex | Use | Contrast on `surface` |
|---|---|---|---|
| `canvas` | #0A0D12 | page background | — |
| `surface` | #10141B | panels, cards | — |
| `raised` | #161C25 | option cards, hover rows | — |
| `overlay` | #1E2530 | tracks, neutral badges | — |
| `line` / `line-strong` | #262E3A / #36404F | borders, dividers | — |
| `ink` | #E9EDF2 | primary text | 15.7:1 |
| `ink-2` | #B0BAC6 | secondary text | 9.4:1 |
| `ink-3` | #8A95A3 | tertiary/meta text | 6.1:1 (≥5.1 on `overlay`) |
| `accent` | #2DD4BF | interactive: primary buttons, selection, focus ring, current item | 9.9:1 |
| `accent-ink` | #04201C | text on accent | 9.2:1 on accent |
| `ok` | #34D399 | correct answer only | 9.6:1 |
| `bad` | #FB7185 | wrong answer / destructive only | 6.9:1 |
| `warn` | #FBBF24 | retry notice, flags, review states | 11.1:1 |
| `fire` | #FB923C | streak only | 8.2:1 |

Rule: color never carries meaning alone. Correct/wrong options also get an icon and a text label ("Answer", "Your answer"); mastery bars have an `aria-label` with the numbers.

## Typography

- **Atkinson Hyperlegible Next** (UI + questions) and **Atkinson Hyperlegible Mono** (code, timer), self-hosted variable WOFF2 in `src/assets/fonts` (~82 KB, latin + latin-ext; no runtime font requests). Chosen for legibility: distinct `0/O`, `1/l/I` matter for answers like `115200`, `0x0191`, `pin2`. The slashed zero is intentional.
- Vietnamese glyphs outside latin-ext (e.g. "ạ") fall back to the system font.
- Scale (px): 12 meta · 13 labels · 14–15 body-small/UI · 16 body · 17 section titles · **19 / 21 question text** (mobile / ≥640px, weight 600, line-height 1.6–1.65) · 22–26 page titles · 32 h1 desktop · 52 exam score.
- Tracking −0.01 to −0.03em on headings only. Body measure capped at ~68–70ch.
- `tabular-nums` only on numbers that change in place (timer, counts in tables) — not globally.

## Spacing, radii, shadow

- 4px base. Panel padding 16 (mobile) / 20–28 (desktop). Gap between stacked panels 16–24, between sections 32–40.
- Radii: `control` 10px (buttons, inputs), `card` 14px (panels, options), 7–8px small tiles.
- Shadows: `raised` = 1px inner highlight + soft offset blur (panels); `pop` = large soft shadow (dialogs). No colored glows.

## Components (`src/components`)

| Primitive | Notes |
|---|---|
| `Button` | `primary` (accent fill, one per view), `secondary` (bordered), `ghost`, `danger`; sizes `sm` 36px, `md` 44px, `lg` 48px; optional `kbd` hint. |
| `IconButton` | 44×44, required `label` → `aria-label` + tooltip. |
| `Badge` | neutral / accent / ok / bad / warn / fire. |
| `Panel` | the only card container; never nested. Lists inside use dividers, not cards. |
| `PageHeader` | h1 + description. No eyebrow labels. |
| `ProgressBar`, `MasteryBar` | 6–8px tracks; MasteryBar = correct / need work / unseen. |
| `Segmented`, `Select`, `.field` | all ≥44px tall, visible labels (or `sr-only` labels where context is visual). |
| `QuestionView` | question + code + slide + options + feedback. `mode="exam"` can never render correctness. |
| `StreakMeter` | flame + "n in a row" + 5 pips to next level. |

## Feedback states (option cards, `data-state`)

`idle` → hover (border brightens) → `selected` (accent border, filled key) → practice only: `correct` (green border + tint + check + label), `wrong` (red + cross + "Your answer"), `dimmed` (other options at 60%). Feedback panel below options: verdict sentence, explanation (or an honest "no explanation in the deck"), slide toggle, source note.

## Motion

- One purpose: show that something changed. Durations 150ms (hover/press), 200–220ms (question enter, feedback), 600ms once (streak level flare). Easing `cubic-bezier(.16,1,.3,1)` (exponential out).
- No looping animation, no confetti, no sound, no flashing.
- `prefers-reduced-motion: reduce` collapses all animations/transitions to ~0.

## Responsive

- < 1024px: top bar + menu drawer; ≥ 1024px: fixed 240px sidebar.
- Practice column max 860px; exam 1180px with a 260px question map on ≥1024px, collapsible map below the question on smaller screens; the exam bar (timer, submit) is sticky.
- Verified with no horizontal overflow at 375 / 768 / 1024 / 1440 on all 7 views. Code blocks scroll inside their own box.

## Accessibility requirements

- WCAG AA contrast for every text token (table above).
- Visible 2px accent focus ring on all interactive elements; programmatic focus targets (`tabindex=-1` headings) show none.
- Skip link, landmark `nav`/`main`, `aria-current` on nav and exam map, `aria-pressed` on options/bookmark/flag, `role=timer`, polite live regions for feedback and streak level, assertive at 5 min / 1 min left.
- Keyboard: practice `A–D`/`1–4` answer, `Enter`/`→` next, `S` slide, `B`/`*` bookmark; exam `A–D`/`1–4`, `←`/`→`, `F` flag; native `<dialog>` for submit/record dialogs (focus trap + Esc).
- Hit targets ≥44px for primary controls; none under 24px.
