import { fail, ok } from "@/lib/response";
import { requireStudioSession } from "@/lib/studio/security";
import { listStudioLayouts } from "@/lib/studio/storage";

export async function GET() {
  try {
    await requireStudioSession(false);
    return ok(await listStudioLayouts());
  } catch (error) {
    return fail(error);
  }
}
