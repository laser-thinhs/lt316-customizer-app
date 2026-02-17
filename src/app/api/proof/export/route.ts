import { fail, ok } from "@/lib/response";
import { proofExportRequestSchema } from "@/schemas/proof";
import { exportProofPackage } from "@/services/proof.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = proofExportRequestSchema.parse(body);
    const data = await exportProofPackage(input.jobId);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
