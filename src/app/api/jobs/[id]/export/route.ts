import { fail, ok } from "@/lib/response";
import { exportDesignJobAsAssets } from "@/services/export-artifact.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await exportDesignJobAsAssets(id);
    return ok({
      svgUrl: data.svgUrl,
      manifestUrl: data.manifestUrl,
      warnings: data.warnings,
      errors: data.errors,
      exportedAt: data.exportedAt,
      svgByteSize: data.svgByteSize,
      manifestByteSize: data.manifestByteSize,
      svg: data.svg,
      manifest: data.manifest
    });
  } catch (error) {
    return fail(error);
  }
}
