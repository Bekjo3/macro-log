-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weightKg" REAL NOT NULL DEFAULT 0,
    "heightCm" REAL NOT NULL DEFAULT 0,
    "dailyCalorieTarget" INTEGER,
    "dailyProteinTarget" INTEGER,
    "tsomMode" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_UserProfile" ("dailyCalorieTarget", "dailyProteinTarget", "heightCm", "id", "tsomMode", "weightKg") SELECT "dailyCalorieTarget", "dailyProteinTarget", "heightCm", "id", "tsomMode", "weightKg" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
