import { fail, ok } from "@/lib/response";
import { listV2Jobs } from "@/lib/v2/jobs-store";

export async function GET() {
  try {
    const jobs = (await listV2Jobs()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return ok({
      active: jobs.filter((job) => job.status !== "completed"),
      archive: jobs.filter((job) => job.status === "completed")
    });
  } catch (error) {
    return fail(error);
  }
}
