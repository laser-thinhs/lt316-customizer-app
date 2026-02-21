import { AdminAssetType } from "@/core/v2/types";
import { fail, ok } from "@/lib/response";
import { addAdminAsset, listAdminAssets } from "@/lib/v2/admin-assets-store";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") as AdminAssetType | null;
    const assets = await listAdminAssets(type ?? undefined);
    return ok(assets);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) {
      return Response.json({ error: { code: "BAD_REQUEST", message: "No files provided" } }, { status: 400 });
    }
    const created = await Promise.all(files.map((file) => addAdminAsset(file)));
    return ok(created);
  } catch (error) {
    return fail(error);
  }
}
