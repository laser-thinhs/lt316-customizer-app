import { getFontRegistry } from "@/lib/fonts/registry";
import { ok } from "@/lib/response";

export async function GET() {
  return ok(getFontRegistry());
}
