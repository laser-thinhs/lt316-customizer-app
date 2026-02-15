import { prisma } from "@/lib/prisma";

let startupChecksRan = false;

export function assertDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Missing required DATABASE_URL. Set DATABASE_URL in your .env file before starting the app."
    );
  }
}

export async function assertDatabaseConnectivity() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DB error";
    throw new Error(`Database connectivity check failed: ${message}`);
  }
}

export async function runStartupChecks() {
  if (startupChecksRan) return;

  assertDatabaseUrl();
  await assertDatabaseConnectivity();
  startupChecksRan = true;
}
