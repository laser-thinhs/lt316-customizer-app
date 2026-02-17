import { fail, ok } from "@/lib/response";
import { createSingleItemComposition, proofRenderRequestSchema } from "@/schemas/proof";
import { renderProof } from "@/services/proof.service";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const normalized = body.composition
      ? body
      : {
          composition: createSingleItemComposition({
            svgAssetId: String(body.svgAssetId ?? ""),
            templateId: (body.templateId as "40oz_tumbler_wrap" | undefined) ?? "40oz_tumbler_wrap",
            placement: body.placement as never
          }),
          highRes: body.highRes
        };
    const input = proofRenderRequestSchema.parse(normalized);
    const data = await renderProof(input);
    return ok({
      proofAssetId: data.proofAssetId,
      proofUrl: data.proofUrl,
      width: data.width,
      height: data.height
    });
  } catch (error) {
    return fail(error);
  }
}
