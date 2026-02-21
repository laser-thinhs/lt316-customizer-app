import { fail, ok } from "@/lib/response";
import { createStudioSession, verifyStudioPassword } from "@/lib/studio/security";
import { z } from "zod";

const loginSchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    const payload = loginSchema.parse(await request.json());
    verifyStudioPassword(payload.password);
    const session = await createStudioSession();
    return ok(session);
  } catch (error) {
    return fail(error);
  }
}
