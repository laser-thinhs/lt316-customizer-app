import path from "node:path";
import { randomUUID } from "node:crypto";
import { BedLayout, BedPreset } from "@/core/v2/types";
import { adminDataRoot, atomicWriteJson, ensureDir, readJsonFile } from "@/lib/admin-storage";

const bedPresetPath = path.join(adminDataRoot, "bed-presets.json");

type BedPresetDocument = { presets: BedPreset[] };

const fallbackPreset: BedPreset = {
  id: "preset_default",
  name: "Default 300x300",
  isDefault: true,
  bedW_mm: 300,
  bedH_mm: 300,
  grid: { enabled: true, spacing: 25, offsetX_mm: 0, offsetY_mm: 0, snapToGrid: true, showIntersections: false },
  rotaryDefaults: { showRotary: true, axisY_mm: 150, chuckX_mm: 45, tailstockX_mm: 255, cylinderDiameter_mm: 80 },
  holes: { gridEnabled: false, spacing: 25, offsetX_mm: 0, offsetY_mm: 0, customHoles: [] }
};

async function readDoc(): Promise<BedPresetDocument> {
  await ensureDir(adminDataRoot);
  const doc = await readJsonFile<BedPresetDocument>(bedPresetPath);
  if (doc?.presets?.length) return { presets: normalizeDefaults(doc.presets) };
  await atomicWriteJson(bedPresetPath, { presets: [fallbackPreset] });
  return { presets: [fallbackPreset] };
}

function normalizeDefaults(presets: BedPreset[]) {
  let hasDefault = false;
  return presets.map((preset, index) => {
    if (preset.isDefault) {
      if (!hasDefault) {
        hasDefault = true;
        return preset;
      }
      return { ...preset, isDefault: false };
    }
    if (!hasDefault && index === presets.length - 1) {
      return { ...preset, isDefault: true };
    }
    return preset;
  });
}

async function writePresets(presets: BedPreset[]) {
  await atomicWriteJson(bedPresetPath, { presets: normalizeDefaults(presets) });
}

export async function listBedPresets() {
  const doc = await readDoc();
  return doc.presets;
}

export async function getDefaultBedPreset() {
  const presets = await listBedPresets();
  return presets.find((item) => item.isDefault) ?? presets[0];
}

export function bedPresetToLayout(preset: BedPreset): BedLayout {
  return {
    bedW_mm: preset.bedW_mm,
    bedH_mm: preset.bedH_mm,
    grid: {
      spacing: preset.grid.spacing,
      offsetX: preset.grid.offsetX_mm,
      offsetY: preset.grid.offsetY_mm,
      enabled: preset.grid.enabled
    },
    customHoles: preset.holes.customHoles.map((hole) => ({ x: hole.x_mm, y: hole.y_mm })),
    placedItem: { x: preset.bedW_mm / 2, y: preset.bedH_mm / 2, rotation: 0 },
    rotaryConfig: {
      axisY: preset.rotaryDefaults.axisY_mm,
      chuckX: preset.rotaryDefaults.chuckX_mm,
      tailstockX: preset.rotaryDefaults.tailstockX_mm,
      enabled: preset.rotaryDefaults.showRotary,
      cylinderGhostDiameter: preset.rotaryDefaults.cylinderDiameter_mm
    }
  };
}

export async function createBedPreset(input: Omit<BedPreset, "id">) {
  const presets = await listBedPresets();
  const next: BedPreset = { ...input, isDefault: Boolean(input.isDefault), id: `bed_${randomUUID().slice(0, 10)}` };
  const withDefaultApplied: BedPreset[] = next.isDefault
    ? [...presets.map((preset) => ({ ...preset, isDefault: false })), next]
    : [...presets, next];
  await writePresets(withDefaultApplied);
  return next;
}

export async function updateBedPreset(id: string, patch: Partial<BedPreset>) {
  const presets = await listBedPresets();
  const target = presets.find((item) => item.id === id);
  if (!target) return null;
  const merged = presets.map((item) => (item.id === id ? { ...item, ...patch, id } : item));
  const normalized = patch.isDefault ? merged.map((item) => ({ ...item, isDefault: item.id === id })) : merged;
  await writePresets(normalized);
  return normalized.find((item) => item.id === id) ?? null;
}

export async function deleteBedPreset(id: string) {
  const presets = await listBedPresets();
  if (presets.length <= 1) return false;
  const next = presets.filter((item) => item.id !== id);
  if (next.length === presets.length) return false;
  await writePresets(next);
  return true;
}

export async function duplicateBedPreset(id: string) {
  const presets = await listBedPresets();
  const existing = presets.find((item) => item.id === id);
  if (!existing) return null;
  const copy = { ...existing, id: `bed_${randomUUID().slice(0, 10)}`, name: `${existing.name} Copy`, isDefault: false };
  await writePresets(presets.concat(copy));
  return copy;
}
