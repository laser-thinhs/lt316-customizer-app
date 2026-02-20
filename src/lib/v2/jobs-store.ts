import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { BedLayout, DesignAsset, DesignJob, JobStatus, Placement, ProductionConfig } from "@/core/v2/types";
import { objectPresets } from "@/core/v2/presets";
import { atomicWriteJson, ensureDir, jobsRoot, readJsonFile, recordsRoot, withFsRetries } from "@/lib/v2/storage";

const uploadsRoot = path.join(process.cwd(), "public", "uploads", "v2");

function nowIso() {
  return new Date().toISOString();
}

function defaultPlacement(objectDefinitionId: string): Placement {
  const object = objectPresets.find((item) => item.id === objectDefinitionId) ?? objectPresets[0];
  return {
    x_mm: object.safeArea_mm.x,
    y_mm: object.safeArea_mm.y,
    scale: 1,
    rotation_deg: 0,
    coordinateSpace: "unwrapped_mm",
    wrapEnabled: object.type === "cylinder",
    seamX_mm: object.defaultSeam_mm
  };
}

function defaultBedLayout(): BedLayout {
  return {
    bedW_mm: 300,
    bedH_mm: 300,
    grid: { spacing: 25, offsetX: 0, offsetY: 0, enabled: true },
    customHoles: [],
    placedItem: { x: 150, y: 150, rotation: 0 },
    rotaryConfig: { axisY: 150, chuckX: 45, tailstockX: 255, enabled: true, cylinderGhostDiameter: 80 }
  };
}

function recordPath(jobId: string) {
  return path.join(recordsRoot, `${jobId}.json`);
}

export function isV2JobId(jobId: string) {
  return jobId.startsWith("v2_");
}

export async function createV2Job(input: {
  objectDefinitionId?: string;
  customerName?: string;
  customerEmail?: string;
}) {
  const objectId = input.objectDefinitionId ?? objectPresets[0].id;
  const stamp = nowIso();
  const job: DesignJob = {
    id: `v2_${randomUUID().slice(0, 12)}`,
    status: "draft",
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    objectDefinitionId: objectId,
    placement: defaultPlacement(objectId),
    bedLayout: defaultBedLayout(),
    createdAt: stamp,
    updatedAt: stamp
  };
  await atomicWriteJson(recordPath(job.id), job);
  return job;
}

export async function getV2Job(jobId: string) {
  return readJsonFile<DesignJob>(recordPath(jobId));
}

export async function listV2Jobs(status?: JobStatus) {
  await ensureDir(recordsRoot);
  const entries = await withFsRetries(() => fs.readdir(recordsRoot));
  const jobs = await Promise.all(
    entries.filter((item) => item.endsWith(".json")).map(async (item) => readJsonFile<DesignJob>(path.join(recordsRoot, item)))
  );
  return jobs.filter((j): j is DesignJob => j !== null && (!status || j.status === status));
}

export async function updateV2Job(jobId: string, patch: Partial<DesignJob>) {
  const existing = await getV2Job(jobId);
  if (!existing) return null;
  const merged: DesignJob = {
    ...existing,
    ...patch,
    placement: patch.placement ? { ...existing.placement, ...patch.placement } : existing.placement,
    bedLayout: patch.bedLayout ? { ...existing.bedLayout, ...patch.bedLayout } as BedLayout : existing.bedLayout,
    productionConfig: patch.productionConfig ?? existing.productionConfig,
    updatedAt: nowIso()
  };
  await atomicWriteJson(recordPath(jobId), merged);
  return merged;
}

export async function setV2JobStatus(jobId: string, status: JobStatus) {
  return updateV2Job(jobId, { status });
}

function parseSvgBbox(svg: string) {
  const viewBoxMatch = svg.match(/viewBox\s*=\s*['\"]\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*['\"]/i);
  if (viewBoxMatch) {
    return { width: Number(viewBoxMatch[3]) || 100, height: Number(viewBoxMatch[4]) || 100 };
  }
  const widthMatch = svg.match(/width\s*=\s*['\"]([\d.]+)/i);
  const heightMatch = svg.match(/height\s*=\s*['\"]([\d.]+)/i);
  return { width: Number(widthMatch?.[1]) || 100, height: Number(heightMatch?.[1]) || 100 };
}

export async function attachSvgToV2Job(jobId: string, file: File) {
  const job = await getV2Job(jobId);
  if (!job) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = buffer.toString("utf8");
  const assetId = `asset_${randomUUID().slice(0, 10)}`;
  await ensureDir(uploadsRoot);
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const filename = `${assetId}_${safeName.endsWith(".svg") ? safeName : `${safeName}.svg`}`;
  const absolutePath = path.join(uploadsRoot, filename);
  await withFsRetries(() => fs.writeFile(absolutePath, buffer));
  const asset: DesignAsset = {
    id: assetId,
    originalSvgPath: absolutePath,
    originalSvgPublicUrl: `/uploads/v2/${filename}`,
    bbox: parseSvgBbox(text),
    createdAt: nowIso()
  };
  await updateV2Job(jobId, { assetId: asset.id } as Partial<DesignJob>);
  await atomicWriteJson(path.join(recordsRoot, `${jobId}.${assetId}.asset.json`), asset);
  return asset;
}

export async function getV2Asset(jobId: string, assetId?: string) {
  if (!assetId) return null;
  return readJsonFile<DesignAsset>(path.join(recordsRoot, `${jobId}.${assetId}.asset.json`));
}

export function resolveJobDestination(job: DesignJob) {
  const d = new Date(job.createdAt);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return path.join(jobsRoot, String(yyyy), mm, job.id);
}

export async function generateV2Artifacts(jobId: string) {
  const job = await getV2Job(jobId);
  if (!job) return null;
  const destination = resolveJobDestination(job);
  await ensureDir(destination);
  const packet = {
    job,
    generatedAt: nowIso(),
    destination,
    productionConfig: job.productionConfig as ProductionConfig | undefined
  };
  await atomicWriteJson(path.join(destination, "job.json"), packet);

  const proofSvg = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"600\"><rect width=\"100%\" height=\"100%\" fill=\"#111\"/><text x=\"40\" y=\"80\" fill=\"#fff\" font-size=\"36\">Proof ${job.id}</text><text x=\"40\" y=\"130\" fill=\"#ccc\" font-size=\"24\">Object: ${job.objectDefinitionId}</text></svg>`;
  await withFsRetries(() => fs.writeFile(path.join(destination, "proof.svg"), proofSvg, "utf8"));

  const bedSvg = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"600\"><rect width=\"100%\" height=\"100%\" fill=\"#0b1220\"/><text x=\"24\" y=\"40\" fill=\"#9fb3d1\">Bed Layout ${job.id}</text></svg>`;
  await withFsRetries(() => fs.writeFile(path.join(destination, "bed.svg"), bedSvg, "utf8"));

  return {
    destination,
    artifacts: {
      jobJson: path.join(destination, "job.json"),
      proof: path.join(destination, "proof.svg"),
      bed: path.join(destination, "bed.svg")
    }
  };
}
