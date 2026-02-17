import { fail, ok } from "@/lib/response";
import { proofPlacementSchema, proofTemplateSchema, proofUiSettingsSchema } from "@/schemas/proof";
import { z } from "zod";
import { updateProofPlacement } from "@/services/proof.service";

const schema = z.object({
  placementMm: proofPlacementSchema.optional(),
  placement: proofPlacementSchema.optional(),
  templateId: proofTemplateSchema.default("40oz_tumbler_wrap"),
  dpi: z.number().int().positive().optional(),
  uiSettings: proofUiSettingsSchema.optional()
}).transform((value) => ({ ...value, placementMm: value.placementMm ?? value.placement }))
  .pipe(z.object({
    placementMm: proofPlacementSchema,
    placement: proofPlacementSchema.optional(),
    templateId: proofTemplateSchema,
    dpi: z.number().int().positive().optional(),
    uiSettings: proofUiSettingsSchema.optional()
  }));

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const input = schema.parse(body);
    const data = await updateProofPlacement((await params).id, input.placementMm, input.templateId, input.dpi, input.uiSettings);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
