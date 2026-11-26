# MacroLog — System Design

## 1. System Overview & Core Pillars

MacroLog is a workout and macro tracking app that parses fitness screenshots and adjusts your daily calorie and protein goals based on what you are training for.

| Pillar / Constraint | Principle | Implementation Rule |
|---|---|---|
| **Constraint 1: Workouts** | **100% Screenshot-Driven** | Never build manual workout forms. The only way to log workouts is uploading screenshots from fitness apps (Apple Fitness, Garmin, Strava, Hevy, Strong). Gemini extracts the numbers (calories, duration, heart rate, volume lifted, and muscle groups). |
| **Constraint 2: Foods** | **Log Once, Reuse Forever** | The first time you eat something, describe it in plain words. Gemini estimates the calories and macros once and saves it to your library. When you log that food again, you pick it from the library with zero AI calls. |
| **Constraint 3: Tsom Mode** | **Orthodox Fasting Toggle** | A global toggle (`UserProfile.tsomMode`). When on, the food library and recommendations only show fasting-compliant foods (`isFasting = true`). |
| **Pillar 4: Training Goal & Daily Adjustment** | **Goal-Based Target Recalibration** | You write what you are training for in a text box (e.g. *"gain muscle from 60kg to 70kg at 181cm while keeping stamina for soccer"*). If you burn calories working out, the app adds those calories to your daily target so you do not lose weight by accident, and gives you a rating for the day. |

---

## 2. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Next.js App Router / Responsive iOS & Desktop)"]
        Dashboard["Dashboard (/)<br/>• Training Goal Box<br/>• Daily Goal Rating Card<br/>• Target Weight (70kg vs 80kg)<br/>• Macro Balance Rings"]
        WorkoutsUI["Workouts (/workouts)<br/>• Screenshot Upload<br/>• Volume &amp; Muscle Group Badges<br/>• Mobile Cards &amp; Desktop Table"]
        FoodsUI["Foods (/foods)<br/>• Plain-Text Meal Entry<br/>• Saved Food Library<br/>• Tsom Mode Filter"]
        Nav["Global Header / Navigation"]
    end

    subgraph Server ["Server Layer (Next.js Route Handlers)"]
        CoachAPI["/api/coach<br/>GET: Daily Rating &amp; Calorie Recalibration"]
        ProfileAPI["/api/profile<br/>GET / PATCH: Training Goal &amp; Target Weight"]
        WorkoutsAPI["/api/workouts<br/>GET / POST / DELETE: Workout CRUD"]
        ParseWorkoutAPI["/api/workouts/parse-screenshot<br/>POST: Multi-Image Gemini Vision Parser"]
        FoodsParseAPI["/api/foods/parse<br/>POST: First-time Meal Extraction"]
        FoodsLogAPI["/api/foods/log-saved<br/>POST: Zero-AI Repeat Food Logging"]
        RecommendAPI["/api/recommend<br/>POST: Meal Recommendation"]
    end

    subgraph AI ["AI Services (Google Gen AI SDK)"]
        GeminiVision["Gemini 2.5 Flash Vision<br/>Workout Screenshot Parser"]
        GeminiText["Gemini 2.5 Flash<br/>Macro Extraction &amp; Food Analysis"]
    end

    subgraph Storage ["Data Layer (Prisma ORM + SQLite)"]
        SQLite[("SQLite DB (dev.db)<br/>@prisma/adapter-libsql")]
        M_User["UserProfile<br/>(directive, targetWeight, baseline targets)"]
        M_Workout["WorkoutLog<br/>(calories, volumeKg, muscleGroups)"]
        M_Food["FoodItem<br/>(name, calories, protein, fasting)"]
        M_Log["DailyFoodLog<br/>(date, quantity, mealSlot)"]
    end

    Dashboard --> CoachAPI & ProfileAPI & WorkoutsAPI & RecommendAPI
    WorkoutsUI --> ParseWorkoutAPI & WorkoutsAPI
    FoodsUI --> FoodsParseAPI & FoodsLogAPI & ProfileAPI

    ParseWorkoutAPI --> GeminiVision
    FoodsParseAPI --> GeminiText
    RecommendAPI --> GeminiText

    CoachAPI --> M_User & M_Workout & M_Log
    ProfileAPI --> M_User
    WorkoutsAPI --> M_Workout
    ParseWorkoutAPI --> M_Workout
    FoodsParseAPI --> M_Food & M_Log
    FoodsLogAPI --> M_Log
    RecommendAPI --> M_Log & M_Workout & M_Food

    M_User & M_Workout & M_Food & M_Log --- SQLite
