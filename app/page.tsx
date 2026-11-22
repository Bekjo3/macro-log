import Link from "next/link";
import { prisma } from "@/app/lib/prisma";

export default async function HomePage() {
  const [profile, workoutCount, foodCount] = await Promise.all([
    prisma.userProfile.findFirst({ where: { id: 1 } }),
    prisma.workoutLog.count(),
    prisma.foodItem.count(),
  ]);

  const recentWorkouts = await prisma.workoutLog.findMany({
    take: 5,
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });

  const aggregateCalories = await prisma.workoutLog.aggregate({
    _sum: { activeCalories: true },
  });
  const totalCaloriesBurned = aggregateCalories._sum.activeCalories || 0;

  return (
    <div className="space-y-12">
      {/* Intro Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-8 space-y-4">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Nutrition and workout log
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Zero manual workout forms. Upload screenshots from your fitness app to automatically extract active energy and workout metrics with Gemini Vision.
          </p>
        </div>

        <div className="pt-1">
          <Link
            href="/workouts"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-sm font-medium transition-colors"
          >
            Upload workout screenshots
          </Link>
        </div>
      </div>

      {/* Primary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Workouts logged
          </span>
          <p className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            {workoutCount}
          </p>
          <span className="text-xs text-zinc-500">
            Parsed from screenshot summaries
          </span>
        </div>

        <div className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Active energy burned
          </span>
          <p className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            {totalCaloriesBurned.toLocaleString()}{" "}
            <span className="text-xs font-normal text-zinc-500">kcal</span>
          </p>
          <span className="text-xs text-zinc-500">
            Cumulative active burn
          </span>
        </div>

        <div className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Saved food items
          </span>
          <p className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            {foodCount}
          </p>
          <span className="text-xs text-zinc-500">
            Parsed once, logged repeatedly
          </span>
        </div>
      </div>

      {/* Recent Workouts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Recent activity
          </h2>
          <Link
            href="/workouts"
            className="text-xs text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium"
          >
            View all workouts
          </Link>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
          {recentWorkouts.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              No workouts logged yet.{" "}
              <Link
                href="/workouts"
                className="text-zinc-950 dark:text-zinc-100 underline font-medium"
              >
                Upload your first workout screenshot
              </Link>
              .
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentWorkouts.map((w) => (
                <div
                  key={w.id}
                  className="py-3 px-4 flex items-center justify-between text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-zinc-950 dark:text-zinc-100">
                      {w.workoutType}
                    </p>
                    <p className="text-xs font-mono text-zinc-500">{w.date}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="font-medium text-zinc-950 dark:text-zinc-100">
                      {w.activeCalories} kcal
                    </p>
                    <p className="text-xs text-zinc-500">{w.durationMinutes} min</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
