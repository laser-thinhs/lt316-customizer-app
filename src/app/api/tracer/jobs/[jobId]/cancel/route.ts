import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { toApiErrorShape } from "@/lib/errors";
import { cancelTracerJob, tracerApiError, tracerApiSuccess } from "@/services/tracer-job.service";

export async function POST(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const requestId = randomUUID();
  try {
    const { jobId } = await params;
    await cancelTracerJob(jobId);
    return NextResponse.json(tracerApiSuccess(requestId, { jobId, status: "failed" }));
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
