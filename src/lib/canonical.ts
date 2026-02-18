import crypto from "node:crypto";

const DEFAULT_PRECISION = Number(process.env.PLACEMENT_ROUNDING_MM ?? "0.001");

type SortableEntry = { zIndex?: unknown; id?: unknown };

function isSortableEntry(value: unknown): value is SortableEntry {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function roundNumber(value: number, precision = DEFAULT_PRECISION) {
  const factor = 1 / precision;
  return Math.round(value * factor) / factor;
}

function canonicalize(value: unknown, precision: number): unknown {
  if (typeof value === "number") {
    return roundNumber(value, precision);
  }

  if (Array.isArray(value)) {
    const normalized = value.map((item) => canonicalize(item, precision));
    if (normalized.every(isSortableEntry)) {
      return normalized.sort((a, b) => {
        const az = Number(a.zIndex ?? 0);
        const bz = Number(b.zIndex ?? 0);
        if (az !== bz) return az - bz;
        return String(a.id ?? "").localeCompare(String(b.id ?? ""));
      });
    }

    return normalized;
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key], precision);
        return acc;
      }, {});
  }

  return value;
}

export function canonicalSerialize(document: unknown, precision = DEFAULT_PRECISION) {
  const normalized = canonicalize(document, precision);
  return JSON.stringify({
    schemaVersion: "v2",
    migrationMetadata: { hardenedAt: "layer-2.2" },
    document: normalized
  });
}

export function fingerprint(document: unknown, precision = DEFAULT_PRECISION) {
  const serialized = canonicalSerialize(document, precision);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}
