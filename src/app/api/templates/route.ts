import { fail, ok } from "@/lib/response";
import { createTemplate, listTemplates } from "@/services/template.service";

export async function POST(request: Request) {
  try {
    return ok(await createTemplate(await request.json()), 201);
  } catch (error) {
    return fail(error);
  }
}

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams.get("search") ?? undefined;
    return ok(await listTemplates({ search }));
  } catch (error) {
    return fail(error);
  }
}
