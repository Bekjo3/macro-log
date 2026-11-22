import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const workouts = await prisma.workoutLog.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    return NextResponse.json({ workouts });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error fetching workouts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch workouts." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      date,
      workoutType,
      activeCalories,
      totalCalories,
      durationMinutes,
      avgHeartRate,
      rawSummary,
    } = body;

    if (!workoutType || activeCalories === undefined || durationMinutes === undefined) {
      return NextResponse.json(
        { error: "Missing required workout fields." },
        { status: 400 }
      );
    }

    const todayDate = new Date().toISOString().slice(0, 10);

    const workoutLog = await prisma.workoutLog.create({
      data: {
        date: date || todayDate,
        workoutType: String(workoutType),
        activeCalories: Math.max(0, Math.round(Number(activeCalories) || 0)),
        totalCalories: Math.max(
          0,
          Math.round(Number(totalCalories) || Number(activeCalories) || 0)
        ),
        durationMinutes: Math.max(1, Math.round(Number(durationMinutes) || 1)),
        avgHeartRate: avgHeartRate ? Math.round(Number(avgHeartRate)) : null,
        rawSummary: rawSummary || "Manually saved parsed workout",
      },
    });

    return NextResponse.json({ workoutLog }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error saving workout:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save workout." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const idParam = req.nextUrl.searchParams.get("id");
    if (!idParam) {
      return NextResponse.json(
        { error: "Missing 'id' parameter." },
        { status: 400 }
      );
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid 'id'." }, { status: 400 });
    }

    await prisma.workoutLog.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error deleting workout:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete workout." },
      { status: 500 }
    );
  }
}
