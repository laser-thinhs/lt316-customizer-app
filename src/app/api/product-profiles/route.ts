import { fail, ok } from "@/lib/response";
import { listProductProfiles } from "@/services/product-profile.service";

export async function GET() {
  try {
    const data = await listProductProfiles();
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
