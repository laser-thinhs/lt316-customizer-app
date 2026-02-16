import { fail, ok } from "@/lib/response";
import { preflightDesignJob } from "@/services/export-artifact.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await preflightDesignJob(id);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
