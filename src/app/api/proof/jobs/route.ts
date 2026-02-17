import { fail, ok } from "@/lib/response";
import { z } from "zod";
import { createProofJobFromTracerSvg, createProofImageAsset } from "@/services/proof.service";

const schema = z.object({ svgAssetId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        throw new Error("file is required");
      }
      const asset = await createProofImageAsset(file);
      return ok(asset, 201);
    }

    const body = await request.json();
    const input = schema.parse(body);
    const job = await createProofJobFromTracerSvg(input.svgAssetId);
    return ok(job, 201);
  } catch (error) {
    return fail(error);
  }
}
