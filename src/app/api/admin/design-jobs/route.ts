import { fail, ok } from "@/lib/response";
import { JobStatus } from "@/core/v2/types";
import { listV2Jobs } from "@/lib/v2/jobs-store";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as JobStatus | null;
    const jobs = await listV2Jobs(status ?? undefined);
    return ok(jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  } catch (error) {
    return fail(error);
  }
}