```

---

## 3. Data Model & Entity Relationships

The schema is persisted in SQLite via Prisma ORM with the LibSQL driver adapter.

```mermaid
erDiagram
    UserProfile {
        int id PK
        float weightKg "Current weight (e.g. 60 kg)"
        float heightCm "Current height (e.g. 181 cm)"
        float targetWeightKg "Target weight (e.g. 70 kg pure muscle vs 80 kg bulk)"
        string trainingDirective "User goal description (e.g. gain muscle, soccer stamina)"
        int dailyCalorieTarget "Calibrated baseline target (e.g. 2600 kcal)"
        int dailyProteinTarget "Calibrated protein target (e.g. 150g)"
        boolean tsomMode "Orthodox fasting toggle"
    }

    WorkoutLog {
        int id PK
        string date "YYYY-MM-DD"
        string workoutType "e.g. 'Outdoor Run', 'Hypertrophy: Back & Biceps'"
        int activeCalories "Active energy burned (kcal)"
        int totalCalories "Total energy burned (kcal)"
        int durationMinutes "Total duration (min)"
        int avgHeartRate "Average BPM"
        int totalVolumeKg "Total volume lifted in kg (for strength workouts)"
        string muscleGroups "Muscle groups targeted (e.g. 'Back, Biceps')"
        string rawSummary "Auditing text / Gemini summary"
    }

    FoodItem {
        int id PK
        string name UK "Title generated by Gemini"
        string servingUnit "e.g. 'plate', 'bowl', 'g'"
        float calories
        float proteinG
        float carbsG
        float fatG
        boolean isFasting "True if compliant with Tsom fasting"
    }

    DailyFoodLog {
        int id PK
        string date "YYYY-MM-DD"
        int foodItemId FK
        float quantity "Multiplier (e.g. 1.0, 1.5)"
        string mealSlot "breakfast | lunch | dinner | snack"
    }

    FoodItem ||--o{ DailyFoodLog : "referenced by"
```

---

## 4. End-to-End Sequence Diagrams

### Flow 1: Workout Screenshot Intake (Cardio & Resistance/Strength Workouts)
Handles single or multiple screenshots (1–5 images) across sports and lifting apps (Apple Fitness, Garmin, Strava, Hevy, Strong). Gemini Vision extracts volume and exercises without manual form filling.

```mermaid
sequenceDiagram
    autonumber
    actor User as User (iPhone / Desktop)
    participant WorkoutsUI as /workouts Page
    participant API as POST /api/workouts/parse-screenshot
    participant Gemini as Gemini 2.5 Flash Vision
    participant DB as SQLite (WorkoutLog)

    User->>WorkoutsUI: Uploads 1-3 screenshots (e.g., Apple Fitness summary + Hevy back row/cable workout)
    WorkoutsUI->>WorkoutsUI: Renders thumbnail preview strip with remove buttons
    User->>WorkoutsUI: Taps "Extract workout data"
    WorkoutsUI->>API: Multipart FormData [files: Blob[], save: false]
    API->>API: Convert buffers to Base64 image parts
    API->>Gemini: generateContent(contents: [image1, image2, prompt], schema)
    Note over Gemini: Synthesizes cardio metrics (calories, HR, duration)<br/>AND strength metrics (volume lifted, exercises, muscle groups)
    Gemini-->>API: JSON { workoutType: "Back & Biceps", activeCalories: 380, durationMinutes: 50, avgHeartRate: 142, totalVolumeKg: 8400, muscleGroups: "Back, Biceps" }
    API-->>WorkoutsUI: Return { parsed: workoutObject }
    WorkoutsUI->>WorkoutsUI: Renders review card with Volume (8,400 kg) & Muscle Group badges
    User->>WorkoutsUI: Taps "Save workout"
    WorkoutsUI->>API: POST /api/workouts { ...parsedData }
    API->>DB: prisma.workoutLog.create()
    DB-->>API: workoutLog record
    API-->>WorkoutsUI: 201 Created
    WorkoutsUI->>WorkoutsUI: Updates Workout History list
```

---

### Flow 2: Training Goal Setup & Target Weight
Sets your training goal and target weight (e.g. 60 kg &rarr; 70 kg at 181 cm).

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Dashboard as Dashboard (/)
    participant ProfileAPI as PATCH /api/profile
    participant DB as SQLite (UserProfile)

    User->>Dashboard: Types goal: "Gain muscle from 60kg to 70kg while keeping soccer stamina"
    User->>Dashboard: Selects Target Weight: "70 kg" (+10 kg gain)
    User->>Dashboard: Clicks "Save goal"
    Dashboard->>Dashboard: Calculates base surplus (2,600 kcal) & protein (150g)
    Dashboard->>ProfileAPI: PATCH /api/profile { trainingDirective, targetWeightKg: 70, weightKg: 60, heightCm: 181, dailyCalorieTarget: 2600, dailyProteinTarget: 150 }
    ProfileAPI->>DB: prisma.userProfile.upsert()
    DB-->>ProfileAPI: Updated UserProfile
    ProfileAPI-->>Dashboard: 200 OK { profile }
    Dashboard->>Dashboard: Shows confirmation toast & updates baseline targets
```

---

### Flow 3: Daily Goal Calibration & Alignment Rating (Balancing Competing Goals)
Addresses the trade-off: **High-volume cardio/sports (e.g. 3-hour soccer/tennis) vs. Muscle hypertrophy**. Automatically scales daily targets so calories burned in cardio do not burn off muscle mass.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Dashboard as Dashboard (/)
    participant CoachAPI as GET /api/coach?date=today
    participant DB as SQLite

    User->>Dashboard: Opens Dashboard at end of day
    Dashboard->>CoachAPI: GET /api/coach?date=2026-11-26
    CoachAPI->>DB: Read UserProfile (directive, baseline 2,600 kcal, 150g protein)
    CoachAPI->>DB: Read today's WorkoutLogs (e.g. 3-hour match, 1,100 active kcal)
    CoachAPI->>DB: Read today's DailyFoodLogs (calories & protein consumed)
    Note over CoachAPI: Dynamic Calibration Calculation:<br/>Baseline Target: 2,600 kcal<br/>+ Active Workout Burn: +1,100 kcal<br/>= Adjusted Target Today: 3,700 kcal & 150g protein
    Note over CoachAPI: Dual-Goal Impact Evaluation:<br/>• Soccer Stamina Score: 9.5 / 10 (High aerobic capacity built)<br/>• Hypertrophy Score: 4.5 / 10 (Deficit risk: 1,100 kcal deficit requires surplus offset)<br/>• Overall Alignment Rating: 7.0 / 10
    CoachAPI-->>Dashboard: Return JSON { overallRating, staminaScore, hypertrophyScore, adjustedCalorieTarget: 3700, actionAdvice }
    Dashboard->>Dashboard: Displays Goal Alignment Card:<br/>"Good for soccer stamina, but bad for muscle gain unless you intake +1,100 kcal extra today."
```

---

### Flow 4: First-Time Food Logging (Natural Language Parse & Save)

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant FoodsUI as /foods Page
    participant API as POST /api/foods/parse
    participant Gemini as Gemini 2.5 Flash
    participant DB as SQLite (FoodItem & DailyFoodLog)

    User->>FoodsUI: Inputs "Rice with grilled chicken, roasted potato and pickle, 1 plate"
    User->>FoodsUI: Selects mealSlot: "lunch", date: "today"
    FoodsUI->>API: POST /api/foods/parse { description, mealSlot, date }
    API->>Gemini: Prompt + JSON Schema (evaluates macros, title, isFasting)
    Gemini-->>API: JSON { name: "Chicken, Rice & Potato Plate", calories: 680, proteinG: 48, carbsG: 72, fatG: 16, isFasting: false }
    API->>DB: prisma.foodItem.upsert(name)
    API->>DB: prisma.dailyFoodLog.create(foodItemId, quantity: 1, mealSlot)
    DB-->>API: Saved records
    API-->>FoodsUI: Return { foodItem, logEntry }
    FoodsUI->>FoodsUI: Appends to Saved Food Library + updates daily totals
```

---

### Flow 5: Repeat Food Log (Zero AI Tokens)

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant FoodsUI as /foods Page
    participant API as POST /api/foods/log-saved
    participant DB as SQLite (DailyFoodLog)

    User->>FoodsUI: Taps "Chicken, Rice & Potato Plate" in Saved Library
    User->>FoodsUI: Selects quantity: 1.5, slot: "dinner"
    FoodsUI->>API: POST /api/foods/log-saved { foodItemId: 4, quantity: 1.5, mealSlot: "dinner", date }
    Note over API: ZERO LLM API CALLS
    API->>DB: prisma.dailyFoodLog.create({ foodItemId: 4, quantity: 1.5, ... })
    DB-->>API: Created record
    API-->>FoodsUI: Return { logEntry }
    FoodsUI->>FoodsUI: Updates daily macro totals immediately
```

---

## 5. API Reference Specifications

### 5.1 Goal & Daily Rating API

#### `GET /api/coach`
Checks the day's workouts and food intake against your goal.

- **Query Parameters**:
  - `date` (`string`, Optional): Date formatted as `YYYY-MM-DD`. Defaults to today.
- **Response (`200 OK`)**:
```json
{
  "date": "2026-11-26",
  "profile": {
    "currentWeightKg": 60,
    "targetWeightKg": 70,
    "heightCm": 181,
    "trainingDirective": "Gain muscle from 60kg to 70kg at 181cm while keeping soccer stamina."
  },
  "intake": {
    "consumedCalories": 1850,
    "consumedProtein": 110,
    "activeBurn": 1100,
    "totalWorkoutMinutes": 180
  },
  "targets": {
    "baselineCalories": 2600,
    "baselineProtein": 150,
    "adjustedCalorieTarget": 3700,
    "remainingCalories": 1850,
    "remainingProtein": 40
  },
  "evaluation": {
    "overallRating": 7.0,
    "staminaScore": 9.5,
    "hypertrophyScore": 4.5,
    "assessmentSummary": "Big cardio day (1,100 kcal burn over 3 hours). Great for soccer stamina, but you need more food to keep from losing weight.",
    "actionAdvice": "Eat an extra 1,850 kcal and 40g protein before bed to make up for your 3-hour match."
  }
}
```

---

#### `GET /api/profile` & `PATCH /api/profile`
Reads or updates the user's training goals and biometrics.

- **`PATCH` Request Body**:
```json
{
  "trainingDirective": "Gain lean muscle mass from 60kg to 70kg at 181cm while building stamina for soccer",
  "weightKg": 60,
  "heightCm": 181,
  "targetWeightKg": 70,
  "dailyCalorieTarget": 2600,
  "dailyProteinTarget": 150,
  "tsomMode": false
}
```
- **Response (`200 OK`)**: `{ "profile": UserProfile }`

---

### 5.2 Workout Intake API

#### `POST /api/workouts/parse-screenshot`
Parses 1 to 5 fitness screenshots (Apple Fitness, Garmin, Strava, Hevy, Strong).

- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `files` / `file` (`File[]`, Required): 1–5 image files.
  - `save` (`string`, Optional): `"false"` to return preview; `"true"` to save directly.
- **Sample Response**:
```json
{
  "parsed": {
    "date": "2026-11-26",
    "workoutType": "Hypertrophy: Back & Biceps",
    "activeCalories": 380,
    "totalCalories": 460,
    "durationMinutes": 52,
    "avgHeartRate": 138,
    "totalVolumeKg": 8450,
    "muscleGroups": "Back, Biceps",
    "rawSummary": "Upper body pull session: 4 exercises including cable rows and lat pulldowns; 8,450 kg total volume."
  }
}
```

---

#### `GET /api/workouts`, `POST /api/workouts`, `DELETE /api/workouts`
Full CRUD management for saved workout records.
- `GET /api/workouts` &rarr; `{ "workouts": WorkoutLog[] }`
- `POST /api/workouts` &rarr; Creates verified `WorkoutLog`
- `DELETE /api/workouts?id={id}` &rarr; Removes workout log

---

### 5.3 Food & Nutrition API

#### `POST /api/foods/parse`
Evaluates natural language meal description once with Gemini, upserts `FoodItem`, and logs entry.
- **Body**: `{ "description": "1 plate rice with chicken, roasted potatoes and pickle", "mealSlot": "lunch", "date": "2026-11-26" }`
- **Response**: `{ "foodItem": FoodItem, "logEntry": DailyFoodLog }`

#### `POST /api/foods/log-saved`
Zero-AI repeat food logging route.
- **Body**: `{ "foodItemId": 4, "quantity": 1.5, "mealSlot": "dinner", "date": "2026-11-26" }`
- **Response**: `{ "logEntry": DailyFoodLog }`

#### `GET /api/foods`
Retrieves library items with optional `tsomOnly=true` filtering.

---

## 6. Dashboard Interface Architecture

```
+-----------------------------------------------------------------------------------+
| MacroLog                 Dashboard    Workouts    Foods                           |
+-----------------------------------------------------------------------------------+
| TRAINING GOAL & TARGET WEIGHT                                                     |
| Goal:   [ Gain muscle from 60kg to 70kg at 181cm while keeping soccer stamina... ] |
| Current: 60 kg (181 cm)   |   [x] 70 kg (+10kg gain)   |   [ ] 80 kg Bulk           |
|                                                                     [ Save goal ]  |
+-----------------------------------------------------------------------------------+
| TODAY'S RATING & GOAL ALIGNMENT                                    Score: 7.5 / 10 |
| +-----------------------------------------+-------------------------------------+ |
| | Soccer Stamina: 9.5 / 10                | Muscle Gain: 4.5 / 10               | |
| | 3 hr tennis/soccer match (1,100 kcal)   | High calorie deficit                | |
| +-----------------------------------------+-------------------------------------+ |
| TODAY'S CALORIE TARGET:                                                           |
| Base: 2,600 kcal + Workout Burn: +1,100 kcal = TARGET TODAY: 3,700 kcal           |
| Advice: "Good for soccer, but you need +1,100 extra calories today to keep from   |
|         losing weight."                                                           |
+-----------------------------------------------------------------------------------+
| Workouts Logged: 12      | Active Energy Burned: 4,850 kcal | Food Library: 18    |
+-----------------------------------------------------------------------------------+
| RECENT WORKOUTS                                                                   |
| • Hypertrophy: Back & Biceps   • 2026-11-26 • 8,450 kg volume • 380 kcal • 52 min |
| • Tennis / Soccer Match        • 2026-11-25 • 1,100 active kcal • 180 min         |
+-----------------------------------------------------------------------------------+
```

---

## 7. Token Optimization Strategy

- **Workouts**: Exactly 1 LLM Vision call per intake session, even when 3 screenshots (e.g. cardio top screen + resistance exercises bottom screen) are uploaded.
- **Foods**: Exactly 1 LLM call when a food is novel. All subsequent logs use **zero LLM tokens**.
- **Coaching & Daily Rating**: Deterministic formula for macro scaling and goal trade-off calculations runs locally on the server without consuming external LLM tokens for standard metric evaluation.
