import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { toApiErrorShape } from "@/lib/errors";
import { createTracerJob, tracerApiError, tracerApiSuccess, triggerTracerQueue } from "@/services/tracer-job.service";
import { tracerJobCreateSchema } from "@/schemas/tracer";

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const payload = tracerJobCreateSchema.parse(await request.json());
    const job = await createTracerJob(payload);
    await triggerTracerQueue();

    return NextResponse.json(tracerApiSuccess(requestId, { jobId: job.id }), { status: 201 });
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
