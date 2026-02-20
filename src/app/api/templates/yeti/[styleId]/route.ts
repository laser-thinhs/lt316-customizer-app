import { fail, ok } from "@/lib/response";
import { getYetiStyle } from "@/lib/yeti-templates";

export async function GET(_: Request, { params }: { params: Promise<{ styleId: string }> }) {
  try {
    const { styleId } = await params;
    const style = await getYetiStyle(styleId);
    if (!style) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Yeti style not found" } }, { status: 404 });
    }
    return ok(style);
  } catch (error) {
    return fail(error);
  }
}
