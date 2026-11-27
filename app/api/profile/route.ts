import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    let profile = await prisma.userProfile.findFirst({ where: { id: 1 } });
    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          id: 1,
          weightKg: 0,
          heightCm: 0,
          targetWeightKg: null,
          trainingDirective: null,
          dailyCalorieTarget: 2200,
          dailyProteinTarget: 140,
          tsomMode: false,
        },
      });
    }
    return NextResponse.json({ profile });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      weightKg,
      heightCm,
      targetWeightKg,
      trainingDirective,
      dailyCalorieTarget,
      dailyProteinTarget,
      tsomMode,
    } = body;

    const profile = await prisma.userProfile.upsert({
      where: { id: 1 },
      update: {
        ...(weightKg !== undefined && { weightKg: Number(weightKg) }),
        ...(heightCm !== undefined && { heightCm: Number(heightCm) }),
        ...(targetWeightKg !== undefined && {
          targetWeightKg: targetWeightKg ? Number(targetWeightKg) : null,
        }),
        ...(trainingDirective !== undefined && {
          trainingDirective: trainingDirective ? String(trainingDirective) : null,
        }),
        ...(dailyCalorieTarget !== undefined && {
          dailyCalorieTarget: dailyCalorieTarget ? Math.round(Number(dailyCalorieTarget)) : null,
        }),
        ...(dailyProteinTarget !== undefined && {
          dailyProteinTarget: dailyProteinTarget ? Math.round(Number(dailyProteinTarget)) : null,
        }),
        ...(tsomMode !== undefined && { tsomMode: Boolean(tsomMode) }),
      },
      create: {
        id: 1,
        weightKg: weightKg ? Number(weightKg) : 0,
        heightCm: heightCm ? Number(heightCm) : 0,
        targetWeightKg: targetWeightKg ? Number(targetWeightKg) : null,
        trainingDirective: trainingDirective ? String(trainingDirective) : null,
        dailyCalorieTarget: dailyCalorieTarget ? Math.round(Number(dailyCalorieTarget)) : 2200,
        dailyProteinTarget: dailyProteinTarget ? Math.round(Number(dailyProteinTarget)) : 140,
        tsomMode: Boolean(tsomMode || false),
      },
    });

    return NextResponse.json({ profile });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update profile." },
      { status: 500 }
    );
  }
}
