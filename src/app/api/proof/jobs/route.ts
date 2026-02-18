import { fail, ok } from "@/lib/response";
import { z } from "zod";
import { requireApiRole } from "@/lib/api-auth";
import { createProofJobFromTracerSvg } from "@/services/proof.service";

const schema = z.object({ svgAssetId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const body = await request.json();
    const input = schema.parse(body);
    const job = await createProofJobFromTracerSvg(input.svgAssetId);
    return ok(job, 201);
  } catch (error) {
    return fail(error);
  }
}
