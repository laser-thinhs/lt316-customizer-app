import { fail, ok } from "@/lib/response";
import { getDesignJobById } from "@/services/design-job.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getDesignJobById(id);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
