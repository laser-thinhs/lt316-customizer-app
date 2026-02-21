import { fail, ok } from "@/lib/response";
import { createBedPreset, duplicateBedPreset, listBedPresets } from "@/lib/v2/bed-presets-store";
import { BedPreset } from "@/core/v2/types";

export async function GET() {
  try {
    const presets = await listBedPresets();
    return ok(presets);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.duplicateFromId) {
      const duplicated = await duplicateBedPreset(body.duplicateFromId);
      if (!duplicated) {
        return Response.json({ error: { code: "NOT_FOUND", message: "Preset not found" } }, { status: 404 });
      }
      return ok(duplicated);
    }
    const created = await createBedPreset(body as Omit<BedPreset, "id">);
    return ok(created);
  } catch (error) {
    return fail(error);
  }
}
