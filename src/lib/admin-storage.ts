import path from "node:path";
import { atomicWriteJson, ensureDir, readJsonFile, withFsRetries } from "@/lib/v2/storage";

export const adminDataRoot = path.join(process.cwd(), "data", "admin");
export const adminAssetsRoot = path.join(process.cwd(), "data", "admin-assets");

export async function ensureAdminDataRoot() {
  await ensureDir(adminDataRoot);
}

export { atomicWriteJson, readJsonFile, withFsRetries, ensureDir };
