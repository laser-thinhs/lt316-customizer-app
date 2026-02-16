import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { asAssetPublicUrl, createAssetId, ensureDesignJobAssetDir, extractImageDimensions, normalizeSvg } from "@/lib/assets";

const DEFAULT_JOB_TIMEOUT_MS = Number(process.env.TRACER_JOB_TIMEOUT_MS ?? 60_000);
const DEFAULT_MAX_RETRIES = Number(process.env.TRACER_JOB_MAX_RETRIES ?? 2);
const DEFAULT_CONCURRENCY = Number(process.env.TRACER_JOB_CONCURRENCY ?? 2);

const activeJobs = new Set<string>();

export type TracerJobSettings = Record<string, unknown>;

type TracerError = { code: string; message: string };

export function tracerApiSuccess<T>(requestId: string, result: T) {
  return { requestId, ok: true as const, result };
}

export function tracerApiError(requestId: string, status: number, error: TracerError) {
  return {
    status,
    body: { requestId, ok: false as const, error }
  };
}

export async function createTracerJob(input: { assetId: string; settings: TracerJobSettings }) {
  const asset = await prisma.asset.findUnique({
    where: { id: input.assetId },
    select: { id: true }
  });

  if (!asset) {
    throw new AppError("Asset not found", 404, "ASSET_NOT_FOUND");
  }

  const job = await prisma.tracerJob.create({
    data: {
      originalAssetId: input.assetId,
      settingsJson: input.settings,
      status: "queued",
      progress: 0
    },
    select: { id: true }
  });

  return job;
}

function isTimedOut(updatedAt: Date) {
  return Date.now() - updatedAt.getTime() > DEFAULT_JOB_TIMEOUT_MS;
}

async function expireTimedOutJob(jobId: string) {
  await prisma.tracerJob.updateMany({
    where: { id: jobId, status: "processing" },
    data: {
      status: "failed",
      progress: 100,
      errorCode: "TIMEOUT",
      errorMessage: `Tracing job exceeded ${DEFAULT_JOB_TIMEOUT_MS}ms timeout.`,
      finishedAt: new Date()
    }
  });
}

export async function getTracerJob(jobId: string) {
  const job = await prisma.tracerJob.findUnique({
    where: { id: jobId },
    include: {
      outputSvgAsset: {
        select: {
          id: true,
          mimeType: true,
          filePath: true
        }
      }
    }
  });

  if (!job) {
    throw new AppError("Tracer job not found", 404, "TRACER_JOB_NOT_FOUND");
  }

  if (job.status === "processing" && isTimedOut(job.updatedAt)) {
    await expireTimedOutJob(job.id);
    return getTracerJob(job.id);
  }

  return job;
}

function parseDimensions(svg: string) {
  const dims = extractImageDimensions(Buffer.from(svg), "image/svg+xml");
  return {
    width: dims?.widthPx ?? 1024,
    height: dims?.heightPx ?? 1024
  };
}

async function toSvgPayload(originalAsset: { mimeType: string; filePath: string; widthPx: number | null; heightPx: number | null }) {
  if (originalAsset.mimeType === "image/svg+xml") {
    const raw = await fs.readFile(originalAsset.filePath, "utf8");
    return normalizeSvg(raw);
  }

  const raster = await fs.readFile(originalAsset.filePath);
  const dataUri = `data:${originalAsset.mimeType};base64,${raster.toString("base64")}`;
  const width = originalAsset.widthPx ?? 1024;
  const height = originalAsset.heightPx ?? 1024;
  return [
    `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${width}\" height=\"${height}\" viewBox=\"0 0 ${width} ${height}\">`,
    `  <image href=\"${dataUri}\" width=\"${width}\" height=\"${height}\" />`,
    "</svg>"
  ].join("\n");
}

async function updateProgress(jobId: string, progress: number, patch: Record<string, unknown> = {}) {
  await prisma.tracerJob.update({
    where: { id: jobId },
    data: {
      progress,
      ...patch
    }
  });
}

