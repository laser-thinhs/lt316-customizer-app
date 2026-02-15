import { fail, ok } from "@/lib/response";
import { retryFailed } from "@/services/batch.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    return ok(await retryFailed((await params).id));
  } catch (error) {
    return fail(error);
  }
}
