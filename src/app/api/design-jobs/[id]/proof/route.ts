import { fail, ok } from "@/lib/response";
import { getDesignJobProof } from "@/services/design-job.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    return ok(await getDesignJobProof((await params).id));
  } catch (error) {
    return fail(error);
  }
}
