import { randomUUID } from "node:crypto";
import { getTracerProvider } from "../../../../../../lib/tracer-provider";
import { createTracerAsset } from "@/lib/tracer-asset-store";
import { findTracerJob, updateTracerJob } from "@/lib/tracer-job-store";

function fail(requestId: string, status: number, code: string, message: string, details?: unknown) {
  return Response.json({ requestId, ok: false, error: { code, message, details } }, { status });
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const { id } = await context.params;
  const job = findTracerJob(id);

  if (!job) {
    return fail(requestId, 404, "JOB_NOT_FOUND", "Tracer job not found");
  }

  if (job.outputSvgAssetId) {
    return Response.json(
      {
        requestId,
        ok: true,
        result: {
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          outputSvgAssetId: job.outputSvgAssetId,
          result: job.result
        }
      },
      { status: 200 }
    );
  }

  try {
    if (!job.providerJobId) {
      return Response.json(
        {
          requestId,
          ok: true,
          result: {
            jobId: job.id,
            status: job.status,
            progress: job.progress,
            result: job.result,
            error: job.error
          }
        },
        { status: 200 }
      );
    }

    const provider = getTracerProvider();
    if (!provider.getJob) {
      return fail(requestId, 500, "PROVIDER_JOB_UNSUPPORTED", "Configured tracer provider does not support jobs");
    }

    const status = await provider.getJob(job.providerJobId, { requestId });

    if (status.status === "done" && status.result && !job.outputSvgAssetId) {
      const outputAsset = await createTracerAsset({
        buffer: Buffer.from(status.result.svg, "utf8"),
        mimeType: "image/svg+xml",
        originalName: `${job.id}.svg`
      });

      const updated = updateTracerJob(job.id, {
        status: "done",
        progress: 100,
        result: { ...status.result, svgUrl: outputAsset.url },
        outputSvgAssetId: outputAsset.id
      });

      return Response.json(
        {
          requestId,
          ok: true,
          result: {
            jobId: job.id,
            status: updated?.status,
            progress: updated?.progress,
            outputSvgAssetId: updated?.outputSvgAssetId,
            result: updated?.result
          }
        },
        { status: 200 }
      );
    }

    const updated = updateTracerJob(job.id, {
      status: status.status,
      progress: status.progress,
      error: status.error,
      result: status.result
    });

    return Response.json(
      {
        requestId,
        ok: true,
        result: {
          jobId: job.id,
          status: updated?.status,
          progress: updated?.progress,
          outputSvgAssetId: updated?.outputSvgAssetId,
          result: updated?.result,
          error: updated?.error
        }
      },
      { status: 200 }
    );
  } catch (error) {
    return fail(requestId, 500, "TRACE_JOB_STATUS_FAILED", "Failed to fetch trace job", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
