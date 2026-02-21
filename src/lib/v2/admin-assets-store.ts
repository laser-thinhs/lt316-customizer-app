import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AdminAssetRecord, AdminAssetType } from "@/core/v2/types";
import { adminAssetsRoot, adminDataRoot, atomicWriteJson, ensureDir, readJsonFile, withFsRetries } from "@/lib/admin-storage";

const indexPath = path.join(adminDataRoot, "assets.json");

type AssetIndexDocument = { assets: AdminAssetRecord[] };

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export function detectAdminAssetType(filename: string): AdminAssetType {
  const value = filename.toLowerCase();
  if (/(lightburn|lbdev|lbprefs|material|library)/.test(value) || /\.(clb|lbdev|lbprefs|lbrn2)$/i.test(value)) {
    return "lightburn-system";
  }
  if (/(hatch|fill|pattern)/.test(value) || /\.(json|xml|csv|lbht)$/i.test(value)) {
    return "hatch-library";
  }
  return "other";
}

async function readAssetIndex() {
  await ensureDir(adminDataRoot);
  const doc = await readJsonFile<AssetIndexDocument>(indexPath);
  return doc?.assets ?? [];
}

async function writeAssetIndex(assets: AdminAssetRecord[]) {
  await atomicWriteJson(indexPath, { assets });
}

export async function addAdminAsset(file: File) {
  const id = `asset_${randomUUID().slice(0, 10)}`;
  const type = detectAdminAssetType(file.name);
  const filename = `${id}_${safeName(file.name)}`;
  const bucket = path.join(adminAssetsRoot, type);
  await ensureDir(bucket);
  const absolutePath = path.join(bucket, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await withFsRetries(() => fs.writeFile(absolutePath, buffer));
  const record: AdminAssetRecord = {
    id,
    type,
    originalFilename: file.name,
    storedPath: absolutePath,
    createdAt: new Date().toISOString()
  };
  const assets = await readAssetIndex();
  await writeAssetIndex([record, ...assets]);
  return record;
}

export async function listAdminAssets(type?: AdminAssetType) {
  const assets = await readAssetIndex();
  return typeof type === "string" ? assets.filter((item) => item.type === type) : assets;
}
