# AGENTS.md — Macro Log

## Stack
| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite via Prisma ORM |
| AI | Google Gemini API (`gemini-2.5-flash`) via `@google/genai` |

## Security
- **Never hardcode API keys.** All secrets are read from environment variables.
- `GEMINI_API_KEY` must be set in `.env.local` (never committed).
- `.env.local` and `dev.db` must be listed in `.gitignore`.

## Constraints

### Constraint 1 — Workouts: Screenshot-Only Entry
- Workout data is **100% screenshot-driven** from fitness app summary screens.
- **Never build manual workout entry forms.** The only intake path is Gemini Vision parsing a screenshot.
- Route: `POST /api/workouts/parse-screenshot`

### Constraint 2 — Foods: Log Once, Reuse Forever
- When a food is first described in natural language, Gemini parses it once and saves it to `FoodItem`.
- Subsequent logs of the **same food** look up the existing `FoodItem` and increment quantity — **zero additional API calls**.
- Route for first parse: `POST /api/foods/parse`
- Route for repeat logs: `POST /api/foods/log-saved`

### Constraint 3 — Tsom Mode (Orthodox Fasting)
- A global boolean toggle (`tsomMode` on `UserProfile`) enables Tsom/Orthodox fasting mode.
- When active, all recommendations and the food library are filtered to `FoodItem.isFasting = true`.
- UI must clearly indicate when Tsom Mode is active (e.g. a banner or icon).

### Feature: Strength & Recovery
- **Searchable Exercise Catalog**: Seeded from a free open-source database (e.g. ExerciseDB / open-source fitness dataset). Searchable by name, target muscle, and equipment.
- **Deterministic Muscle Recovery**: Recovery percentages use a strict mathematical time-decay formula based on logged sets and elapsed hours. **Never use AI for recovery math.**
- **Visual Muscle Map**: Interactive front/back body diagram color-coded by recovery percentage (green = ready, yellow = recovering, red = fatigued) using `react-body-highlighter`.
- **Multi-Sport Fatigue Mapping**: Deterministically maps sports (soccer, tennis, swimming) duration to muscle fatigue points (e.g. soccer to quads/hamstrings/calves, tennis to shoulders/core/quads, swimming to lats/shoulders).
- **AI Session Grader**: Evaluates completed sets against recovered muscle groups and recommends the next day's workout targeting fresh muscles.
- Routes:
  - `GET /api/exercises`
  - `GET /api/recovery`
  - `POST /api/recovery/grade`

## Development Workflow
1. Work slice by slice as defined in `docs/02-mvp-slices.md`.
2. After completing each slice, update `docs/PROGRESS.md` with the slice number, date, and what was done.
3. Keep commits small and scoped to one slice at a time.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
