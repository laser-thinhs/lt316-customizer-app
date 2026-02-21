import { fail, ok } from "@/lib/response";
import { deleteBedPreset, updateBedPreset } from "@/lib/v2/bed-presets-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateBedPreset(id, body);
    if (!updated) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Preset not found" } }, { status: 404 });
    }
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await deleteBedPreset(id);
    if (!deleted) {
      return Response.json({ error: { code: "INVALID_REQUEST", message: "Could not delete preset" } }, { status: 400 });
    }
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
