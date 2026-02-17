import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

let startupChecksRan = false;

export function assertDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new AppError(
      "Database configuration missing. Set DATABASE_URL.",
      500,
      "DATABASE_URL_MISSING"
    );
  }
}

export async function assertDatabaseConnectivity() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DB error";
    throw new AppError(
      "Database connectivity check failed. Verify DATABASE_URL points to a reachable database.",
      503,
      "DATABASE_CONNECTIVITY_ERROR",
      { reason: message }
    );
  }
}

export async function runStartupChecks() {
  if (startupChecksRan) return;

  try {
    assertDatabaseUrl();
    await assertDatabaseConnectivity();
    startupChecksRan = true;
  } catch (error) {
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    const skipCheck = process.env.SKIP_STARTUP_DB_CHECK === "1";

    if (isBuildPhase || skipCheck) {
      console.warn("Startup database check skipped during build/override:", error);
      startupChecksRan = true;
      return;
    }

    throw error;
  }
}
