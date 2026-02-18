import { promises as fs } from "node:fs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { requireApiRole } from "@/lib/api-auth";
import { deleteAsset, renameAsset } from "@/services/asset.service";

const renameSchema = z.object({
  filename: z.string().min(1)
});

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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const { id } = await params;
    const parsed = renameSchema.parse(await request.json());
    const asset = await renameAsset(id, parsed.filename);
    return ok(asset);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const { id } = await params;
    await deleteAsset(id);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
