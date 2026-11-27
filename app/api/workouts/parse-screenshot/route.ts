import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "@/app/lib/prisma";

const workoutSchema = {
  type: Type.OBJECT,
  properties: {
    workoutType: {
      type: Type.STRING,
      description:
        "The specific workout or sport type, e.g. 'Outdoor Run', 'Traditional Strength Training', 'Indoor Cycling', 'HIIT', 'Pool Swim', 'Functional Strength Training', 'Walk', etc.",
    },
    date: {
      type: Type.STRING,
      description:
        "The date the workout occurred in YYYY-MM-DD format if visible on the screenshots. If only day/time or relative date is shown, estimate or leave empty.",
    },
    activeCalories: {
      type: Type.INTEGER,
      description:
        "Active calories or active energy burned in kcal as a rounded integer.",
    },
    totalCalories: {
      type: Type.INTEGER,
      description:
        "Total calories / total energy burned in kcal as a rounded integer. If not separately displayed, set equal to activeCalories.",
    },
    durationMinutes: {
      type: Type.INTEGER,
      description:
        "Total workout duration in whole minutes (e.g., '35:20' -> 35 minutes, '1 hr 12 min' -> 72 minutes). Must be an integer >= 1.",
    },
    avgHeartRate: {
      type: Type.INTEGER,
      description:
        "Average heart rate in BPM (beats per minute) as an integer if shown, or null if not available.",
    },
    totalVolumeKg: {
      type: Type.INTEGER,
      description:
        "Total weight/volume lifted in kg if visible in a strength workout summary (e.g. Hevy, Strong, Apple Fitness), or null.",
    },
    muscleGroups: {
      type: Type.STRING,
      description:
        "Primary muscle groups targeted if visible or deducible from exercises (e.g., 'Back, Biceps' or 'Chest, Triceps' or 'Quads, Hamstrings'), or empty string.",
    },
    summary: {
      type: Type.STRING,
      description:
        "A concise 1-2 sentence description explaining what was extracted across the provided screenshot(s).",
    },
  },
  required: [
    "workoutType",
    "activeCalories",
    "totalCalories",
    "durationMinutes",
  ],
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your .env.local file.",
        },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    
    // Accept multiple files from 'files' or 'file' form fields
    const rawEntries = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ];
    const files: File[] = rawEntries.filter(
      (item): item is File => typeof item !== "string" && typeof item === "object" && "arrayBuffer" in item
    );

    const saveParam =
      req.nextUrl.searchParams.get("save") ?? formData.get("save");
    const shouldSave = saveParam !== "false" && saveParam !== "0";

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No image file provided. Please upload at least one screenshot." },
        { status: 400 }
      );
    }

    // Process all images to base64 parts
    const imageParts = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: file.type || "image/png",
          },
        };
      })
    );

    const ai = new GoogleGenAI({ apiKey });
    const todayDate = new Date().toISOString().slice(0, 10);

    const promptText = `You are an expert fitness data extractor.
Analyze the ${files.length} uploaded fitness app workout summary screenshot(s) (such as Apple Fitness, Garmin Connect, Strava, Hevy, Strong, Fitbod, Samsung Health, Whoop, or similar).
Note: The user may have uploaded multiple screenshots of the SAME workout (for example, scrolling down to capture calories/duration, or sets/exercises/volume).
Synthesize all the details across all ${files.length} screenshot(s) into one single, cohesive workout record:
- Identify the activity type (workoutType).
- Extract active calories burned and total calories burned.
- Extract the total workout duration in whole minutes.
- Extract average heart rate in BPM if visible anywhere in the images.
- If this is a resistance or strength training workout with exercises or volume shown (e.g., bench press, cable rows, lat pulldowns), extract total volume in kg if stated, and identify the primary muscle groups trained (e.g. "Back, Biceps" or "Chest, Shoulders, Triceps" or "Legs").
- Extract the workout date in YYYY-MM-DD format if visible; if not displayed or unclear, use today's date: ${todayDate}.
Ensure numerical values are integers. Ensure duration is total whole minutes.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        ...imageParts,
        {
          text: promptText,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: workoutSchema,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json(
        { error: "Gemini Vision returned an empty response." },
        { status: 502 }
      );
    }

    const parsedData = JSON.parse(responseText);

    const date =
      parsedData.date && /^\d{4}-\d{2}-\d{2}$/.test(parsedData.date)
        ? parsedData.date
        : todayDate;

    const parsedWorkout = {
      date,
      workoutType: String(parsedData.workoutType || "Workout").trim(),
      activeCalories: Math.max(0, Math.round(Number(parsedData.activeCalories) || 0)),
      totalCalories: Math.max(
        0,
        Math.round(
          Number(parsedData.totalCalories) ||
            Number(parsedData.activeCalories) ||
            0
        )
      ),
      durationMinutes: Math.max(
        1,
        Math.round(Number(parsedData.durationMinutes) || 1)
      ),
      avgHeartRate: parsedData.avgHeartRate
        ? Math.round(Number(parsedData.avgHeartRate))
        : null,
      totalVolumeKg: parsedData.totalVolumeKg
        ? Math.round(Number(parsedData.totalVolumeKg))
        : null,
      muscleGroups: parsedData.muscleGroups
        ? String(parsedData.muscleGroups).trim()
        : null,
      rawSummary: parsedData.summary || responseText,
    };

    if (shouldSave) {
      const workoutLog = await prisma.workoutLog.create({
        data: parsedWorkout,
      });
      return NextResponse.json({ workoutLog });
    }

    return NextResponse.json({ parsed: parsedWorkout });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error in parse-screenshot:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to parse workout screenshot.",
      },
      { status: 500 }
    );
  }
}
