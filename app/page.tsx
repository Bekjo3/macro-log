import { prisma } from "@/app/lib/prisma";
import DashboardClient from "@/app/components/DashboardClient";

export default async function HomePage() {
  const [profile, workoutCount, foodCount] = await Promise.all([
    prisma.userProfile.findFirst({ where: { id: 1 } }),
    prisma.workoutLog.count(),
    prisma.foodItem.count(),
  ]);

  const recentWorkouts = await prisma.workoutLog.findMany({
    take: 5,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: {
      id: true,
      date: true,
      workoutType: true,
      activeCalories: true,
      durationMinutes: true,
      muscleGroups: true,
    },
  });

  const aggregateCalories = await prisma.workoutLog.aggregate({
    _sum: { activeCalories: true },
  });
  const totalCaloriesBurned = aggregateCalories._sum.activeCalories || 0;

  return (
    <DashboardClient
      initialProfile={profile}
      workoutCount={workoutCount}
      foodCount={foodCount}
      totalCaloriesBurned={totalCaloriesBurned}
      recentWorkouts={recentWorkouts}
    />
  );
}
