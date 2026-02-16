import { readTracerAsset } from "@/lib/tracer-asset-store";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const asset = await readTracerAsset(id);

    return new Response(new Uint8Array(asset.buffer), {
      status: 200,
      headers: {
        "content-type": asset.mimeType,
        "cache-control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return Response.json({ ok: false, error: { code: "ASSET_NOT_FOUND", message: "Tracer asset not found" } }, { status: 404 });
  }
}
