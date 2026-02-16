import { randomUUID } from "node:crypto";

type JobRecord = {
  id: string;
  requestId: string;
  providerJobId?: string;
  status: "queued" | "processing" | "done" | "failed";
  progress?: number;
  settings: unknown;
  inputAssetId: string;
  outputSvgAssetId?: string;
  result?: {
    svg: string;
    width: number;
    height: number;
    viewBox: string;
    stats?: Record<string, unknown>;
    svgUrl?: string;
  };
  error?: {
    code: string;
    message: string;
  };
};

const jobs = new Map<string, JobRecord>();
const jobsByProviderJobId = new Map<string, string>();

export function createTracerJob(input: { requestId: string; inputAssetId: string; settings: unknown; providerJobId?: string }) {
  const id = randomUUID();
  const record: JobRecord = {
    id,
    requestId: input.requestId,
    inputAssetId: input.inputAssetId,
    settings: input.settings,
    providerJobId: input.providerJobId,
    status: "queued",
    progress: 0
  };
  jobs.set(id, record);
  if (input.providerJobId) {
    jobsByProviderJobId.set(input.providerJobId, id);
  }
  return record;
}

export function findTracerJob(jobId: string) {
  return jobs.get(jobId);
}

export function findTracerJobByProviderJobId(providerJobId: string) {
  const localJobId = jobsByProviderJobId.get(providerJobId);
  if (!localJobId) return null;
  return jobs.get(localJobId) ?? null;
}

export function updateTracerJob(jobId: string, patch: Partial<JobRecord>) {
  const current = jobs.get(jobId);
  if (!current) return null;
  const next: JobRecord = { ...current, ...patch };
  jobs.set(jobId, next);
  return next;
}
