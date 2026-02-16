import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { toApiErrorShape } from "@/lib/errors";
import { toTracerJobResult, tracerApiError, tracerApiSuccess, triggerTracerQueue } from "@/services/tracer-job.service";

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const requestId = randomUUID();
  try {
    const { jobId } = await params;
    await triggerTracerQueue();
    const result = await toTracerJobResult(jobId);
    return NextResponse.json(tracerApiSuccess(requestId, result));
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
