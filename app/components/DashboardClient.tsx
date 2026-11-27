"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ProfileData {
  id: number;
  weightKg: number;
  heightCm: number;
  targetWeightKg: number | null;
  trainingDirective: string | null;
  dailyCalorieTarget: number | null;
  dailyProteinTarget: number | null;
  tsomMode: boolean;
}

interface CoachEvaluation {
  date: string;
  profile: {
    currentWeightKg: number;
    targetWeightKg: number;
    heightCm: number;
    trainingDirective: string | null;
  };
  intake: {
    consumedCalories: number;
    consumedProtein: number;
    activeBurn: number;
    totalWorkoutMinutes: number;
  };
  targets: {
    baselineCalories: number;
    baselineProtein: number;
    adjustedCalorieTarget: number;
    remainingCalories: number;
    remainingProtein: number;
  };
  evaluation: {
    overallRating: number;
    staminaScore: number;
    hypertrophyScore: number;
    assessmentSummary: string;
    actionAdvice: string;
  };
}

interface RecentWorkout {
  id: number;
  date: string;
  workoutType: string;
  activeCalories: number;
  durationMinutes: number;
  muscleGroups?: string | null;
}

interface DashboardProps {
  initialProfile: ProfileData | null;
  workoutCount: number;
  foodCount: number;
  totalCaloriesBurned: number;
  recentWorkouts: RecentWorkout[];
}

