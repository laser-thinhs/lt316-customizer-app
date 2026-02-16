import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { tracerApiSuccess, triggerTracerQueue } from "@/services/tracer-job.service";

export async function POST() {
  const requestId = randomUUID();
  await triggerTracerQueue();
  return NextResponse.json(tracerApiSuccess(requestId, { accepted: true }));
}
