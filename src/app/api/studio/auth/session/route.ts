import { fail, ok } from "@/lib/response";
import { requireStudioSession } from "@/lib/studio/security";

export async function GET() {
  try {
    const { csrfToken } = await requireStudioSession(false);
    return ok({ authorized: true, csrfToken });
  } catch (error) {
    return fail(error);
  }
}
