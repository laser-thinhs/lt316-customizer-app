import { placementDocumentSchema, type PlacementDocument } from "@/schemas/placement";

const PREFIX = "lt316:placement-draft:";

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function keyForJob(designJobId: string) {
  return `${PREFIX}${designJobId}`;
}

export function readPlacementDraft(designJobId: string): PlacementDocument | null {
  if (!canUseLocalStorage()) return null;

  const raw = window.localStorage.getItem(keyForJob(designJobId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return placementDocumentSchema.parse(parsed);
  } catch {
    window.localStorage.removeItem(keyForJob(designJobId));
    return null;
  }
}

export function writePlacementDraft(designJobId: string, placement: PlacementDocument) {
  if (!canUseLocalStorage()) return;
  const parsed = placementDocumentSchema.parse(placement);
  window.localStorage.setItem(keyForJob(designJobId), JSON.stringify(parsed));
}

export function clearPlacementDraft(designJobId: string) {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(keyForJob(designJobId));
}
