# 01 — Schema & API Reference

## Prisma Models

### `UserProfile`
Singleton user record (seed one row on first run).

```prisma
model UserProfile {
  id                 Int     @id @default(autoincrement())
  weightKg           Float   @default(0)
  heightCm           Float   @default(0)
  dailyCalorieTarget Int?
  dailyProteinTarget Int?
  tsomMode           Boolean @default(false)
}
```

### `FoodItem`
Master library of parsed foods. Created once, reused forever.

```prisma
model FoodItem {
  id           Int            @id @default(autoincrement())
  name         String         @unique
  servingUnit  String         // e.g. "g", "ml", "piece", "injera"
  calories     Float
  proteinG     Float
  carbsG       Float
  fatG         Float
  isFasting    Boolean        @default(false)  // true = safe during Tsom
  dailyFoodLogs DailyFoodLog[]
}
```

### `DailyFoodLog`
One row per food item logged per meal slot per day.

```prisma
model DailyFoodLog {
  id          Int      @id @default(autoincrement())
  date        String   // YYYY-MM-DD
  foodItemId  Int
  foodItem    FoodItem @relation(fields: [foodItemId], references: [id])
  quantity    Float    @default(1)
  mealSlot    String   // "breakfast" | "lunch" | "dinner" | "snack"
}
```

### `WorkoutLog`
Parsed from fitness screenshots via Gemini Vision.

```prisma
model WorkoutLog {
  id              Int                  @id @default(autoincrement())
  date            String               // YYYY-MM-DD
  workoutType     String               // e.g. "Outdoor Run", "Strength Training", "Soccer", "Tennis", "Swimming"
  activeCalories  Int
  totalCalories   Int
  durationMinutes Int
  avgHeartRate    Int?
  totalVolumeKg   Int?
  muscleGroups    String?              // e.g. "Chest, Triceps"
  rawSummary      String               // raw Gemini JSON response for auditing
  sets            WorkoutExerciseSet[]
}
```

### `Exercise`
Master catalog seeded from an open-source exercise database.

```prisma
model Exercise {
  id               Int                  @id @default(autoincrement())
  name             String               @unique
  targetMuscle     String               // "chest" | "lats" | "quads" | "hamstrings" | "shoulders" | "biceps" | "triceps" | "glutes" | "calves" | "core"
  secondaryMuscles String?              // comma-separated
  category         String               // "strength" | "bodyweight" | "cardio"
  equipment        String?              // "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight"
  workoutSets      WorkoutExerciseSet[]
}
```

### `WorkoutExerciseSet`
Logged resistance training sets connected to exercises and workout logs.

```prisma
model WorkoutExerciseSet {
  id           Int        @id @default(autoincrement())
  workoutLogId Int
  workoutLog   WorkoutLog @relation(fields: [workoutLogId], references: [id], onDelete: Cascade)
  exerciseId   Int
  exercise     Exercise   @relation(fields: [exerciseId], references: [id])
  sets         Int        @default(1)
  reps         Int?
  weightKg     Float?
}
```

---

## Strength & Recovery: Formulas & Mappings

### 1. Deterministic Time-Decay Recovery Formula
Muscle recovery percentage is computed **purely deterministically** with no AI involvement:

$$\text{Recovery \%} = \min\left(100, \max\left(0, 100 - (\text{FatigueLoad} \times e^{-\frac{\Delta t}{\tau}})\right)\right)$$

- **$\Delta t$**: Elapsed hours since the workout or sport session.
- **$\tau$ (tau)**: Recovery half-life constant (e.g., 24 hours; full recovery at ~48–72 hours depending on volume).
- **FatigueLoad**: Calculated per muscle group from:
  - Strength sets: $\sum (\text{sets} \times \text{intensityWeight})$
  - Multi-sport mapped sets.

### 2. Multi-Sport Fatigue Mapping
Converts field/endurance sport durations into equivalent muscle set fatigue points:

| Sport | Duration | Primary Muscle Impacts | Equivalent Set Fatigue |
|---|---|---|---|
| **Soccer** | 45 min | Quads, Hamstrings, Calves, Core | 3 sets Quads, 3 sets Hamstrings, 3 sets Calves, 2 sets Core |
| **Soccer** | 90 min | Quads, Hamstrings, Calves, Core | 6 sets Quads, 5 sets Hamstrings, 5 sets Calves, 4 sets Core |
| **Tennis** | 60 min | Shoulders, Core, Forearms/Triceps, Quads | 4 sets Shoulders, 3 sets Core, 3 sets Triceps, 3 sets Quads |
| **Swimming** | 45 min | Lats/Back, Shoulders, Chest, Core | 4 sets Lats, 4 sets Shoulders, 2 sets Chest, 3 sets Core |

### 3. Visual Muscle Diagram (`react-body-highlighter`)
The front and back human anatomy map uses the free `react-body-highlighter` npm package for Next.js. The package slices the body into muscle SVG elements and accepts an array of muscle data:
```tsx
import Model from "react-body-highlighter";

<Model
  data={[
    { name: "chest", intensity: 100 },
    { name: "quadriceps", intensity: 38 },
  ]}
  style={{ width: "100%", maxWidth: "320px" }}
/>
```

