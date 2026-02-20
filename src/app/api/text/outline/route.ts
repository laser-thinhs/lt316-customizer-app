import { fail, ok } from "@/lib/response";
import { requireApiRole } from "@/lib/api-auth";
import { convertTextObjectToOutline } from "@/services/text/outline.service";

export async function POST(request: Request) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const body = (await request.json()) as { placement: unknown; objectId: string; toleranceMm?: number };
    const result = convertTextObjectToOutline(body);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
