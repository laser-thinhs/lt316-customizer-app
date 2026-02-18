import { fail, ok } from "@/lib/response";
import { createBatchRun } from "@/services/batch.service";
import { AppError } from "@/lib/errors";
import { requireApiRole } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    requireApiRole(request, ["admin", "operator"]);

    const clientKey = request.headers.get("x-forwarded-for") ?? "local";
    if (!checkRateLimit(`batch:${clientKey}`)) throw new AppError("Rate limit exceeded", 429, "RATE_LIMITED");

    return ok(await createBatchRun(await request.json()), 201);
  } catch (error) {
    return fail(error);
  }
}
