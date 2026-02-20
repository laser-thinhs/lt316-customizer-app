import { fail, ok } from "@/lib/response";
import { isV2JobId, setV2JobStatus } from "@/lib/v2/jobs-store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isV2JobId(id)) {
      return Response.json({ error: { code: "NOT_SUPPORTED", message: "Submit endpoint is for v2 jobs." } }, { status: 400 });
    }
    const updated = await setV2JobStatus(id, "submitted");
    if (!updated) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Design job not found" } }, { status: 404 });
    }
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}