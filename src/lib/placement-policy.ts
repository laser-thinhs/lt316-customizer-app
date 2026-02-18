export type PolicyMode = "STRICT" | "CLAMP" | "SCALE_TO_FIT";

type PlacementObject = {
  id?: string;
  xMm?: unknown;
  yMm?: unknown;
  widthMm?: unknown;
  heightMm?: unknown;
  [key: string]: unknown;
};

type PlacementDocument = {
  objects?: PlacementObject[];
  [key: string]: unknown;
};

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function cloneDocument(document: unknown): PlacementDocument {
  if (!document || typeof document !== "object") {
    return {};
  }

  return structuredClone(document) as PlacementDocument;
}

export function enforcePolicy(document: unknown, zone: { widthMm: number; heightMm: number }, policy: PolicyMode) {
  const warnings: string[] = [];
  const cloned = cloneDocument(document);

  const objects = Array.isArray(cloned.objects) ? cloned.objects : [];
  for (const obj of objects) {
    const width = toNumber(obj.widthMm);
    const height = toNumber(obj.heightMm);
    const x = toNumber(obj.xMm);
    const y = toNumber(obj.yMm);

    const overflowX = x + width > zone.widthMm || x < 0;
    const overflowY = y + height > zone.heightMm || y < 0;
    if (!overflowX && !overflowY) continue;

    if (policy === "STRICT") {
      return { ok: false, document: cloned, warnings: [`Object ${obj.id ?? "unknown"} violates zone bounds`] };
    }

    if (policy === "CLAMP") {
      obj.xMm = Math.max(0, Math.min(x, zone.widthMm - width));
      obj.yMm = Math.max(0, Math.min(y, zone.heightMm - height));
      warnings.push(`Clamped object ${obj.id ?? "unknown"}`);
      continue;
    }

    const scale = Math.min(zone.widthMm / Math.max(width, 1), zone.heightMm / Math.max(height, 1), 1);
    obj.widthMm = width * scale;
    obj.heightMm = height * scale;
    obj.xMm = Math.max(0, Math.min(x, zone.widthMm - obj.widthMm));
    obj.yMm = Math.max(0, Math.min(y, zone.heightMm - obj.heightMm));
    warnings.push(`Scaled object ${obj.id ?? "unknown"} by ${scale.toFixed(3)}`);
  }

  return { ok: true, document: cloned, warnings };
}

export function remapDocumentToProfile(document: unknown, source: { widthMm: number; heightMm: number }, target: { widthMm: number; heightMm: number }) {
  const sx = target.widthMm / source.widthMm;
  const sy = target.heightMm / source.heightMm;
  const ratio = Math.min(sx, sy);

  const warnings: string[] = [];
  const cloned = cloneDocument(document);
  for (const obj of cloned.objects ?? []) {
    obj.xMm = toNumber(obj.xMm) * sx;
    obj.yMm = toNumber(obj.yMm) * sy;
    obj.widthMm = toNumber(obj.widthMm) * ratio;
    obj.heightMm = toNumber(obj.heightMm) * ratio;
    warnings.push(`Remapped ${obj.id ?? "unknown"}`);
  }

  return { document: cloned, warnings };
}
