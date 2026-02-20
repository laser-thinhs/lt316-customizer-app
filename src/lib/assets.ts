import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors";

const ALLOWED_EXTENSIONS = new Set([".svg"]);
const ALLOWED_MIME = new Set(["image/svg+xml"]);

export type UploadMime = "image/svg+xml" | "image/png" | "image/jpeg" | "image/webp";

type ImageDimensions = {
  widthPx: number;
  heightPx: number;
};

export function storageRoot() {
  return path.resolve(process.cwd(), process.env.STORAGE_ROOT ?? "./storage");
}

export function maxAssetSizeBytes() {
  return 10 * 1024 * 1024;
}

export function sanitizeFilename(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "_");
  const compacted = cleaned.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return compacted.slice(0, 120) || "upload";
}

export function assertSupportedUpload(fileName: string, mimeType: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME.has(mimeType)) {
    throw new AppError(
      "SVG-only for now; raster support coming next.",
      400,
      "UNSUPPORTED_FILE_TYPE"
    );
  }
}

export function assertNoExecutableContent(buffer: Buffer) {
  const header = buffer.subarray(0, 256).toString("utf8").toLowerCase();
  if (header.startsWith("#!") || header.includes("<script")) {
    throw new AppError("Executable content is not allowed", 400, "UNSAFE_CONTENT");
  }

  // For SVG specifically, check for dangerous attributes during upload
  if (buffer.toString("utf8").match(/<svg/i)) {
    const content = buffer.toString("utf8", 0, Math.min(buffer.length, 50000)).toLowerCase();
    const dangerousPatterns = [
      /on[a-z]+\s*=/i,           // Event handlers
      /javascript:/i,             // JavaScript protocol
      /<script/i,                 // Script tags
      /<iframe/i,                 // Iframe tags
      /<embed/i,                  // Embed tags
      /<object/i,                 // Object tags
      /(?:data|src):[^/](?!image)/i  // Non-image data URIs
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        throw new AppError(
          "SVG contains potentially dangerous content (scripts, event handlers, etc.)",
          400,
          "UNSAFE_SVG_CONTENT"
        );
      }
    }
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

export function createAssetId() {
  return randomUUID();
}

export async function ensureDesignJobAssetDir(designJobId: string) {
  const dir = path.join(storageRoot(), "design-jobs", designJobId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureAssetStorageDir(designJobId: string, assetId: string) {
  const dir = path.join(storageRoot(), "design-jobs", designJobId, assetId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function buildStoredAssetFilename(assetId: string, originalName: string) {
  return `${assetId}-${sanitizeFilename(originalName)}`;
}

export function asAssetPublicUrl(assetId: string) {
  return `/api/assets/${assetId}`;
}

export function extractImageDimensions(buffer: Buffer, mimeType: UploadMime): ImageDimensions | null {
  if (mimeType === "image/png") {
    if (buffer.length < 24) return null;
    return { widthPx: buffer.readUInt32BE(16), heightPx: buffer.readUInt32BE(20) };
  }

  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      const isSofMarker =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSofMarker) {
        return {
          heightPx: buffer.readUInt16BE(offset + 5),
          widthPx: buffer.readUInt16BE(offset + 7)
        };
      }
      offset += 2 + length;
    }
    return null;
  }

  if (mimeType === "image/webp") {
    if (buffer.length < 30) return null;
    const format = buffer.toString("ascii", 12, 16);
    if (format === "VP8X") {
      return {
        widthPx: 1 + buffer.readUIntLE(24, 3),
        heightPx: 1 + buffer.readUIntLE(27, 3)
      };
    }

    if (format === "VP8 ") {
      return {
        widthPx: buffer.readUInt16LE(26) & 0x3fff,
        heightPx: buffer.readUInt16LE(28) & 0x3fff
      };
    }

    if (format === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return {
        widthPx: (bits & 0x3fff) + 1,
        heightPx: ((bits >> 14) & 0x3fff) + 1
      };
    }
  }

  if (mimeType === "image/svg+xml") {
    const source = buffer.toString("utf8", 0, Math.min(buffer.length, 8_000));
    const widthMatch = source.match(/\bwidth\s*=\s*"([0-9.]+)(px)?"/i);
    const heightMatch = source.match(/\bheight\s*=\s*"([0-9.]+)(px)?"/i);
    if (widthMatch && heightMatch) {
      return { widthPx: Number(widthMatch[1]), heightPx: Number(heightMatch[1]) };
    }

    const viewBoxMatch = source.match(/\bviewBox\s*=\s*"[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"/i);
    if (viewBoxMatch) {
      return { widthPx: Number(viewBoxMatch[1]), heightPx: Number(viewBoxMatch[2]) };
    }
  }

  return null;
}

export function normalizeSvg(source: string): string {
  return source
    // Remove script tags and their content entirely
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    // Remove inline event handlers with or without quotes
    .replace(/on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/on[a-z]+\s*=\s*[^\s>]*/gi, "")
    // Remove style tags
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    // Remove dangerous attributes in iframes, embeds, and objects
    .replace(/<(iframe|embed|object|applet)[^>]*>/gi, "")
    // Remove href/xlink:href with javascript: protocol
    .replace(/(?:href|xlink:href)\s*=\s*["']?javascript:[^"'>\s]*["']?/gi, "")
    // Remove data: URIs that aren't data:image/ (potential vectors for execution)
    .replace(/(?:src|href|xlink:href)\s*=\s*["']?data:(?!image\/)([^"'>\s])*["']?/gi, "")
    .trim();
}