export default function DashboardClient({
  initialProfile,
  workoutCount,
  foodCount,
  totalCaloriesBurned,
  recentWorkouts,
}: DashboardProps) {
  const [profile, setProfile] = useState<ProfileData | null>(initialProfile);
  const [trainingDirective, setTrainingDirective] = useState(
    initialProfile?.trainingDirective || ""
  );
  const [currentWeight, setCurrentWeight] = useState(
    initialProfile?.weightKg && initialProfile.weightKg > 0
      ? initialProfile.weightKg
      : 0
  );
  const [heightCm, setHeightCm] = useState(
    initialProfile?.heightCm && initialProfile.heightCm > 0
      ? initialProfile.heightCm
      : 0
  );
  const [targetWeight, setTargetWeight] = useState(
    initialProfile?.targetWeightKg || 0
  );
  const [isSavingDirective, setIsSavingDirective] = useState(false);
  const [coachData, setCoachData] = useState<CoachEvaluation | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchCoachData();
  }, []);

  async function fetchCoachData() {
    try {
      const res = await fetch("/api/coach");
      if (res.ok) {
        const data = await res.json();
        setCoachData(data);
      }
    } catch (err) {
      console.error("Failed to load coach evaluation:", err);
    }
  }

  async function handleSaveDirective() {
    setIsSavingDirective(true);
    setSaveMessage(null);

    const baseCals = currentWeight > 0 ? Math.round(currentWeight * 33) : 2200;
    const surplus = targetWeight > currentWeight && currentWeight > 0 ? 300 : 0;
    const calibratedCalories = baseCals + surplus;
    const calibratedProtein = currentWeight > 0 ? Math.round(currentWeight * 2.0) : 140;

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingDirective,
          weightKg: currentWeight > 0 ? currentWeight : null,
          heightCm: heightCm > 0 ? heightCm : null,
          targetWeightKg: targetWeight > 0 ? targetWeight : null,
          dailyCalorieTarget: calibratedCalories,
          dailyProteinTarget: calibratedProtein,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated.profile);
        setSaveMessage("Training directive saved and daily targets recalibrated.");
        await fetchCoachData();
      }
    } catch (err) {
      console.error("Failed to save directive:", err);
    } finally {
      setIsSavingDirective(false);
    }
  }

  const baselineCalories = profile?.dailyCalorieTarget || 2600;
  const baselineProtein = profile?.dailyProteinTarget || 150;
  const activeBurnToday = coachData?.intake.activeBurn || 0;
  const adjustedTargetToday = baselineCalories + activeBurnToday;

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Intro Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6 sm:pb-8 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Training and nutrition log
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
              Tracking driven 100% by fitness screenshots. Daily calorie and protein targets adjust automatically with workout burn to balance endurance and muscle growth.
            </p>
          </div>
          <Link
            href="/workouts"
            className="self-start sm:self-auto px-4 py-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-xs sm:text-sm font-medium rounded-lg transition-colors"
          >
            Upload workout screenshots
          </Link>
        </div>
      </div>

      {/* Feature 1: Training Directive & Target Physique Configuration Window */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 bg-white dark:bg-zinc-900 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Training directive &amp; target physique
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Define your athletic objectives in plain language. The system adapts your daily calories and protein to prevent cardio sessions from burning muscle.
            </p>
          </div>
          {saveMessage && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {saveMessage}
            </span>
          )}
        </div>

        {/* Natural Language Prompt Window */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            What are you training for?
          </label>
          <textarea
            value={trainingDirective}
            onChange={(e) => setTrainingDirective(e.target.value)}
            rows={3}
            className="w-full p-3 text-xs sm:text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none font-sans"
            placeholder="e.g. Build lean muscle and strength while maintaining endurance..."
          />
        </div>

        {/* Biometrics & Target Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/50">
            <label className="text-[11px] text-zinc-500 block mb-1">Current Weight (kg)</label>
            <input
              type="number"
              value={currentWeight || ""}
              onChange={(e) => setCurrentWeight(Number(e.target.value) || 0)}
              placeholder="e.g. 70"
              className="w-full text-base font-bold bg-transparent text-zinc-950 dark:text-zinc-50 focus:outline-none"
            />
            <span className="text-[10px] text-zinc-400 mt-1 block">Used for protein & calorie baselines</span>
          </div>

          <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/50">
            <label className="text-[11px] text-zinc-500 block mb-1">Height (cm)</label>
            <input
              type="number"
              value={heightCm || ""}
              onChange={(e) => setHeightCm(Number(e.target.value) || 0)}
              placeholder="e.g. 175"
              className="w-full text-base font-bold bg-transparent text-zinc-950 dark:text-zinc-50 focus:outline-none"
            />
            <span className="text-[10px] text-zinc-400 mt-1 block">Used for body stats</span>
          </div>

          <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/50">
            <label className="text-[11px] text-zinc-500 block mb-1">Target Weight (kg)</label>
            <input
              type="number"
              value={targetWeight || ""}
              onChange={(e) => setTargetWeight(Number(e.target.value) || 0)}
              placeholder="e.g. 75"
              className="w-full text-base font-bold bg-transparent text-zinc-950 dark:text-zinc-50 focus:outline-none"
            />
            <span className="text-[10px] text-zinc-400 mt-1 block">Surplus added if gaining</span>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSaveDirective}
            disabled={isSavingDirective}
            className="w-full sm:w-auto px-4 py-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-xs sm:text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isSavingDirective ? "Recalibrating targets..." : "Save directive & recalibrate goals"}
          </button>
        </div>
      </div>

      {/* Feature 2: Daily Goal Alignment & Coach Rating Card */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 bg-white dark:bg-zinc-900 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Today&apos;s goal alignment &amp; coach rating
            </h2>
            <p className="text-xs text-zinc-500">
              Evaluates whether today&apos;s activity and food intake supported your training goals
            </p>
          </div>
          {coachData && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Daily score:</span>
              <span className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                {coachData.evaluation.overallRating} / 10
              </span>
            </div>
          )}
        </div>

        {/* Dual Impact Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Stamina &amp; Conditioning
              </span>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {coachData?.evaluation.staminaScore || 8.0} / 10
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {coachData?.intake.totalWorkoutMinutes
                ? `${coachData.intake.totalWorkoutMinutes} minutes active today.`
                : "Cardiovascular and stamina stimulus logged."}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Hypertrophy &amp; Lean Weight Gain
              </span>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {coachData?.evaluation.hypertrophyScore || 7.0} / 10
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {activeBurnToday >= 500
                ? `Heavy active burn (${activeBurnToday} kcal) increases catabolic risk unless compensated with extra intake.`
                : "Caloric intake is on pace to protect lean tissue growth."}
            </p>
          </div>
        </div>

        {/* Dynamic Caloric Recalibration formula */}
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block font-medium">
            Dynamic intake calibration for today
          </span>
          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-medium">
            <span className="text-zinc-700 dark:text-zinc-300">
              Base surplus: <strong className="text-zinc-950 dark:text-zinc-50">{baselineCalories} kcal</strong>
            </span>
            <span className="text-zinc-400">+</span>
            <span className="text-zinc-700 dark:text-zinc-300">
              Active workout burn: <strong className="text-orange-600 dark:text-orange-400">+{activeBurnToday} kcal</strong>
            </span>
            <span className="text-zinc-400">=</span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold">
              Target today: {adjustedTargetToday} kcal &amp; {baselineProtein}g protein
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 pt-1">
            {coachData?.evaluation.actionAdvice ||
              `With ${activeBurnToday} kcal active burn logged today, your calorie target is dynamically scaled to ${adjustedTargetToday} kcal to prevent losing muscle mass.`}
          </p>
        </div>
      </div>

      {/* Primary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-4 sm:p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Workouts logged</span>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            {workoutCount}
          </p>
          <span className="text-xs text-zinc-500">100% screenshot-driven</span>
        </div>

        <div className="p-4 sm:p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Active energy burned</span>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            {totalCaloriesBurned.toLocaleString()}{" "}
            <span className="text-xs font-normal text-zinc-500">kcal</span>
          </p>
          <span className="text-xs text-zinc-500">Offsetting daily targets</span>
        </div>

        <div className="p-4 sm:p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Saved food library</span>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            {foodCount}
          </p>
          <span className="text-xs text-zinc-500">Parsed once, reused forever</span>
        </div>
      </div>

      {/* Recent Workouts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Recent workouts
          </h2>
          <Link
            href="/workouts"
            className="text-xs text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium"
          >
            Open workout uploader &rarr;
          </Link>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
          {recentWorkouts.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">
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
                    <p className="text-xs font-mono text-zinc-500">
                      {w.date}
                      {w.muscleGroups ? ` • ${w.muscleGroups}` : ""}
                    </p>
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
