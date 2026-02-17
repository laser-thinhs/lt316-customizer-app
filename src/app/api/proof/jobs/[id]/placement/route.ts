import { fail, ok } from "@/lib/response";
import { proofCompositionSchema } from "@/schemas/proof";
import { z } from "zod";
import { getProofComposition, updateProofComposition } from "@/services/proof.service";

const schema = z.object({
  composition: proofCompositionSchema
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await getProofComposition((await params).id);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const input = schema.parse(body);
    const data = await updateProofComposition((await params).id, input.composition);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
