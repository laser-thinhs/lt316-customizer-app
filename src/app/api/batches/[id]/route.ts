import { fail, ok } from "@/lib/response";
import { getBatchRun } from "@/services/batch.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    return ok(await getBatchRun((await params).id));
  } catch (error) {
    return fail(error);
  }
}
