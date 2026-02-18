import { fail, ok } from "@/lib/response";
import { requireApiRole } from "@/lib/api-auth";
import { proofRenderRequestSchema } from "@/schemas/proof";
import { renderProof } from "@/services/proof.service";

export async function POST(request: Request) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const body = await request.json();
    const input = proofRenderRequestSchema.parse(body);
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
