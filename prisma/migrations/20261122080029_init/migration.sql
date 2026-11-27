-- CreateTable
CREATE TABLE "UserProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weightKg" REAL NOT NULL DEFAULT 0,
    "heightCm" REAL NOT NULL DEFAULT 0,
    "dailyCalorieTarget" INTEGER,
    "dailyProteinTarget" INTEGER,
    "tsomMode" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "FoodItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "servingUnit" TEXT NOT NULL,
    "calories" REAL NOT NULL,
    "proteinG" REAL NOT NULL,
    "carbsG" REAL NOT NULL,
    "fatG" REAL NOT NULL,
    "isFasting" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "DailyFoodLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "foodItemId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "mealSlot" TEXT NOT NULL,
    CONSTRAINT "DailyFoodLog_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "workoutType" TEXT NOT NULL,
    "activeCalories" INTEGER NOT NULL,
    "totalCalories" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "avgHeartRate" INTEGER,
    "rawSummary" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodItem_name_key" ON "FoodItem"("name");
