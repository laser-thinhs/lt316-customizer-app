import path from "node:path";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/response";
import {
  assertNoExecutableContent,
  assertSupportedUpload,
  createAssetId,
  detectMime,
  ensureAssetDir,
  maxAssetSizeBytes,
  sanitizeFilename
} from "@/lib/assets";
import { AppError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const designJobId = form.get("designJobId");

    if (!(file instanceof File) || typeof designJobId !== "string") {
      throw new AppError("file and designJobId are required", 400, "INVALID_UPLOAD");
    }

    if (file.size > maxAssetSizeBytes()) {
      throw new AppError("File too large", 400, "MAX_FILE_SIZE_EXCEEDED");
    }

    const sanitized = sanitizeFilename(file.name);
    assertSupportedUpload(sanitized, file.type);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    assertNoExecutableContent(buffer);

    const detected = detectMime(buffer, path.extname(sanitized));
    if (!detected || detected !== file.type) {
      throw new AppError("MIME mismatch", 400, "MIME_MISMATCH");
    }

    const assetId = createAssetId();
    const dir = await ensureAssetDir(assetId);
    const originalPath = path.join(dir, `original${path.extname(sanitized).toLowerCase()}`);
    await fs.writeFile(originalPath, buffer);

    const asset = await prisma.asset.create({
      data: {
        id: assetId,
        designJobId,
        kind: "original",
        mimeType: detected,
        filePath: originalPath
      }
    });

    return ok(asset, 201);
  } catch (error) {
    return fail(error);
  }
}
