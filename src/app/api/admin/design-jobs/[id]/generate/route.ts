import { fail, ok } from "@/lib/response";
import { generateV2Artifacts, isV2JobId } from "@/lib/v2/jobs-store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isV2JobId(id)) {
      return Response.json({ error: { code: "NOT_FOUND", message: "V2 job not found" } }, { status: 404 });
    }
    const generated = await generateV2Artifacts(id);
    if (!generated) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Design job not found" } }, { status: 404 });
    }
    return ok(generated);
  } catch (error) {
    return fail(error);
  }
}
