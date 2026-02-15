import path from "node:path";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/response";
import { normalizeSvg } from "@/lib/assets";
import { AppError } from "@/lib/errors";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new AppError("Asset not found", 404, "NOT_FOUND");

    const source = await fs.readFile(asset.filePath);
    const dir = path.dirname(asset.filePath);

    if (asset.mimeType === "image/svg+xml") {
      const normalized = normalizeSvg(source.toString("utf8"));
      const outputPath = path.join(dir, "normalized.svg");
      await fs.writeFile(outputPath, normalized, "utf8");
      const next = await prisma.asset.create({
        data: {
          designJobId: asset.designJobId,
          kind: "normalized",
          mimeType: "image/svg+xml",
          filePath: outputPath
        }
      });
      return ok(next, 201);
    }

    const outputPath = path.join(dir, "normalized.png");
    await fs.writeFile(outputPath, source);

    const next = await prisma.asset.create({
      data: {
        designJobId: asset.designJobId,
        kind: "normalized",
        mimeType: "image/png",
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
