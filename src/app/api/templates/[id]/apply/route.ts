import { fail, ok } from "@/lib/response";
import { applyTemplate } from "@/services/template.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return ok(await applyTemplate(id, await request.json()));
  } catch (error) {
    return fail(error);
  }
}
