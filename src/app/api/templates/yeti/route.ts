import { fail, ok } from "@/lib/response";
import { getYetiTemplateManifest } from "@/lib/yeti-templates";

export async function GET() {
  try {
    return ok(await getYetiTemplateManifest());
  } catch (error) {
    return fail(error);
  }
}
