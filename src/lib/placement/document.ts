import {
  PlacementDocument,
  PlacementInput,
  placementDocumentSchema,
  placementSchema,
  upgradePlacementToV2
} from "@/schemas/placement";

export function parsePlacementDocument(raw: unknown): PlacementDocument {
  const parsed = placementSchema.parse(raw as PlacementInput);
  return upgradePlacementToV2(parsed);
}

export function isPlacementV2(raw: unknown): boolean {
  return placementDocumentSchema.safeParse(raw).success;
}
