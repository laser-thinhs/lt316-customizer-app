import { fail, ok } from "@/lib/response";
import { getBatchItems } from "@/services/batch.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    return ok(await getBatchItems((await params).id));
  } catch (error) {
    return fail(error);
  }
}
