import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../app/generated/prisma/client";
import path from "path";

const dbUrl = `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url: dbUrl });
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  await prisma.userProfile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      weightKg: 0,
      heightCm: 0,
      dailyCalorieTarget: null,
      dailyProteinTarget: null,
      tsomMode: false,
    },
  });

  console.log("✅ Seed complete: 1 UserProfile");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
