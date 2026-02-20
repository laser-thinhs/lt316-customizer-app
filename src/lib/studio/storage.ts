import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { AppError } from "@/lib/errors";
import { studioLayoutSchema, StudioLayout } from "@/studio/types";

const layoutsDir = path.join(process.cwd(), "data", "studio-layouts");

function sanitizeId(raw: string) {
  const id = raw.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,80}$/.test(id)) {
    throw new AppError("Invalid layout id", 400, "INVALID_LAYOUT_ID");
  }
  return id;
}

function layoutFilePath(id: string) {
  return path.join(layoutsDir, `${sanitizeId(id)}.json`);
}

async function maybePrisma() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "StudioLayout" (id TEXT PRIMARY KEY, name TEXT NOT NULL, json JSONB NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`
    );
    return prisma;
  } catch {
    return null;
  }
}

async function listFromDb() {
  const prisma = await maybePrisma();
  if (!prisma) return null;

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, name, json, "updatedAt" FROM "StudioLayout" ORDER BY "updatedAt" DESC`
  )) as Array<{ id: string; name: string; json: unknown; updatedAt: Date }>;

  return rows.map((row) => ({ id: row.id, name: row.name, updatedAt: row.updatedAt.toISOString() }));
}

export async function listStudioLayouts() {
  const fromDb = await listFromDb();
  if (fromDb) return fromDb;

  await fs.mkdir(layoutsDir, { recursive: true });
  const files = await fs.readdir(layoutsDir);
  const items = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const fullPath = path.join(layoutsDir, file);
        const stat = await fs.stat(fullPath);
        const parsed = JSON.parse(await fs.readFile(fullPath, "utf8")) as Partial<StudioLayout>;
        return {
          id: file.replace(/\.json$/, ""),
          name: parsed.name ?? file.replace(/\.json$/, ""),
          updatedAt: stat.mtime.toISOString()
        };
      })
  );

  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getStudioLayout(id: string): Promise<StudioLayout> {
  const normalizedId = sanitizeId(id);
  const prisma = await maybePrisma();
  if (prisma) {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT id, name, json FROM "StudioLayout" WHERE id = $1 LIMIT 1`,
      normalizedId
    )) as Array<{ id: string; name: string; json: unknown }>;

    if (rows[0]) {
      return studioLayoutSchema.parse({ id: rows[0].id, name: rows[0].name, blocks: (rows[0].json as { blocks?: unknown }).blocks });
    }
  }

  const filePath = layoutFilePath(normalizedId);
  try {
    return studioLayoutSchema.parse(JSON.parse(await fs.readFile(filePath, "utf8")));
  } catch {
    return { id: normalizedId, name: normalizedId, blocks: [] };
  }
}

export async function saveStudioLayout(id: string, input: unknown): Promise<StudioLayout> {
  const normalizedId = sanitizeId(id);
  const parsed = studioLayoutSchema.parse(input);
  if (parsed.id !== normalizedId) {
    throw new AppError("Layout id mismatch", 400, "LAYOUT_ID_MISMATCH");
  }

  const prisma = await maybePrisma();
  if (prisma) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "StudioLayout" (id, name, json, "updatedAt") VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, json = EXCLUDED.json, "updatedAt" = NOW()`,
      parsed.id,
      parsed.name,
      JSON.stringify({ blocks: parsed.blocks })
    );
    return parsed;
  }

  await fs.mkdir(layoutsDir, { recursive: true });
  await fs.writeFile(layoutFilePath(normalizedId), JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}
