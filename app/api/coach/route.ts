import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "@/app/lib/prisma";

const coachSchema = {
  type: Type.OBJECT,
  properties: {
    overallRating: {
      type: Type.NUMBER,
      description:
        "A score from 1.0 to 10.0 evaluating how well today's workouts and food intake aligned with the user's specific training goals.",
    },
    staminaScore: {
      type: Type.NUMBER,
      description:
        "A score from 1.0 to 10.0 evaluating stamina, endurance, and conditioning progress based on today's workouts.",
    },
    hypertrophyScore: {
      type: Type.NUMBER,
      description:
        "A score from 1.0 to 10.0 evaluating muscle growth, retention, and nutritional support for gaining lean weight.",
    },
    assessmentSummary: {
      type: Type.STRING,
      description:
        "A concise, honest 1-2 sentence evaluation of today's workouts and nutrition against the user's goal in normal, direct human words with no marketing fluff.",
    },
    actionAdvice: {
      type: Type.STRING,
      description:
        "Direct, actionable advice on what specific calories, macros, or recovery steps the user needs right now.",
    },
  },
  required: [
    "overallRating",
    "staminaScore",
    "hypertrophyScore",
    "assessmentSummary",
    "actionAdvice",
  ],
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const today = searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const [profile, todayWorkouts, todayFoodLogs] = await Promise.all([
      prisma.userProfile.findFirst({ where: { id: 1 } }),
      prisma.workoutLog.findMany({ where: { date: today } }),
      prisma.dailyFoodLog.findMany({
        where: { date: today },
        include: { foodItem: true },
      }),
    ]);

    const activeBurn = todayWorkouts.reduce((sum, w) => sum + w.activeCalories, 0);
    const totalWorkoutMinutes = todayWorkouts.reduce(
      (sum, w) => sum + w.durationMinutes,
      0
    );

    const caloriesConsumed = todayFoodLogs.reduce(
      (sum, f) => sum + f.foodItem.calories * f.quantity,
      0
    );
    const proteinConsumed = todayFoodLogs.reduce(
      (sum, f) => sum + f.foodItem.proteinG * f.quantity,
      0
    );

    const baselineCalories = profile?.dailyCalorieTarget || 2600;
    const baselineProtein = profile?.dailyProteinTarget || 150;

    // Deterministic daily target calibration: baseline + active calories burned from workouts
    const adjustedCalorieTarget = baselineCalories + activeBurn;
    const remainingCalories = adjustedCalorieTarget - caloriesConsumed;
    const remainingProtein = Math.max(0, baselineProtein - proteinConsumed);

    const trainingDirective =
      profile?.trainingDirective ||
      "Build muscle, stay athletic, and fuel daily workouts properly.";
    const currentWeight = profile?.weightKg && profile.weightKg > 0 ? profile.weightKg : null;
    const targetWeight = profile?.targetWeightKg && profile.targetWeightKg > 0 ? profile.targetWeightKg : null;
    const height = profile?.heightCm && profile.heightCm > 0 ? profile.heightCm : null;

    let evaluation = {
      overallRating: 7.0,
      staminaScore: 6.0,
      hypertrophyScore: 7.0,
      assessmentSummary: `Target calibrated for today: ${adjustedCalorieTarget} kcal (${baselineCalories} baseline + ${activeBurn} active burn).`,
      actionAdvice: remainingCalories > 0
        ? `Consume ${Math.round(remainingCalories)} more kcal and ${Math.round(remainingProtein)}g protein to protect muscle growth.`
        : "You have met your daily calorie target.",
    };

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `You are a direct, pragmatic sports nutrition and training coach.
Analyze the user's logged day against their personal training directive and physical stats.

USER STATS & TRAINING DIRECTIVE:
- Current Weight: ${currentWeight ? `${currentWeight} kg` : "Not specified"}
- Target Weight: ${targetWeight ? `${targetWeight} kg` : "Not specified"}
- Height: ${height ? `${height} cm` : "Not specified"}
- User's Goal Directive: "${trainingDirective}"

TODAY'S ACTIVITY:
- Workouts Logged: ${
          todayWorkouts.length > 0
            ? JSON.stringify(
                todayWorkouts.map((w) => ({
                  type: w.workoutType,
                  durationMinutes: w.durationMinutes,
                  activeCalories: w.activeCalories,
                  totalVolumeKg: w.totalVolumeKg,
                  muscleGroups: w.muscleGroups,
                }))
              )
            : "No workouts logged yet today"
        }
- Total Workout Duration: ${totalWorkoutMinutes} minutes
- Total Active Workout Burn: ${activeBurn} kcal

TODAY'S NUTRITION & CALIBRATED TARGETS:
- Baseline Calorie Target: ${baselineCalories} kcal
- Calibrated Calorie Target (Baseline + Active Burn): ${adjustedCalorieTarget} kcal
- Calories Consumed: ${Math.round(caloriesConsumed)} kcal
- Remaining Calories to Hit Target: ${Math.round(remainingCalories)} kcal
- Baseline Protein Target: ${baselineProtein} g
- Protein Consumed: ${Math.round(proteinConsumed)} g
- Remaining Protein to Hit Target: ${Math.round(remainingProtein)} g

EVALUATION INSTRUCTIONS:
1. Rate the day honestly from 1.0 to 10.0 based on how well today's activity and food intake support the user's training directive.
2. Consider competing demands: e.g. if the user did high-endurance cardio (like 2-3 hours of tennis or soccer) while trying to gain pure muscle mass and get bigger, evaluate whether their food intake offset the calorie burn or put them in catabolic risk.
3. Keep the tone completely direct and realistic, like a knowledgeable training partner. Never use buzzwords or corporate marketing fluff.
4. Provide a 1-2 sentence assessment summary and a specific action advice.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ text: prompt }],
          config: {
            responseMimeType: "application/json",
            responseSchema: coachSchema,
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          evaluation = {
            overallRating: Number(parsed.overallRating?.toFixed(1) || 7.0),
            staminaScore: Number(parsed.staminaScore?.toFixed(1) || 6.0),
            hypertrophyScore: Number(parsed.hypertrophyScore?.toFixed(1) || 7.0),
            assessmentSummary: parsed.assessmentSummary,
            actionAdvice: parsed.actionAdvice,
          };
        }
      } catch (geminiError) {
        console.error("Gemini coach evaluation error, using fallback:", geminiError);
      }
    }

    return NextResponse.json({
      date: today,
      profile: {
        currentWeightKg: currentWeight,
        targetWeightKg: targetWeight,
        heightCm: height,
        trainingDirective,
      },
      intake: {
        consumedCalories: Math.round(caloriesConsumed),
        consumedProtein: Math.round(proteinConsumed),
        activeBurn,
        totalWorkoutMinutes,
      },
      targets: {
        baselineCalories,
        baselineProtein,
        adjustedCalorieTarget,
        remainingCalories: Math.round(remainingCalories),
        remainingProtein: Math.round(remainingProtein),
      },
      evaluation,
    });
  } catch (err: unknown) {
    const error = err as Error & { digest?: string };
    if (error.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw err;
    }
    console.error("Error in coach evaluation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate daily coach rating." },
      { status: 500 }
    );
  }
}
