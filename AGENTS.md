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

## Development Workflow
1. Work slice by slice as defined in `docs/02-mvp-slices.md`.
2. After completing each slice, update `docs/PROGRESS.md` with the slice number, date, and what was done.
3. Keep commits small and scoped to one slice at a time.
