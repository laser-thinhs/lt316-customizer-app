import { fail, ok } from "@/lib/response";
import { convertTextObjectToOutline } from "@/services/text/outline.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { placement: unknown; objectId: string; toleranceMm?: number };
    const result = convertTextObjectToOutline(body);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
