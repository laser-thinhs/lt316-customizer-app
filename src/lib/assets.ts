import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors";

export const ASSET_ROOT = path.join(process.cwd(), "storage", "assets");

const ALLOWED_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
const ALLOWED_MIME = new Set(["image/svg+xml", "image/png", "image/jpeg", "image/webp"]);

export type UploadMime = "image/svg+xml" | "image/png" | "image/jpeg" | "image/webp";

export function maxAssetSizeBytes() {
  const raw = process.env.ASSET_UPLOAD_MAX_BYTES;
  const parsed = raw ? Number(raw) : 10 * 1024 * 1024;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 1024 * 1024;
}

export function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export function assertSupportedUpload(fileName: string, mimeType: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME.has(mimeType)) {
    throw new AppError("Unsupported file type", 400, "UNSUPPORTED_FILE_TYPE");
  }
}

export function assertNoExecutableContent(buffer: Buffer) {
  const header = buffer.subarray(0, 8).toString("utf8").toLowerCase();
  if (header.startsWith("#!") || header.includes("<script")) {
    throw new AppError("Executable content is not allowed", 400, "UNSAFE_CONTENT");
  }
}

export function detectMime(buffer: Buffer, ext: string): UploadMime | null {
  const lowerExt = ext.toLowerCase();
  const sig = buffer.subarray(0, 12);
  if (lowerExt === ".svg" && buffer.toString("utf8", 0, 300).includes("<svg")) return "image/svg+xml";
  if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47) return "image/png";
  if (sig[0] === 0xff && sig[1] === 0xd8) return "image/jpeg";
  if (sig.toString("utf8", 0, 4) === "RIFF" && sig.toString("utf8", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function ensureAssetDir(assetId: string) {
  const dir = path.join(ASSET_ROOT, assetId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function createAssetId() {
  return randomUUID();
}

export function normalizeSvg(source: string): string {
  return source
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/on[a-z]+\s*=\s*'[^']*'/gi, "")
    .trim();
}
