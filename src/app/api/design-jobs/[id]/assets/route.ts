import { z } from "zod";
import { fail, ok } from "@/lib/response";
import { listDesignJobAssets } from "@/services/asset.service";

const paramsSchema = z.object({
  id: z.string().min(1)
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = paramsSchema.parse(await params);
    const assets = await listDesignJobAssets(parsed.id);
    return ok(assets);
  } catch (error) {
    return fail(error);
  }
}
