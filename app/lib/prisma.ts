import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/app/generated/prisma/client";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GlobalWithPrisma = typeof globalThis & { prisma?: any };

function createPrismaClient() {
  const dbUrl = `file:${path.resolve(process.cwd(), "dev.db")}`;
  const adapter = new PrismaLibSql({ url: dbUrl });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

const globalForPrisma = globalThis as GlobalWithPrisma;

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
