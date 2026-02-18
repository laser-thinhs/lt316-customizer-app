import { fail, ok } from "@/lib/response";
import { requireApiRole } from "@/lib/api-auth";
import { getTemplateById, updateTemplate } from "@/services/template.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    return ok(await getTemplateById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const { id } = await params;
    return ok(await updateTemplate(id, await request.json()));
  } catch (error) {
    return fail(error);
  }
}
