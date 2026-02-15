export type PolicyMode = "STRICT" | "CLAMP" | "SCALE_TO_FIT";

export function enforcePolicy(document: any, zone: { widthMm: number; heightMm: number }, policy: PolicyMode) {
  const warnings: string[] = [];
  const cloned = structuredClone(document);

  const objects = Array.isArray(cloned.objects) ? cloned.objects : [];
  for (const obj of objects) {
    const width = Number(obj.widthMm ?? 0);
    const height = Number(obj.heightMm ?? 0);
    const x = Number(obj.xMm ?? 0);
    const y = Number(obj.yMm ?? 0);

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

export function remapDocumentToProfile(document: any, source: { widthMm: number; heightMm: number }, target: { widthMm: number; heightMm: number }) {
  const sx = target.widthMm / source.widthMm;
  const sy = target.heightMm / source.heightMm;
  const ratio = Math.min(sx, sy);

  const warnings: string[] = [];
  const cloned = structuredClone(document);
  for (const obj of cloned.objects ?? []) {
    obj.xMm = Number(obj.xMm ?? 0) * sx;
    obj.yMm = Number(obj.yMm ?? 0) * sy;
    obj.widthMm = Number(obj.widthMm ?? 0) * ratio;
    obj.heightMm = Number(obj.heightMm ?? 0) * ratio;
    warnings.push(`Remapped ${obj.id ?? "unknown"}`);
  }

  return { document: cloned, warnings };
}
