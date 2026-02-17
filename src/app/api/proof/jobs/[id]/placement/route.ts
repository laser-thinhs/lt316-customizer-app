import { fail, ok } from "@/lib/response";
import { proofPlacementSchema, proofTemplateSchema } from "@/schemas/proof";
import { z } from "zod";
import { updateProofPlacement } from "@/services/proof.service";

const schema = z.object({
  placement: proofPlacementSchema,
  templateId: proofTemplateSchema.default("40oz_tumbler_wrap")
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const input = schema.parse(body);
    const data = await updateProofPlacement((await params).id, input.placement, input.templateId);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
