import { fail, ok } from "@/lib/response";
import { getProductProfileById } from "@/services/product-profile.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getProductProfileById(id);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
