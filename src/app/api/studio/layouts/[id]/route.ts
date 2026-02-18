import { fail, ok } from "@/lib/response";
import { requireStudioSession } from "@/lib/studio/security";
import { getStudioLayout, saveStudioLayout } from "@/lib/studio/storage";
import { studioLayoutSchema } from "@/studio/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStudioSession(false);
    const { id } = await params;
    return ok(await getStudioLayout(id));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStudioSession(true);
    const { id } = await params;
    const parsed = studioLayoutSchema.parse(await request.json());
    return ok(await saveStudioLayout(id, parsed));
  } catch (error) {
    return fail(error);
  }
}
