import { z } from "zod";
import { fail, ok } from "@/lib/response";
import { listDesignJobAssets } from "@/services/asset.service";
import { attachSvgToV2Job, getV2Asset, getV2Job, isV2JobId } from "@/lib/v2/jobs-store";

const paramsSchema = z.object({
  id: z.string().min(1)
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = paramsSchema.parse(await params);
    if (isV2JobId(parsed.id)) {
      const job = await getV2Job(parsed.id);
      if (!job?.assetId) return ok([]);
      const asset = await getV2Asset(parsed.id, job.assetId);
      return ok(asset ? [asset] : []);
    }
    const assets = await listDesignJobAssets(parsed.id);
    return ok(assets);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = paramsSchema.parse(await params);
    if (!isV2JobId(parsed.id)) {
      return Response.json({ error: { code: "NOT_SUPPORTED", message: "Use existing asset endpoints for legacy jobs." } }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: { code: "VALIDATION_ERROR", message: "file is required" } }, { status: 422 });
    }
    if (!file.name.toLowerCase().endsWith(".svg")) {
      return Response.json({ error: { code: "VALIDATION_ERROR", message: "Only SVG uploads are supported" } }, { status: 422 });
    }

    const asset = await attachSvgToV2Job(parsed.id, file);
    if (!asset) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Design job not found" } }, { status: 404 });
    }
    return ok(asset, 201);
  } catch (error) {
    return fail(error);
  }
}
