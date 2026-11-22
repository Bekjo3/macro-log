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
Parsed from Apple Fitness screenshots via Gemini Vision.

```prisma
model WorkoutLog {
  id              Int    @id @default(autoincrement())
  date            String // YYYY-MM-DD
  workoutType     String // e.g. "Outdoor Run", "Strength Training"
  activeCalories  Int
  totalCalories   Int
  durationMinutes Int
  avgHeartRate    Int?
  rawSummary      String // raw Gemini JSON response for auditing
}
```

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
