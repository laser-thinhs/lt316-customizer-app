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
  ensureDesignJobAssetDir,
  extractImageDimensions,
  maxAssetSizeBytes
} from "@/lib/assets";

export type AssetResponse = {
  id: string;
  designJobId: string;
  kind: string;
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
    throw new AppError("File exceeds 15 MB limit.", 400, "MAX_FILE_SIZE_EXCEEDED");
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
  const dir = await ensureDesignJobAssetDir(designJobId);
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
