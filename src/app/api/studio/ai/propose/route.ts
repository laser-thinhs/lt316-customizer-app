import { fail, ok } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { checkStudioRateLimit, getRequestIp, requireStudioSession } from "@/lib/studio/security";
import { studioLayoutSchema } from "@/studio/types";
import { z } from "zod";

const schema = z.object({
  instruction: z.string().trim().min(1).max(800),
  layout: studioLayoutSchema,
  context: z.record(z.unknown()).optional()
});

export async function POST(request: Request) {
  try {
    await requireStudioSession(true);
    const ip = await getRequestIp();
    checkStudioRateLimit(`studio-ai:${ip}`);

    const payload = schema.parse(await request.json());
    const bodyRaw = JSON.stringify(payload);
    if (Buffer.byteLength(bodyRaw, "utf8") > 64_000) {
      throw new AppError("Payload too large", 413, "PAYLOAD_TOO_LARGE");
    }

    const baseUrl = process.env.STUDIO_AI_URL || "http://studio-ai:8010";
    const response = await fetch(`${baseUrl}/v1/layout/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyRaw,
      cache: "no-store"
    });

    const json = await response.json();
    if (!response.ok) {
      throw new AppError(json?.detail || "Studio AI request failed", response.status, "STUDIO_AI_ERROR");
    }

    const next = studioLayoutSchema.parse(json.next_layout);
    return ok({ ...json, next_layout: next });
  } catch (error) {
    return fail(error);
  }
}
