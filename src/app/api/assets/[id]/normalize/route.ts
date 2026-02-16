import path from "node:path";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/response";
import { normalizeSvg } from "@/lib/assets";
import { AppError } from "@/lib/errors";
import { requireApiRole } from "@/lib/api-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const { id } = await params;
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new AppError("Asset not found", 404, "NOT_FOUND");

    const source = await fs.readFile(asset.filePath);
    const sourceDir = path.dirname(asset.filePath);
    const outputDir =
      path.basename(sourceDir) === asset.id ? sourceDir : path.join(sourceDir, asset.id);
    await fs.mkdir(outputDir, { recursive: true });

    if (asset.mimeType === "image/svg+xml") {
      const normalized = normalizeSvg(source.toString("utf8"));
      const outputPath = path.join(outputDir, "normalized.svg");
      await fs.writeFile(outputPath, normalized, "utf8");
      const next = await prisma.asset.create({
        data: {
          designJobId: asset.designJobId,
          kind: "normalized",
          originalName: asset.originalName,
          mimeType: "image/svg+xml",
          byteSize: Buffer.byteLength(normalized, "utf8"),
          filePath: outputPath
        }
      });
      return ok(next, 201);
    }

    const outputPath = path.join(outputDir, "normalized.png");
    await fs.writeFile(outputPath, source);

    const next = await prisma.asset.create({
      data: {
        designJobId: asset.designJobId,
        kind: "normalized",
        originalName: asset.originalName,
        mimeType: "image/png",
        byteSize: source.byteLength,
        filePath: outputPath,
        widthPx: asset.widthPx,
        heightPx: asset.heightPx
      }
    });

    return ok(next, 201);
  } catch (error) {
    return fail(error);
  }
}
