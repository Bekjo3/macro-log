# MacroLog — System Design

## 1. System Overview & Core Constraints

MacroLog is an AI-powered fitness and nutrition platform built to eliminate manual tracking fatigue through two strict intake paradigms:

| Constraint | Principle | Implementation Rule |
|---|---|---|
| **Constraint 1: Workouts** | **100% Screenshot-Driven** | Never build manual workout forms. The only intake path is Gemini 2.5 Flash Vision extracting metrics from fitness app screenshots (single or multi-screenshot scrolled summaries). |
| **Constraint 2: Foods** | **Log Once, Reuse Forever** | First-time meals described in natural language are evaluated once by Gemini, titled, and saved to `FoodItem`. Repeat logs increment quantity against existing records with **zero LLM API calls**. |
| **Constraint 3: Tsom Mode** | **Orthodox Fasting Guard** | A global boolean toggle (`UserProfile.tsomMode`). When enabled, food library lists and AI meal recommendations strictly filter to `isFasting = true` (vegan/fasting-compliant). |

---

## 2. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Next.js App Router / Mobile iOS Viewport)"]
        Dashboard["Dashboard Page (/)<br/>Macro Rings &amp; Burn Balance"]
        WorkoutsUI["Workouts Page (/workouts)<br/>Screenshot Drop &amp; Card History"]
        FoodsUI["Foods Page (/foods)<br/>Natural Language &amp; Library Grid"]
        Nav["Global Header / Tsom Mode Toggle"]
    end

    subgraph Server ["Server Layer (Next.js Route Handlers)"]
        WorkoutsAPI["/api/workouts<br/>GET / POST / DELETE"]
        ParseWorkoutAPI["/api/workouts/parse-screenshot<br/>POST (Multipart)"]
        FoodsParseAPI["/api/foods/parse<br/>POST (NL Parse)"]
        FoodsLogAPI["/api/foods/log-saved<br/>POST (Zero-AI Log)"]
        RecommendAPI["/api/recommend<br/>POST (Adaptive Recommender)"]
        ProfileAPI["/api/profile<br/>GET / PATCH (Tsom Mode)"]
    end

    subgraph AI ["AI Services (Google Gen AI SDK)"]
        GeminiVision["Gemini 2.5 Flash Vision<br/>Multimodal Structured Output"]
        GeminiText["Gemini 2.5 Flash<br/>JSON Schema Macro Extraction"]
    end

    subgraph Storage ["Data Layer (Prisma ORM + SQLite)"]
        SQLite[("SQLite DB (dev.db)<br/>libsql driver adapter")]
        M_User["UserProfile"]
        M_Workout["WorkoutLog"]
        M_Food["FoodItem"]
        M_Log["DailyFoodLog"]
    end

    Dashboard --> ProfileAPI & WorkoutsAPI & RecommendAPI
    WorkoutsUI --> ParseWorkoutAPI & WorkoutsAPI
    FoodsUI --> FoodsParseAPI & FoodsLogAPI & ProfileAPI

    ParseWorkoutAPI --> GeminiVision
    FoodsParseAPI --> GeminiText
    RecommendAPI --> GeminiText

    WorkoutsAPI --> M_Workout
    ParseWorkoutAPI --> M_Workout
    FoodsParseAPI --> M_Food & M_Log
    FoodsLogAPI --> M_Log
    RecommendAPI --> M_Log & M_Workout & M_Food
    ProfileAPI --> M_User

    M_User & M_Workout & M_Food & M_Log --- SQLite
