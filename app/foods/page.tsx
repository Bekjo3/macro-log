import Link from "next/link";
import { prisma } from "@/app/lib/prisma";

export default async function FoodsPage() {
  const [foods, profile] = await Promise.all([
    prisma.foodItem.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.userProfile.findFirst({ where: { id: 1 } }),
  ]);

  return (
    <div className="space-y-8 sm:space-y-12">
      <div className="space-y-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Food library
          </h1>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Slice 3 preview
          </span>
        </div>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
          Log once, reuse forever. Meals described in plain language are parsed once by Gemini, saved to your personal library, and re-logged with zero subsequent API calls.
        </p>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 bg-white dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Saved food items ({foods.length})
          </h2>
          <span className="text-xs text-zinc-500">
            Tsom Mode: {profile?.tsomMode ? "Active" : "Standard"}
          </span>
        </div>

        {foods.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Your library is currently empty
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              In Slice 3, describing what you ate in natural language (e.g. &ldquo;rice with chicken and roasted potatoes&rdquo;) will automatically assess macros and save the item here for instant one-tap reuse.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {foods.map((food) => (
              <div
                key={food.id}
                className="p-3.5 rounded-lg border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-1.5"
              >
                <div className="flex items-start justify-between">
                  <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                    {food.name}
                  </span>
                  {food.isFasting && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                      Tsom
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-2">
                  <span>{food.calories} kcal / {food.servingUnit}</span>
                  <span>&bull;</span>
                  <span>{food.proteinG}g P</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
          <span>Ready for Slice 3 natural-language parser</span>
          <Link
            href="/workouts"
            className="text-zinc-950 dark:text-zinc-50 font-medium underline"
          >
            Go to Workouts
          </Link>
        </div>
      </div>
    </div>
  );
}
