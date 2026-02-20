import { randomUUID } from "node:crypto";
import { getTracerProvider } from "../../../../../lib/tracer-provider";
import { requireApiRole } from "@/lib/api-auth";
import { createTracerAsset } from "@/lib/tracer-asset-store";
import { createTracerJob, updateTracerJob } from "@/lib/tracer-job-store";

function fail(requestId: string, status: number, code: string, message: string, details?: unknown) {
  return Response.json({ requestId, ok: false, error: { code, message, details } }, { status });
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();

  try {
    requireApiRole(req, ["admin", "operator"]);
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

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const inputAsset = await createTracerAsset({
      buffer: inputBuffer,
      mimeType: file.type,
      originalName: file.name
    });

    const provider = getTracerProvider();

    if (provider.createJob && provider.getJob) {
      try {
        const remote = await provider.createJob(inputAsset.id, settings, { requestId });
        const job = createTracerJob({
          requestId,
          inputAssetId: inputAsset.id,
          settings,
          providerJobId: remote.jobId
        });

        return Response.json(
          { requestId, ok: true, result: { jobId: job.id, status: "queued", providerJobId: remote.jobId } },
          { status: 202 }
        );
      } catch (error) {
        console.warn("[tracer-jobs] createJob unavailable, falling back to sync trace", {
          requestId,
          message: error instanceof Error ? error.message : "unknown"
        });
      }
    }

    const result = await provider.traceSync(
      { buffer: inputBuffer, mime: file.type, filename: file.name },
      settings,
      { requestId }
    );

    const outputAsset = await createTracerAsset({
      buffer: Buffer.from(result.svg, "utf8"),
      mimeType: "image/svg+xml",
      originalName: `${file.name || "trace"}.svg`
    });

    const job = createTracerJob({ requestId, inputAssetId: inputAsset.id, settings });
    updateTracerJob(job.id, {
      status: "done",
      progress: 100,
      result: { ...result, svgUrl: outputAsset.url },
      outputSvgAssetId: outputAsset.id
    });

    return Response.json(
      {
        requestId,
        ok: true,
        result: {
          jobId: job.id,
          status: "done",
          progress: 100,
          outputSvgAssetId: outputAsset.id,
          result: { ...result, svgUrl: outputAsset.url }
        }
      },
      { status: 200 }
    );
  } catch (error) {
    return fail(requestId, 500, "TRACE_JOB_CREATE_FAILED", "Failed to create trace job", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
