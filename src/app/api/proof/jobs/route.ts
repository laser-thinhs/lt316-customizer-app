import { fail, ok } from "@/lib/response";
import { createProofJobFromTracerSvg } from "@/services/proof.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createProofJobFromTracerSvg(body.svgAssetId, body.templateId);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
