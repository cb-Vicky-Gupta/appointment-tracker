import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 requires a driver adapter — there is no implicit connection from
// just a DATABASE_URL anymore. We create one pg.Pool and reuse it across the
// app (and across hot-reloads in dev) instead of opening a new pool per request.

declare global {
  var __pgPool: Pool | undefined;
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const pool =
    globalThis.__pgPool ??
    new Pool({ connectionString: process.env.DATABASE_URL });
  globalThis.__pgPool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
