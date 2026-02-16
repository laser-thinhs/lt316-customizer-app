import { randomUUID } from "node:crypto";
import { traceRasterToSvg } from "../tracing-core";
import { readTracerAsset } from "../../src/lib/tracer-asset-store";

export type TraceResult = {
  svg: string;
  width: number;
  height: number;
  viewBox: string;
  stats?: Record<string, unknown>;
  svgUrl?: string;
};

export type JobStatusResult = {
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  progress?: number;
  result?: TraceResult;
  error?: {
    code: string;
    message: string;
  };
};

export interface TracerProvider {
  traceSync(
    input: { buffer: Buffer; mime: string; filename?: string },
    settings: unknown,
    requestContext?: { requestId?: string }
  ): Promise<TraceResult>;
  createJob?(assetId: string, settings: unknown, requestContext?: { requestId?: string }): Promise<{ jobId: string }>;
  getJob?(jobId: string, requestContext?: { requestId?: string }): Promise<JobStatusResult>;
}

async function readAssetAsInput(assetId: string): Promise<{ buffer: Buffer; mime: string; filename?: string }> {
  const asset = await readTracerAsset(assetId);
  return {
    buffer: asset.buffer,
    mime: asset.mimeType,
    filename: asset.originalName ?? `${asset.id}.bin`
  };
}

const localJobs = new Map<string, JobStatusResult>();

class LocalProvider implements TracerProvider {
  async traceSync(input: { buffer: Buffer; mime: string; filename?: string }, settings: unknown): Promise<TraceResult> {
    return traceRasterToSvg(input, settings);
  }

  async createJob(assetId: string, settings: unknown): Promise<{ jobId: string }> {
    const input = await readAssetAsInput(assetId);
    const result = await this.traceSync(input, settings);
    const jobId = randomUUID();
    localJobs.set(jobId, { jobId, status: "done", progress: 100, result });
    return { jobId };
  }

  async getJob(jobId: string): Promise<JobStatusResult> {
    const found = localJobs.get(jobId);
    if (!found) {
      return {
        jobId,
        status: "failed",
        error: { code: "NOT_FOUND", message: "Job not found" }
      };
    }

    return found;
  }
}

type RemoteTraceResponse = {
  svg: string;
  width: number;
  height: number;
  viewBox: string;
  stats?: Record<string, unknown>;
  svgUrl?: string;
};

type RemoteJobResponse = {
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  progress?: number;
  result?: RemoteTraceResponse;
  error?: {
    code: string;
    message: string;
  };
};

class RemoteProvider implements TracerProvider {
  constructor(private readonly serviceUrl: string, private readonly apiKey?: string) {}

  async traceSync(
    input: { buffer: Buffer; mime: string; filename?: string },
    settings: unknown,
    requestContext?: { requestId?: string }
  ): Promise<TraceResult> {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(input.buffer)], input.filename ?? "upload", { type: input.mime }));
    form.append("settings", JSON.stringify(settings ?? {}));

    const response = await this.fetchWithRetry("/v1/trace", {
      method: "POST",
      body: form,
      headers: this.headers(requestContext?.requestId)
    });

    const payload = (await response.json()) as { result?: RemoteTraceResponse } | RemoteTraceResponse;
    const result = "result" in payload && payload.result ? payload.result : (payload as RemoteTraceResponse);
    return result;
  }

  async createJob(assetId: string, settings: unknown, requestContext?: { requestId?: string }): Promise<{ jobId: string }> {
    const input = await readAssetAsInput(assetId);
    const form = new FormData();
    form.append("file", new File([new Uint8Array(input.buffer)], input.filename ?? "upload", { type: input.mime }));
    form.append("settings", JSON.stringify(settings ?? {}));

    const response = await this.fetchWithRetry("/v1/jobs", {
      method: "POST",
      body: form,
      headers: this.headers(requestContext?.requestId)
    });

    const payload = (await response.json()) as { jobId: string };
    return { jobId: payload.jobId };
  }

  async getJob(jobId: string, requestContext?: { requestId?: string }): Promise<JobStatusResult> {
    const response = await this.fetchWithRetry(`/v1/jobs/${jobId}`, {
      method: "GET",
      headers: this.headers(requestContext?.requestId)
    });
    return (await response.json()) as RemoteJobResponse;
  }

  private headers(requestId?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (requestId) {
      headers["x-request-id"] = requestId;
    }
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }
    return headers;
  }

  private async fetchWithRetry(path: string, init: RequestInit): Promise<Response> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      try {
        const response = await fetch(new URL(path, this.serviceUrl), {
          ...init,
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`REMOTE_${response.status}`);
        }

        return response;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        const isNetworkFailure = error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
        if (attempt === 1 || !isNetworkFailure) {
          throw error;
        }
      }
    }

    throw lastError;
  }
}

export function getTracerProvider(): TracerProvider {
  const provider = process.env.TRACER_PROVIDER ?? "local";

  if (provider === "remote") {
    const serviceUrl = process.env.TRACER_SERVICE_URL;
    if (!serviceUrl) {
      throw new Error("TRACER_SERVICE_URL is required when TRACER_PROVIDER=remote");
    }
    return new RemoteProvider(serviceUrl, process.env.TRACER_SERVICE_API_KEY);
  }

  return new LocalProvider();
}