async function runTracerJob(jobId: string) {
  const claim = await prisma.tracerJob.updateMany({
    where: { id: jobId, status: "queued" },
    data: {
      status: "processing",
      startedAt: new Date(),
      progress: 1,
      errorCode: null,
      errorMessage: null
    }
  });

  if (claim.count === 0) {
    return;
  }

  let preprocessMs: number | null = null;
  let traceMs: number | null = null;

  try {
    const job = await prisma.tracerJob.findUnique({
      where: { id: jobId },
      include: {
        originalAsset: true
      }
    });

    if (!job) {
      return;
    }

    await updateProgress(jobId, 10);
    const preprocessStart = Date.now();
    const svgCandidate = await toSvgPayload(job.originalAsset);
    preprocessMs = Date.now() - preprocessStart;

    await updateProgress(jobId, 40, { preprocessMs });

    await updateProgress(jobId, 60);
    const traceStart = Date.now();

    // Placeholder tracing: pass-through normalized SVG payload.
    const tracedSvg = normalizeSvg(svgCandidate);
    traceMs = Date.now() - traceStart;

    await updateProgress(jobId, 90, { traceMs });

    const dimensions = parseDimensions(tracedSvg);
    const outputAssetId = createAssetId();
    const dir = await ensureDesignJobAssetDir(job.originalAsset.designJobId);
    const filePath = path.join(dir, `${outputAssetId}-trace.svg`);
    await fs.writeFile(filePath, tracedSvg, "utf8");

    await prisma.$transaction([
      prisma.asset.create({
        data: {
          id: outputAssetId,
          designJobId: job.originalAsset.designJobId,
          kind: "preview",
          originalName: `${job.originalAsset.originalName ?? job.originalAsset.id}.trace.svg`,
          mimeType: "image/svg+xml",
          byteSize: Buffer.byteLength(tracedSvg),
          filePath,
          widthPx: dimensions.width,
          heightPx: dimensions.height
        }
      }),
      prisma.tracerJob.update({
        where: { id: jobId },
        data: {
          outputSvgAssetId: outputAssetId,
          status: "done",
          progress: 100,
          finishedAt: new Date(),
          preprocessMs,
          traceMs
        }
      })
    ]);
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error("Trace job failed");

    await prisma.tracerJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        progress: 100,
        errorCode: "TRACE_FAILED",
        errorMessage: normalized.message,
        finishedAt: new Date(),
        preprocessMs,
        traceMs
      }
    });
  }
}

async function flushQueue() {
  if (activeJobs.size >= DEFAULT_CONCURRENCY) {
    return;
  }

  const slots = DEFAULT_CONCURRENCY - activeJobs.size;
  const queued = await prisma.tracerJob.findMany({
    where: { status: "queued" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: slots
  });

  await Promise.all(
    queued.map(async ({ id }) => {
      if (activeJobs.has(id) || activeJobs.size >= DEFAULT_CONCURRENCY) {
        return;
      }
      activeJobs.add(id);
      try {
        await runTracerJobWithRetries(id);
      } finally {
        activeJobs.delete(id);
      }
    })
  );
}

export async function triggerTracerQueue() {
  await flushQueue();
}

async function runTracerJobWithRetries(jobId: string) {
  let retries = 0;
  while (retries <= DEFAULT_MAX_RETRIES) {
    await runTracerJob(jobId);
    const fresh = await prisma.tracerJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (!fresh || fresh.status === "done") {
      return;
    }

    retries += 1;
    if (fresh.status !== "failed" || retries > DEFAULT_MAX_RETRIES) {
      return;
    }

    const reset = await prisma.tracerJob.updateMany({
      where: { id: jobId, status: "failed" },
      data: {
        status: "queued",
        progress: 0,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null
      }
    });

    if (reset.count === 0) {
      return;
    }
  }
}

export async function cancelTracerJob(jobId: string) {
  const result = await prisma.tracerJob.updateMany({
    where: {
      id: jobId,
      status: {
        in: ["queued", "processing"]
      }
    },
    data: {
      status: "failed",
      progress: 100,
      errorCode: "CANCELLED",
      errorMessage: "Job cancelled by user.",
      finishedAt: new Date()
    }
  });

  if (result.count === 0) {
    const existing = await prisma.tracerJob.findUnique({ where: { id: jobId } });
    if (!existing) {
      throw new AppError("Tracer job not found", 404, "TRACER_JOB_NOT_FOUND");
    }
  }
}

export async function toTracerJobResult(jobId: string) {
  const job = await getTracerJob(jobId);

  const result: {
    jobId: string;
    status: string;
    progress: number;
    result?: { svgAssetId: string; svgUrl: string; svgText?: string };
    error?: { code: string | null; message: string | null };
  } = {
    jobId: job.id,
    status: job.status,
    progress: job.progress
  };

  if (job.outputSvgAssetId) {
    result.result = {
      svgAssetId: job.outputSvgAssetId,
      svgUrl: asAssetPublicUrl(job.outputSvgAssetId)
    };
  }

  if (job.status === "failed") {
    result.error = {
      code: job.errorCode,
      message: job.errorMessage
    };
  }

  return result;
}
