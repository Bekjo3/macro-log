-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "targetWeightKg" REAL;
ALTER TABLE "UserProfile" ADD COLUMN "trainingDirective" TEXT;

-- AlterTable
ALTER TABLE "WorkoutLog" ADD COLUMN "muscleGroups" TEXT;
ALTER TABLE "WorkoutLog" ADD COLUMN "totalVolumeKg" INTEGER;
