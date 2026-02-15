import { fail, ok } from "@/lib/response";
import { updateDesignJobPlacement } from "@/services/design-job.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await updateDesignJobPlacement(id, body);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
