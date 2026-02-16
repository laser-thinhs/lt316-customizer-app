import path from "node:path";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  asAssetPublicUrl,
  assertNoExecutableContent,
  assertSupportedUpload,
  buildStoredAssetFilename,
  createAssetId,
  detectMime,
  ensureAssetStorageDir,
  extractImageDimensions,
  maxAssetSizeBytes
} from "@/lib/assets";

export type AssetResponse = {
  id: string;
  designJobId: string;
  kind: string;
  filename: string;
  mime: string;
  bytes: number | null;
  originalName: string | null;
  mimeType: string;
  byteSize: number | null;
  widthPx: number | null;
  heightPx: number | null;
  url: string;
  path: string;
  createdAt: string;
};

export function toAssetResponse(asset: {
  id: string;
  designJobId: string;
  kind: string;
  originalName: string | null;
  mimeType: string;
  byteSize: number | null;
  widthPx: number | null;
  heightPx: number | null;
  filePath: string;
  createdAt: Date;
}): AssetResponse {
  return {
    id: asset.id,
    designJobId: asset.designJobId,
    kind: asset.kind,
    filename: asset.originalName ?? `${asset.id}.bin`,
    mime: asset.mimeType,
    bytes: asset.byteSize,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    widthPx: asset.widthPx,
    heightPx: asset.heightPx,
    url: asAssetPublicUrl(asset.id),
    path: asset.filePath,
    createdAt: asset.createdAt.toISOString()
  };
}

export async function createAssetFromUpload(input: { designJobId: string; file: File }) {
  const { designJobId, file } = input;

  const job = await prisma.designJob.findUnique({ where: { id: designJobId }, select: { id: true } });
  if (!job) {
    throw new AppError("designJobId does not exist.", 404, "DESIGN_JOB_NOT_FOUND");
  }

  if (file.size > maxAssetSizeBytes()) {
    throw new AppError("File exceeds 10 MB limit.", 400, "MAX_FILE_SIZE_EXCEEDED");
  }

  assertSupportedUpload(file.name, file.type);

  const buffer = Buffer.from(await file.arrayBuffer());
  assertNoExecutableContent(buffer);

  const detected = detectMime(buffer, path.extname(file.name));
  if (!detected) {
    throw new AppError("Unsupported file signature for provided extension.", 400, "UNSUPPORTED_FILE_TYPE");
  }

  if (detected !== file.type) {
    throw new AppError(
      `File MIME type mismatch. Expected ${detected} but received ${file.type}.`,
      400,
      "MIME_MISMATCH"
    );
  }

  const assetId = createAssetId();
  const dir = await ensureAssetStorageDir(designJobId, assetId);
  const fileName = buildStoredAssetFilename(assetId, file.name);
  const filePath = path.join(dir, fileName);

  await fs.writeFile(filePath, buffer);
  const dimensions = extractImageDimensions(buffer, detected);

  const asset = await prisma.asset.create({
    data: {
      id: assetId,
      designJobId,
      kind: "original",
      originalName: file.name,
      mimeType: detected,
      byteSize: file.size,
      filePath,
      widthPx: dimensions?.widthPx,
      heightPx: dimensions?.heightPx
    }
  });

  return toAssetResponse(asset);
}

export async function listDesignJobAssets(designJobId: string): Promise<AssetResponse[]> {
  const assets = await prisma.asset.findMany({
    where: { designJobId },
    orderBy: { createdAt: "asc" }
  });

  return assets.map(toAssetResponse);
}

export async function listAssetsByJobId(designJobId: string): Promise<AssetResponse[]> {
  const assets = await prisma.asset.findMany({
    where: { designJobId },
    orderBy: { createdAt: "desc" }
  });

  return assets.map(toAssetResponse);
}

export async function renameAsset(assetId: string, filename: string): Promise<AssetResponse> {
  const trimmed = filename.trim();
  if (!trimmed) {
    throw new AppError("Filename is required.", 400, "INVALID_FILENAME");
  }

  const existing = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!existing) {
    throw new AppError("Asset not found", 404, "NOT_FOUND");
  }

  const next = await prisma.asset.update({
    where: { id: assetId },
    data: { originalName: trimmed }
  });

  return toAssetResponse(next);
}

export async function deleteAsset(assetId: string): Promise<void> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new AppError("Asset not found", 404, "NOT_FOUND");
  }

  await prisma.asset.delete({ where: { id: assetId } });

  try {
    await fs.unlink(asset.filePath);
  } catch {
    // Ignore missing files because the database entry is the source of truth.
  }
}