#### Color & Intensity Scale:
- **80% – 100% (Green / Fresh)**: Fully recovered / Ready for heavy training (`intensity: 80-100`).
- **50% – 79% (Yellow / Recovering)**: Recovering / Moderate fatigue (`intensity: 50-79`).
- **0% – 49% (Red / Fatigued)**: Fatigued / Needs rest or light mobility only (`intensity: 0-49`).

---

## API Routes

### `POST /api/workouts/parse-screenshot`
Accepts a multipart `FormData` with a `file` field (image).  
Sends the image to Gemini Vision, extracts workout fields, and writes a `WorkoutLog` row.

**Request:** `multipart/form-data` — `file: File`  
**Response:** `{ workoutLog: WorkoutLog }`

---

### `POST /api/foods/parse`
First-time natural-language food entry. Calls Gemini to extract macros.  
Upserts a `FoodItem`, then writes a `DailyFoodLog`.

**Request:**
```json
{ "description": "200g shiro wot", "mealSlot": "lunch", "date": "2024-01-15" }
```
**Response:** `{ foodItem: FoodItem, logEntry: DailyFoodLog }`

---

### `POST /api/foods/log-saved`
Repeat-log path — no AI call. Looks up existing `FoodItem` by ID and writes `DailyFoodLog`.

**Request:**
```json
{ "foodItemId": 3, "quantity": 1.5, "mealSlot": "dinner", "date": "2024-01-15" }
```
**Response:** `{ logEntry: DailyFoodLog }`

---

### `POST /api/recommend`
Returns next-meal suggestions based on remaining daily targets and Tsom Mode.  
Factors in active calories burned from `WorkoutLog` on the same date.

**Request:**
```json
{ "date": "2024-01-15", "mealSlot": "dinner" }
```
**Response:** `{ recommendations: FoodItem[], reasoning: string }`

---

### `GET /api/exercises`
Searches the exercise catalog by keyword, muscle group, or equipment.

**Query Parameters:**
- `search` (string, optional): search term (e.g. "cable row", "squat")
- `muscle` (string, optional): target muscle filter (e.g. "chest", "lats", "quads")
- `equipment` (string, optional): equipment filter (e.g. "cable", "barbell", "dumbbell")

**Response:**
```json
{
  "exercises": [
    {
      "id": 14,
      "name": "Seated Cable Row",
      "targetMuscle": "lats",
      "secondaryMuscles": "biceps, middle back",
      "category": "strength",
      "equipment": "cable"
    }
  ]
}
```

---

### `GET /api/recovery`
Returns the current deterministic recovery percentage (0% to 100%) and fatigue state for each muscle group based on logged sets and multi-sport duration.

**Query Parameters:**
- `date` (string, optional): reference date (defaults to today)

**Response:**
```json
{
  "lastCalculated": "2026-11-26T21:00:00Z",
  "muscles": {
    "chest": { "recoveryPct": 92, "status": "fresh", "lastTrainedHoursAgo": 54 },
    "lats": { "recoveryPct": 45, "status": "fatigued", "lastTrainedHoursAgo": 14 },
    "shoulders": { "recoveryPct": 78, "status": "recovering", "lastTrainedHoursAgo": 28 },
    "quads": { "recoveryPct": 38, "status": "fatigued", "lastTrainedHoursAgo": 6 },
    "hamstrings": { "recoveryPct": 42, "status": "fatigued", "lastTrainedHoursAgo": 6 },
    "glutes": { "recoveryPct": 85, "status": "fresh", "lastTrainedHoursAgo": 72 },
    "biceps": { "recoveryPct": 55, "status": "recovering", "lastTrainedHoursAgo": 14 },
    "triceps": { "recoveryPct": 88, "status": "fresh", "lastTrainedHoursAgo": 48 },
    "calves": { "recoveryPct": 40, "status": "fatigued", "lastTrainedHoursAgo": 6 },
    "core": { "recoveryPct": 65, "status": "recovering", "lastTrainedHoursAgo": 6 }
  }
}
```

---

### `POST /api/recovery/grade`
AI session grader that takes today's completed sets/sports, current recovery levels, and training goals, grades the session, and recommends tomorrow's workout.

**Request:**
```json
{
  "date": "2026-11-26"
}
```

**Response:**
```json
{
  "sessionGrade": "A-",
  "analysis": "High training quality. Your 90-minute soccer session created heavy leg and calf fatigue, while your upper push muscles (chest, triceps, shoulders) are at 85%+ recovery.",
  "recommendedTomorrow": {
    "focus": "Upper Body Push & Core",
    "targetMuscles": ["chest", "triceps", "shoulders"],
    "avoidMuscles": ["quads", "hamstrings", "calves"],
    "suggestedExercises": ["Barbell Incline Bench Press", "Dumbbell Overhead Press", "Cable Tricep Pushdown"]
  }
}
```