```

---

## 3. Data Model & Entity Relationships

The database is powered by SQLite via Prisma ORM 7 using the `@prisma/adapter-libsql` driver adapter.

```mermaid
erDiagram
    UserProfile {
        int id PK
        float weightKg
        float heightCm
        int dailyCalorieTarget
        int dailyProteinTarget
        boolean tsomMode
    }

    WorkoutLog {
        int id PK
        string date "YYYY-MM-DD"
        string workoutType
        int activeCalories
        int totalCalories
        int durationMinutes
        int avgHeartRate
        string rawSummary
    }

    FoodItem {
        int id PK
        string name UK
        string servingUnit
        float calories
        float proteinG
        float carbsG
        float fatG
        boolean isFasting
    }

    DailyFoodLog {
        int id PK
        string date "YYYY-MM-DD"
        int foodItemId FK
        float quantity
        string mealSlot "breakfast | lunch | dinner | snack"
    }

    FoodItem ||--o{ DailyFoodLog : "referenced by"
```

### Model Definitions
- **`UserProfile`**: Singleton user configuration (`id: 1`). Holds target macros, height/weight defaults (`0`), and global `tsomMode` flag.
- **`WorkoutLog`**: Historical workout activities parsed strictly from screenshots. Tracks `activeCalories` (used to offset daily calorie burn).
- **`FoodItem`**: Master library of food items. Populated dynamically as user logs foods.
- **`DailyFoodLog`**: Relational join between date, meal slot (`breakfast`, `lunch`, `dinner`, `snack`), and `FoodItem` with quantity multiplier.

---

## 4. End-to-End Sequence Diagrams

### Flow 1: Workout Screenshot Intake (Multi-Image Support)
Handles 1 to 5 screenshots of a workout summary (e.g., scrolled Apple Fitness screens where top shows calories/time and bottom shows heart rate and splits).

```mermaid
sequenceDiagram
    autonumber
    actor User as User (iPhone / Desktop)
    participant WorkoutsUI as /workouts Page
    participant API as POST /api/workouts/parse-screenshot
    participant Gemini as Gemini 2.5 Flash Vision
    participant DB as SQLite (WorkoutLog)

    User->>WorkoutsUI: Drops / pastes 1-3 screenshots
    WorkoutsUI->>WorkoutsUI: Displays thumbnail preview strip (#1, #2, #3)
    User->>WorkoutsUI: Clicks "Extract workout data"
    WorkoutsUI->>API: Multipart FormData [files: Blob[], save: false]
    API->>API: Convert all buffers to Base64 inlineData parts
    API->>Gemini: generateContent(contents: [image1, image2, prompt], responseSchema)
    Note over Gemini: Synthesizes metrics across all screenshots<br/>into single unified workout payload
    Gemini-->>API: JSON { workoutType, activeCalories, totalCalories, durationMinutes, avgHeartRate, date }
    API-->>WorkoutsUI: Return { parsed: workoutObject }
    WorkoutsUI->>WorkoutsUI: Renders "Extracted metrics" review card
    User->>WorkoutsUI: Clicks "Save workout"
    WorkoutsUI->>API: POST /api/workouts { ...parsedData }
    API->>DB: prisma.workoutLog.create()
    DB-->>API: workoutLog created
    API-->>WorkoutsUI: 201 Created
    WorkoutsUI->>WorkoutsUI: Resets upload zone & updates History list / table
```

---

### Flow 2: First-Time Food Logging (Single Natural-Language Parse)
Fulfills **Constraint 2**: natural-language intake evaluated once by Gemini and added to library.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant FoodsUI as /foods Page
    participant API as POST /api/foods/parse
    participant Gemini as Gemini 2.5 Flash (Text)
    participant DB as SQLite (FoodItem & DailyFoodLog)

    User->>FoodsUI: Inputs "Rice with chicken and roasted potatoes, about 1 plate"
    User->>FoodsUI: Selects mealSlot: "lunch", date: "today"
    FoodsUI->>API: POST /api/foods/parse { description, mealSlot, date }
    API->>Gemini: Prompt + JSON Schema (evaluates macros, title, isFasting)
    Gemini-->>API: JSON { name: "Chicken, Rice & Potatoes", calories: 650, proteinG: 45, carbsG: 70, fatG: 18, isFasting: false }
    API->>DB: prisma.foodItem.upsert(name)
    API->>DB: prisma.dailyFoodLog.create(foodItemId, quantity: 1, mealSlot)
    DB-->>API: Saved records
    API-->>FoodsUI: Return { foodItem, dailyLog }
    FoodsUI->>FoodsUI: Appends to Library Grid + updates today's food log
```

---

### Flow 3: Repeat Food Log (Zero LLM Tokens)
Fulfills **Constraint 2**: re-logging an existing library item uses zero AI tokens.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant FoodsUI as /foods Page
    participant API as POST /api/foods/log-saved
    participant DB as SQLite (DailyFoodLog)

    User->>FoodsUI: Searches library for "Chicken, Rice & Potatoes"
    User->>FoodsUI: Clicks "+ Quick Log" (adjusts quantity: 1.5, slot: "dinner")
    FoodsUI->>API: POST /api/foods/log-saved { foodItemId: 4, quantity: 1.5, mealSlot: "dinner", date }
    Note over API: ZERO LLM API CALLS MADE
    API->>DB: prisma.dailyFoodLog.create({ foodItemId: 4, quantity: 1.5, ... })
    DB-->>API: Created log entry
    API-->>FoodsUI: Return { logEntry }
    FoodsUI->>FoodsUI: Updates daily macro counter instantly
```

---

### Flow 4: Dashboard & Adaptive Recommender (Offsetting Active Calories)

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Dashboard as Dashboard (/)
    participant RecAPI as POST /api/recommend
    participant DB as SQLite
    participant Gemini as Gemini 2.5 Flash

    Dashboard->>DB: Query UserProfile, today's DailyFoodLogs, today's WorkoutLogs
    DB-->>Dashboard: Returns targets, consumed macros, total activeCalories burned
    Note over Dashboard: Calorie Target Calculation:<br/>Effective Target = Daily Target + Active Burn (Workouts)<br/>Remaining = Effective Target - Consumed Calories
    Dashboard->>RecAPI: POST /api/recommend { date, targetMealSlot: "dinner" }
    RecAPI->>DB: Fetch remaining calories, protein gap, tsomMode
    alt Tsom Mode Active
        RecAPI->>DB: Fetch FoodItems WHERE isFasting == true
    else Standard Mode
        RecAPI->>DB: Fetch all FoodItems
    end
    RecAPI->>Gemini: Suggest next meal from available library items to meet remaining protein/calorie deficit
    Gemini-->>RecAPI: Returns recommended meals + reasoning explanation
    RecAPI-->>Dashboard: Return recommendations list
    Dashboard->>Dashboard: Render interactive macro rings & meal suggestion cards
```

---

## 5. API Reference Specifications

### 5.1 Workout Intake API

#### `POST /api/workouts/parse-screenshot`
Parses one or more workout screenshot images with Gemini Vision.

- **Content-Type**: `multipart/form-data`
- **Query / Form Parameters**:
  - `files` / `file` (`Blob | Blob[]`, Required): 1 to 5 images (`PNG`, `JPG`, `WEBP`, `HEIC`).
  - `save` (`string`, Optional): `"false"` to return parsed preview; `"true"` (default) to persist directly into database.

**Sample Response (`save=false` Preview)**:
```json
{
  "parsed": {
    "date": "2026-11-22",
    "workoutType": "Outdoor Run",
    "activeCalories": 380,
    "totalCalories": 445,
    "durationMinutes": 34,
    "avgHeartRate": 152,
    "rawSummary": "Synthesized 34-min outdoor run with 380 active kcal burned from 2 screenshots."
  }
}
```

**Sample Response (`save=true` Persisted)**:
```json
{
  "workoutLog": {
    "id": 12,
    "date": "2026-11-22",
    "workoutType": "Outdoor Run",
    "activeCalories": 380,
    "totalCalories": 445,
    "durationMinutes": 34,
    "avgHeartRate": 152,
    "rawSummary": "Outdoor Run summary"
  }
}
```

---

#### `GET /api/workouts`
Retrieves all historical workout records.
- **Response**: `{ "workouts": WorkoutLog[] }` ordered by `date` desc, `id` desc.

---

#### `POST /api/workouts`
Persists a verified workout object into the database.
- **Content-Type**: `application/json`
- **Body**:
```json
{
  "date": "2026-11-22",
  "workoutType": "Traditional Strength Training",
  "activeCalories": 310,
  "totalCalories": 390,
  "durationMinutes": 45,
  "avgHeartRate": 134,
  "rawSummary": "Auditing text"
}
```
- **Response**: `201 Created` with `{ "workoutLog": WorkoutLog }`

---

#### `DELETE /api/workouts?id={id}`
Deletes an errant or test workout log by ID.
- **Response**: `{ "success": true, "deletedId": 12 }`

---

### 5.2 Food & Nutrition Intake API

#### `POST /api/foods/parse`
First-time natural language food entry. Parses nutritional values with Gemini, creates/updates `FoodItem`, and appends a `DailyFoodLog` entry.

- **Content-Type**: `application/json`
- **Body**:
```json
{
  "description": "2 eggs scrambled with half an avocado and slice of sourdough toast",
  "mealSlot": "breakfast",
  "date": "2026-11-22"
}
```
- **Response**:
```json
{
  "foodItem": {
    "id": 7,
    "name": "Scrambled Eggs with Avocado & Sourdough",
    "servingUnit": "plate",
    "calories": 420,
    "proteinG": 18.0,
    "carbsG": 28.0,
    "fatG": 24.0,
    "isFasting": false
  },
  "logEntry": {
    "id": 19,
    "date": "2026-11-22",
    "foodItemId": 7,
    "quantity": 1.0,
    "mealSlot": "breakfast"
  }
}
```

---

#### `POST /api/foods/log-saved`
Zero-AI repeat food logging route. Looks up an existing `FoodItem` ID and writes directly to `DailyFoodLog`.

- **Content-Type**: `application/json`
- **Body**:
```json
{
  "foodItemId": 7,
  "quantity": 1.5,
  "mealSlot": "breakfast",
  "date": "2026-11-22"
}
```
- **Response**: `201 Created` with `{ "logEntry": DailyFoodLog }`

---

#### `GET /api/foods`
Returns all library food items, with optional Tsom filtering.
- **Query Params**:
  - `tsomOnly` (`boolean`, Optional): If `true`, returns only `isFasting == true` items.
  - `search` (`string`, Optional): Filters by food item name.
- **Response**: `{ "foods": FoodItem[] }`

---

### 5.3 Recommendation & Profile API

#### `POST /api/recommend`
Generates adaptive next-meal recommendations factoring in active calories burned from workouts and Tsom Mode compliance.

- **Content-Type**: `application/json`
- **Body**:
```json
{
  "date": "2026-11-22",
  "mealSlot": "dinner"
}
```
- **Response**:
```json
{
  "recommendations": [
    {
      "foodItemId": 2,
      "name": "Lentil Soup with Sourdough",
      "portionSuggestion": "1.5 bowls",
      "calories": 480,
      "proteinG": 28.0,
      "isFasting": true
    }
  ],
  "reasoning": "You burned 380 active kcal running today and have 42g of protein left to reach your target. Since Tsom Mode is active, this lentil bowl meets your protein goal while complying with fasting."
}
```

---

#### `PATCH /api/profile`
Toggles global settings such as Tsom Mode or adjusts targets.
- **Body**: `{ "tsomMode": true, "dailyCalorieTarget": 2400 }`
- **Response**: `{ "profile": UserProfile }`

---

## 6. Page-by-Page Feature & Data Matrix

| Page Route | User Actions | API Endpoints Called | Data Read / Written |
|---|---|---|---|
| **`/` (Dashboard)** | View calorie balance ring, protein/carb/fat bars, workout burn offset, request next-meal suggestions. | `GET /api/workouts`<br/>`GET /api/profile`<br/>`POST /api/recommend` | Reads: `UserProfile`, `WorkoutLog`, `DailyFoodLog`, `FoodItem` |
| **`/workouts`** | Upload 1-5 screenshots, view preview thumbnails, trigger extraction, review parsed card, save to log, delete workout. | `POST /api/workouts/parse-screenshot`<br/>`POST /api/workouts`<br/>`DELETE /api/workouts` | Writes: `WorkoutLog`<br/>Reads: `WorkoutLog` history |
| **`/foods`** | Input natural language meal, view AI parsed macros, search library, one-tap re-log saved foods, toggle Tsom Mode. | `POST /api/foods/parse`<br/>`POST /api/foods/log-saved`<br/>`GET /api/foods`<br/>`PATCH /api/profile` | Writes: `FoodItem`, `DailyFoodLog`<br/>Reads: `FoodItem`, `UserProfile` |

---

## 7. Token Optimization Strategy

- **Workouts**: 1 LLM call per upload session (even when multiple screenshots are uploaded, they are merged into one prompt).
- **Food logging**: Exactly 1 LLM call when a meal is novel. All subsequent logs of that food cost **0 LLM tokens**.
- **Recommendations**: Only invoked on explicit user request; prompts are seeded with pre-calculated macro balance deltas.
