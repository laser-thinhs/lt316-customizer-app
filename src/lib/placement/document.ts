import {
  PlacementDocument,
  PlacementInput,
  placementDocumentSchema,
  placementSchema,
  upgradePlacementToV3
} from "@/schemas/placement";

export function parsePlacementDocument(raw: unknown): PlacementDocument {
  const parsed = placementSchema.parse(raw as PlacementInput);
  return upgradePlacementToV3(parsed);
}

export function isPlacementDocument(raw: unknown): boolean {
  return placementDocumentSchema.safeParse(raw).success;
}
