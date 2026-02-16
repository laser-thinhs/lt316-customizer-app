import { placementDocumentSchema, type PlacementDocument } from "@/schemas/placement";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }

  if (value && typeof value === "object") {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, sortValue(entryValue)]);

    return Object.fromEntries(sortedEntries);
  }

  return value;
}

export function stablePlacementString(input: PlacementDocument): string {
  const parsed = placementDocumentSchema.parse(input);
  return JSON.stringify(sortValue(parsed));
}

export function arePlacementsEqual(left: PlacementDocument, right: PlacementDocument): boolean {
  return stablePlacementString(left) === stablePlacementString(right);
}
