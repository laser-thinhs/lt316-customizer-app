import { fail, ok } from "@/lib/response";
import { requireApiRole } from "@/lib/api-auth";
import { createDesignJob } from "@/services/design-job.service";
import { AppError } from "@/lib/errors";

function isDatabaseUnavailable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("can't reach database server") || message.includes("p1001") || message.includes("econnrefused");
}

export async function POST(request: Request) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const body = await request.json();
    const data = await createDesignJob(body);
    return ok(data, 201);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return fail(new AppError("Database is unavailable. Start PostgreSQL and try again.", 503, "DATABASE_UNAVAILABLE"));
    }
    return fail(error);
  }
}
