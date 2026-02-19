import { z } from "zod";
import { fail, ok } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { requireApiRole } from "@/lib/api-auth";
import { createAssetFromUpload, listAssetsByJobId } from "@/services/asset.service";

const uploadFormSchema = z.object({
  designJobId: z.string().min(1)
});

const listQuerySchema = z.object({
  jobId: z.string().min(1).optional(),
  designJobId: z.string().min(1).optional()
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      jobId: url.searchParams.get("jobId") ?? undefined,
      designJobId: url.searchParams.get("designJobId") ?? undefined
    });
    if (!parsed.success) {
      throw new AppError("jobId is required", 400, "INVALID_QUERY", parsed.error.issues);
    }

    const designJobId = parsed.data.jobId ?? parsed.data.designJobId;
    if (!designJobId) {
      return ok([]);
    }

    const assets = await listAssetsByJobId(designJobId);
    return ok(assets);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const form = await request.formData();
    const file = form.get("file");
    const parsed = uploadFormSchema.safeParse({ designJobId: form.get("designJobId") });

    if (!(file instanceof File)) {
      throw new AppError("file is required", 400, "INVALID_UPLOAD");
    }

    if (!parsed.success) {
      throw new AppError("designJobId is required", 400, "INVALID_UPLOAD", parsed.error.issues);
    }

    const asset = await createAssetFromUpload({ designJobId: parsed.data.designJobId, file });
    return ok(asset, 201);
  } catch (error) {
    return fail(error);
  }
}
