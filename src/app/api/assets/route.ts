import { z } from "zod";
import { fail, ok } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { createAssetFromUpload } from "@/services/asset.service";

const uploadFormSchema = z.object({
  designJobId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
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
