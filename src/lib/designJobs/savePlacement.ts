import { placementDocumentSchema, type PlacementDocument } from "@/schemas/placement";

const designJobSaveResponseSchema = placementDocumentSchema;

export type SavePlacementResult = {
  placementJson: PlacementDocument;
  updatedAt: string;
};

export async function savePlacement(designJobId: string, placementJson: PlacementDocument): Promise<SavePlacementResult> {
  const payload = { placementJson: placementDocumentSchema.parse(placementJson) };

  const response = await fetch(`/api/design-jobs/${designJobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message ?? "Failed to save placement");
  }

  return {
    placementJson: designJobSaveResponseSchema.parse(json.data.placementJson),
    updatedAt: new Date(json.data.updatedAt).toISOString()
  };
}
