import { z } from "zod";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const DEFAULT_MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 10);
const DEFAULT_MAX_DIMENSION = Number(process.env.MAX_DIMENSION ?? 2000);
const DEFAULT_MIN_SPECK_AREA = Number(process.env.MIN_SPECK_AREA ?? 6);

export type CoreError = {
  code: string;
  message: string;
  details?: unknown;
};

export class TracerCoreError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }

  toJSON(): CoreError {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export const TracerSettingsSchema = z.object({
  mode: z.enum(["auto", "bw", "color"]).default("auto"),
  threshold: z.number().int().min(0).max(255).default(165),
  smoothing: z.number().min(0).max(20).default(2),
  despeckle: z.number().min(0).max(20).default(3),
  simplify: z.number().min(0).max(20).default(2),
  invert: z.boolean().default(false),
  removeBackground: z.boolean().default(true),
  bgTolerance: z.number().int().min(0).max(255).default(18),
  output: z.enum(["fill", "stroke"]).default("fill"),
  strokeWidth: z.number().min(0.1).max(20).optional(),
  outlineMode: z.boolean().default(false),
  minSpeckArea: z.number().min(0).default(DEFAULT_MIN_SPECK_AREA)
}).transform((input) => ({
  ...input,
  strokeWidth: input.output === "stroke" || input.outlineMode ? (input.strokeWidth ?? 1) : input.strokeWidth
}));

export type TracerSettings = z.infer<typeof TracerSettingsSchema>;

export type TraceResult = {
  svg: string;
  width: number;
  height: number;
  viewBox: string;
  stats: {
    elapsedMs: number;
    fallback: boolean;
    pathsRemoved: number;
    modeUsed: TracerSettings["mode"];
  };
};

function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (!marker || marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function getDimensions(buffer: Buffer, mime: string) {
  if (mime === "image/png") {
    return readPngDimensions(buffer);
  }
  if (mime === "image/jpeg") {
    return readJpegDimensions(buffer);
  }
  return null;
}

function toPathBBox(pathD: string): { area: number } {
  const values = pathD.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  if (values.length < 4) {
    return { area: Number.POSITIVE_INFINITY };
  }

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < values.length - 1; i += 2) {
    xs.push(values[i]);
    ys.push(values[i + 1]);
  }

  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return { area: Math.max(width * height, 0) };
}

export function normalizeSvg(rawSvg: string, width: number, height: number, minSpeckArea = DEFAULT_MIN_SPECK_AREA): { svg: string; pathsRemoved: number } {
  let svg = rawSvg
    .replace(/<\/?metadata[^>]*>/gi, "")
    .replace(/<\/?title[^>]*>/gi, "")
    .replace(/<\/?desc[^>]*>/gi, "")
    .replace(/\s(width|height)="([0-9.]+)(pt|cm|mm|in)"/gi, (_m, key, val) => ` ${key}="${val}px"`);

  const hasViewBox = /viewBox=/i.test(svg);
  if (!hasViewBox) {
    svg = svg.replace(/<svg\b/i, `<svg viewBox=\"0 0 ${width} ${height}\"`);
  }

  svg = svg
    .replace(/\swidth="[^"]*"/i, ` width="${width}px"`)
    .replace(/\sheight="[^"]*"/i, ` height="${height}px"`);

  let pathsRemoved = 0;
  svg = svg.replace(/<path\b[^>]*d="([^"]+)"[^>]*\/?>(?:<\/path>)?/gi, (full, d) => {
    const bbox = toPathBBox(d);
    if (bbox.area < minSpeckArea) {
      pathsRemoved += 1;
      return "";
    }
    return full;
  });

  return { svg, pathsRemoved };
}

export function normalizeTracerError(error: unknown): CoreError {
  if (error instanceof TracerCoreError) {
    return error.toJSON();
  }

  return {
    code: "TRACE_INTERNAL_ERROR",
    message: "Failed to trace image"
  };
}

function buildFallbackSvg(width: number, height: number, settings: TracerSettings, buffer: Buffer, mime: string) {
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
  const strokeOnly = settings.output === "stroke" || settings.outlineMode;
  if (strokeOnly) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}px" height="${height}px" viewBox="0 0 ${width} ${height}"><rect x="0.5" y="0.5" width="${Math.max(width - 1, 1)}" height="${Math.max(height - 1, 1)}" fill="none" stroke="black" stroke-width="${settings.strokeWidth ?? 1}"/></svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}px" height="${height}px" viewBox="0 0 ${width} ${height}"><image href="${dataUri}" width="${width}" height="${height}" /></svg>`;
}

export async function traceRasterToSvg(
  input: { buffer: Buffer; mime: string; filename?: string },
  settingsInput: unknown
): Promise<TraceResult> {
  const started = Date.now();
  const maxUploadBytes = DEFAULT_MAX_UPLOAD_MB * 1024 * 1024;
  const allowedMime = new Set(["image/png", "image/jpeg"]);

  if (!allowedMime.has(input.mime)) {
    throw new TracerCoreError("UNSUPPORTED_MIME", "Only PNG and JPEG uploads are allowed", { mime: input.mime });
  }

  if (input.buffer.byteLength > maxUploadBytes) {
    throw new TracerCoreError("FILE_TOO_LARGE", `File exceeds ${DEFAULT_MAX_UPLOAD_MB}MB limit`, {
      limitMb: DEFAULT_MAX_UPLOAD_MB,
      sizeBytes: input.buffer.byteLength
    });
  }

  const parsedSettings = TracerSettingsSchema.safeParse(settingsInput ?? {});
  if (!parsedSettings.success) {
    throw new TracerCoreError("INVALID_SETTINGS", "Invalid tracer settings", parsedSettings.error.flatten());
  }

  const settings = parsedSettings.data;
  const dimensions = getDimensions(input.buffer, input.mime);
  if (!dimensions) {
    throw new TracerCoreError("INVALID_IMAGE", "Unable to parse image dimensions");
  }

  if (dimensions.width > DEFAULT_MAX_DIMENSION || dimensions.height > DEFAULT_MAX_DIMENSION) {
    throw new TracerCoreError("DIMENSION_LIMIT_EXCEEDED", `Max dimension is ${DEFAULT_MAX_DIMENSION}px`, {
      width: dimensions.width,
      height: dimensions.height,
      maxDimension: DEFAULT_MAX_DIMENSION
    });
  }

  const rawSvg = buildFallbackSvg(dimensions.width, dimensions.height, settings, input.buffer, input.mime);
  const normalized = normalizeSvg(rawSvg, dimensions.width, dimensions.height, settings.minSpeckArea);

  return {
    svg: normalized.svg,
    width: dimensions.width,
    height: dimensions.height,
    viewBox: `0 0 ${dimensions.width} ${dimensions.height}`,
    stats: {
      elapsedMs: Date.now() - started,
      fallback: true,
      pathsRemoved: normalized.pathsRemoved,
      modeUsed: settings.mode
    }
  };
}
