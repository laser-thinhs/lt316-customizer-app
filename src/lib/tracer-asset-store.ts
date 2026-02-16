import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { storageRoot } from "@/lib/assets";

const TRACER_ASSET_DIR = "tracer-assets";

type TracerAssetMeta = {
  id: string;
  mimeType: string;
  originalName?: string;
  filePath: string;
  createdAt: string;
};

export type StoredTracerAsset = TracerAssetMeta & {
  buffer: Buffer;
};

function baseDir() {
  return path.join(storageRoot(), TRACER_ASSET_DIR);
}

function metaPath(id: string) {
  return path.join(baseDir(), `${id}.json`);
}

function contentPath(id: string) {
  return path.join(baseDir(), `${id}.bin`);
}

export async function createTracerAsset(input: { buffer: Buffer; mimeType: string; originalName?: string }) {
  const id = randomUUID();
  await fs.mkdir(baseDir(), { recursive: true });

  const binPath = contentPath(id);
  const dbMeta: TracerAssetMeta = {
    id,
    mimeType: input.mimeType,
    originalName: input.originalName,
    filePath: binPath,
    createdAt: new Date().toISOString()
  };

  await fs.writeFile(binPath, input.buffer);
  await fs.writeFile(metaPath(id), JSON.stringify(dbMeta, null, 2), "utf8");

  return {
    ...dbMeta,
    byteSize: input.buffer.byteLength,
    url: `/api/tracer/assets/${id}`
  };
}

export async function readTracerAsset(id: string): Promise<StoredTracerAsset> {
  const [metaRaw, buffer] = await Promise.all([fs.readFile(metaPath(id), "utf8"), fs.readFile(contentPath(id))]);
  const meta = JSON.parse(metaRaw) as TracerAssetMeta;
  return { ...meta, buffer };
}
