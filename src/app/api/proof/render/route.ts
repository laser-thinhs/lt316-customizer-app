import { fail, ok } from "@/lib/response";
import { renderProof } from "@/services/proof.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await renderProof(body);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
