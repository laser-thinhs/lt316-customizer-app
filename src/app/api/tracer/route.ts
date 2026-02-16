import { randomUUID } from "node:crypto";
import { normalizeTracerError, traceRasterToSvg } from "../../../../lib/tracing-core";

const TRACER_TIMEOUT_MS = Number(process.env.TRACER_TIMEOUT_MS ?? 15000);

type TracerApiResponse = {
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

function fail(requestId: string, status: number, code: string, message: string, details?: unknown) {
  const body: TracerApiResponse = {
    requestId,
    ok: false,
    error: { code, message, details }
  };

  return Response.json(body, { status });
}

export async function POST(req: Request) {
  const requestId = randomUUID();
  const started = Date.now();
  console.info("[tracer] request:start", { requestId });

  try {
    const form = await req.formData();
    const file = form.get("file");
    const settingsRaw = form.get("settings");

    if (!(file instanceof File)) {
      return fail(requestId, 400, "MISSING_FILE", "No file was uploaded");
    }

    let settings: unknown = {};
    if (typeof settingsRaw === "string" && settingsRaw.trim()) {
      try {
        settings = JSON.parse(settingsRaw);
      } catch {
        return fail(requestId, 400, "INVALID_SETTINGS", "settings must be valid JSON");
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await Promise.race([
      traceRasterToSvg({ buffer, mime: file.type, filename: file.name }, settings),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TRACER_TIMEOUT")), TRACER_TIMEOUT_MS)
      )
    ]);

    console.info("[tracer] request:done", { requestId, elapsedMs: Date.now() - started });
    const body: TracerApiResponse = { requestId, ok: true, result };
    return Response.json(body, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "TRACER_TIMEOUT") {
      console.warn("[tracer] request:timeout", { requestId, timeoutMs: TRACER_TIMEOUT_MS });
      return fail(requestId, 408, "TRACER_TIMEOUT", "Tracing timed out", { timeoutMs: TRACER_TIMEOUT_MS });
    }

    const normalized = normalizeTracerError(error);
    console.error("[tracer] request:failed", {
      requestId,
      elapsedMs: Date.now() - started,
      code: normalized.code
    });

    const status = normalized.code === "INVALID_SETTINGS" || normalized.code === "UNSUPPORTED_MIME" || normalized.code === "FILE_TOO_LARGE" || normalized.code === "DIMENSION_LIMIT_EXCEEDED" || normalized.code === "INVALID_IMAGE" ? 400 : 500;

    return fail(requestId, status, normalized.code, normalized.message, normalized.details);
  }
}
