import { fail, ok } from "@/lib/response";
import { requireApiRole } from "@/lib/api-auth";
import { retryFailed } from "@/services/batch.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    return ok(await retryFailed((await params).id));
  } catch (error) {
    return fail(error);
  }
}
