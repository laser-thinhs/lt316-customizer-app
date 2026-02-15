import { promises as fs } from "node:fs";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new AppError("Asset not found", 404, "NOT_FOUND");

    const payload = await fs.readFile(asset.filePath);
    return new Response(payload, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return fail(error);
  }
}
