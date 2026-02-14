import { fail, ok } from "@/lib/response";
import { createDesignJob } from "@/services/design-job.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await createDesignJob(body);
    return ok(data, 201);
  } catch (error) {
    return fail(error);
  }
}
