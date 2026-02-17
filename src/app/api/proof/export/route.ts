import { fail, ok } from "@/lib/response";
import { exportProofPackage } from "@/services/proof.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await exportProofPackage(body.jobId);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
