import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { toApiErrorShape } from "@/lib/errors";
import { createTracerJob, toTracerJobResult, tracerApiError, tracerApiSuccess, triggerTracerQueue } from "@/services/tracer-job.service";
import { tracerTraceSchema } from "@/schemas/tracer";

async function waitForCompletion(jobId: string, waitMs: number) {
  const startedAt = Date.now();
  let delay = 100;
  while (Date.now() - startedAt < waitMs) {
    await triggerTracerQueue();
    const result = await toTracerJobResult(jobId);
    if (result.status === "done" || result.status === "failed") {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 500);
  }

  return toTracerJobResult(jobId);
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const payload = tracerTraceSchema.parse(await request.json());
    const { assetId, settings, waitMs, mode } = payload;

    const job = await createTracerJob({ assetId, settings });

    if (mode === "background") {
      await triggerTracerQueue();
      return NextResponse.json(tracerApiSuccess(requestId, { jobId: job.id, status: "processing" }), { status: 202 });
    }

    const result = await waitForCompletion(job.id, waitMs);
    if (result.status === "done") {
      return NextResponse.json(tracerApiSuccess(requestId, result), { status: 200 });
    }

    return NextResponse.json(tracerApiSuccess(requestId, { jobId: job.id, status: "processing" }), {
      status: 202
    });
  } catch (error) {
    const normalized = toApiErrorShape(error);
    return NextResponse.json(
      tracerApiError(requestId, normalized.status, {
        code: normalized.body.error.code,
        message: normalized.body.error.message
      }).body,
      { status: normalized.status }
    );
  }
}
