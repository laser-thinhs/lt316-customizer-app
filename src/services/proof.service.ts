import path from "node:path";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { readTracerAsset } from "@/lib/tracer-asset-store";
import { buildStoredAssetFilename, createAssetId, ensureDesignJobAssetDir, asAssetPublicUrl } from "@/lib/assets";
import { createPng } from "@/lib/png";
import { buildZip } from "@/lib/zip";
import { defaultPlacement, getProofTemplate, mmToPx, ProofPlacement } from "@/lib/proof-template";

function safeParsePlacement(raw: unknown, templateId?: string): ProofPlacement {
  const base = defaultPlacement(templateId);
  if (!raw || typeof raw !== "object") return base;
  const val = raw as Record<string, unknown>;
  return {
    scalePct: Number(val.scalePct ?? base.scalePct),
    rotateDeg: Number(val.rotateDeg ?? base.rotateDeg),
    xPx: Number(val.xPx ?? base.xPx),
    yPx: Number(val.yPx ?? base.yPx),
    mirrorH: Boolean(val.mirrorH ?? base.mirrorH),
    mirrorV: Boolean(val.mirrorV ?? base.mirrorV),
    repeatMode: val.repeatMode === "step-and-repeat" ? "step-and-repeat" : "none",
    repeatSpacingPx: Number(val.repeatSpacingPx ?? base.repeatSpacingPx),
    safeMarginMm: Number(val.safeMarginMm ?? base.safeMarginMm)
  };
}

function extractSvgBounds(svg: string) {
  const viewBox = svg.match(/viewBox\s*=\s*"([^"]+)"/i)?.[1]?.trim().split(/\s+/).map(Number);
  if (viewBox && viewBox.length === 4) return { width: viewBox[2], height: viewBox[3] };
  const w = Number(svg.match(/\bwidth\s*=\s*"([\d.]+)/i)?.[1] ?? 1000);
  const h = Number(svg.match(/\bheight\s*=\s*"([\d.]+)/i)?.[1] ?? 1000);
  return { width: w, height: h };
}

function buildPlacedSvg(svgSource: string, placement: ProofPlacement, templateId?: string) {
  const template = getProofTemplate(templateId);
  const bounds = extractSvgBounds(svgSource);
  const scale = placement.scalePct / 100;
  const baseW = bounds.width * scale;
  const baseH = bounds.height * scale;
  const mirrorX = placement.mirrorH ? -1 : 1;
  const mirrorY = placement.mirrorV ? -1 : 1;
  const encoded = Buffer.from(svgSource, "utf8").toString("base64");

  const transform = `translate(${placement.xPx} ${placement.yPx}) rotate(${placement.rotateDeg}) scale(${mirrorX} ${mirrorY}) translate(${-baseW / 2} ${-baseH / 2})`;

  const repeats: string[] = [];
  const count = placement.repeatMode === "step-and-repeat" ? 4 : 1;
  for (let i = 0; i < count; i += 1) {
    const dx = i * placement.repeatSpacingPx;
    repeats.push(`<g transform="translate(${dx} 0)"><image width="${baseW}" height="${baseH}" href="data:image/svg+xml;base64,${encoded}"/></g>`);
  }

  const safePx = mmToPx(placement.safeMarginMm, template, template.previewWidthPx);

  const previewSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${template.previewWidthPx}" height="${template.previewHeightPx}" viewBox="0 0 ${template.previewWidthPx} ${template.previewHeightPx}">
<rect width="100%" height="100%" fill="#eef2ff"/>
<rect x="40" y="40" width="${template.previewWidthPx - 80}" height="${template.previewHeightPx - 80}" rx="120" fill="#fff" stroke="#cbd5e1" stroke-width="6"/>
<rect x="${40 + safePx}" y="${40 + safePx}" width="${template.previewWidthPx - 80 - safePx * 2}" height="${template.previewHeightPx - 80 - safePx * 2}" fill="none" stroke="#94a3b8" stroke-dasharray="12 8"/>
<g transform="${transform}">${repeats.join("\n")}</g>
</svg>`;

  return { previewSvg, baseW, baseH };
}

export async function createProofJobFromTracerSvg(svgAssetId: string, templateId = "40oz_tumbler_wrap") {
  const tracerAsset = await readTracerAsset(svgAssetId);
  if (tracerAsset.mimeType !== "image/svg+xml") throw new AppError("Tracer asset is not an SVG", 400, "INVALID_SVG_ASSET");

  const [product, machine] = await Promise.all([
    prisma.productProfile.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.machineProfile.findFirst({ orderBy: { createdAt: "asc" } })
  ]);

  if (!product || !machine) throw new AppError("Missing seed product/machine profiles", 400, "MISSING_DEFAULT_PROFILES");

  const placement = defaultPlacement(templateId);
  const designJob = await prisma.designJob.create({
    data: {
      productProfileId: product.id,
      machineProfileId: machine.id,
      status: "draft",
      placementJson: { version: 2, zone: { widthMm: 238, heightMm: 100 }, objects: [] },
      proofPlacementJson: placement,
      proofTemplateId: templateId,
      proofStatus: "draft"
    }
  });

  const assetId = createAssetId();
  const dir = await ensureDesignJobAssetDir(designJob.id);
  const filePath = path.join(dir, buildStoredAssetFilename(assetId, `trace-${svgAssetId}.svg`));
  await fs.writeFile(filePath, tracerAsset.buffer);
  await prisma.asset.create({
    data: {
      id: assetId,
      designJobId: designJob.id,
      kind: "original",
      originalName: tracerAsset.originalName ?? `trace-${svgAssetId}.svg`,
      mimeType: "image/svg+xml",
      byteSize: tracerAsset.buffer.byteLength,
      filePath
    }
  });

  await prisma.designJob.update({ where: { id: designJob.id }, data: { sourceSvgAssetId: assetId } });

  return { jobId: designJob.id, sourceSvgAssetId: assetId, templateId, placement };
}

export async function renderProof(input: { jobId?: string; svgAssetId?: string; placement?: unknown; templateId?: string; highRes?: boolean }) {
  let svgSource: string;
  let designJobId: string | null = null;
  let sourceAssetId = input.svgAssetId ?? null;
  let templateId = input.templateId ?? "40oz_tumbler_wrap";

  if (input.jobId) {
    const job = await prisma.designJob.findUnique({ where: { id: input.jobId } });
    if (!job) throw new AppError("Job not found", 404, "NOT_FOUND");
    designJobId = job.id;
    sourceAssetId = sourceAssetId ?? job.sourceSvgAssetId ?? null;
    templateId = input.templateId ?? job.proofTemplateId ?? templateId;
  }

  if (!sourceAssetId) throw new AppError("svgAssetId is required", 400, "MISSING_SVG_ASSET_ID");
  const asset = await prisma.asset.findUnique({ where: { id: sourceAssetId } });
  if (!asset) throw new AppError("Source SVG asset not found", 404, "SOURCE_ASSET_NOT_FOUND");

  svgSource = await fs.readFile(asset.filePath, "utf8");
  const placement = safeParsePlacement(input.placement, templateId);
  const template = getProofTemplate(templateId);
  const { previewSvg } = buildPlacedSvg(svgSource, placement, templateId);

  const width = input.highRes ? template.highResWidthPx : template.previewWidthPx;
  const height = Math.round((width / template.previewWidthPx) * template.previewHeightPx);

  const png = createPng(width, height, (x, y) => {
    const inWrap = x > width * 0.04 && x < width * 0.96 && y > height * 0.08 && y < height * 0.92;
    if (!inWrap) return [238, 242, 255, 255];
    return [255, 255, 255, 255];
  });

  const finalJobId = designJobId ?? asset.designJobId;
  const outputAssetId = createAssetId();
  const dir = await ensureDesignJobAssetDir(finalJobId);
  const proofPath = path.join(dir, buildStoredAssetFilename(outputAssetId, `proof-${Date.now()}.png`));
  await fs.writeFile(proofPath, png);
  await prisma.asset.create({
    data: {
      id: outputAssetId,
      designJobId: finalJobId,
      kind: "preview",
      originalName: "proof.png",
      mimeType: "image/png",
      byteSize: png.byteLength,
      filePath: proofPath,
      widthPx: width,
      heightPx: height
    }
  });

  await prisma.designJob.update({
    where: { id: finalJobId },
    data: {
      proofPngAssetId: outputAssetId,
      proofTemplateId: templateId,
      proofPlacementJson: placement,
      proofStatus: "ready",
      proofImagePath: proofPath
    }
  });

  return { proofAssetId: outputAssetId, proofUrl: asAssetPublicUrl(outputAssetId), width, height, previewSvg };
}

export async function exportProofPackage(jobId: string) {
  const job = await prisma.designJob.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError("Job not found", 404, "NOT_FOUND");
  if (!job.sourceSvgAssetId) throw new AppError("Job has no source SVG", 400, "MISSING_SOURCE_SVG");

  const sourceAsset = await prisma.asset.findUnique({ where: { id: job.sourceSvgAssetId } });
  if (!sourceAsset) throw new AppError("Source SVG asset missing", 404, "SOURCE_ASSET_NOT_FOUND");
  const sourceSvg = await fs.readFile(sourceAsset.filePath, "utf8");

  let proofAsset = job.proofPngAssetId ? await prisma.asset.findUnique({ where: { id: job.proofPngAssetId } }) : null;
  if (!proofAsset) {
    const rendered = await renderProof({ jobId });
    proofAsset = await prisma.asset.findUnique({ where: { id: rendered.proofAssetId } });
  }

  const template = getProofTemplate(job.proofTemplateId ?? undefined);
  const placement = safeParsePlacement(job.proofPlacementJson, template.id);
  const finalSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${template.wrapWidthMm}mm" height="${template.wrapHeightMm}mm" viewBox="0 0 ${template.wrapWidthMm} ${template.wrapHeightMm}">
  <g transform="translate(${(placement.xPx / template.previewWidthPx) * template.wrapWidthMm} ${(placement.yPx / template.previewHeightPx) * template.wrapHeightMm}) rotate(${placement.rotateDeg}) scale(${placement.mirrorH ? -1 : 1} ${placement.mirrorV ? -1 : 1}) scale(${placement.scalePct / 100})">
    ${sourceSvg.replace(/<\/?svg[^>]*>/g, "")}
  </g>
</svg>`;

  const proofBuffer = proofAsset ? await fs.readFile(proofAsset.filePath) : Buffer.alloc(0);
  const jobJson = Buffer.from(JSON.stringify({ jobId: job.id, templateId: template.id, placement, sourceSvgAssetId: job.sourceSvgAssetId, proofPngAssetId: job.proofPngAssetId, generatedAt: new Date().toISOString() }, null, 2));
  const readme = Buffer.from("Production package generated by LT316 customizer.\nUse design.svg for laser workflow and proof.png for approval.");

  const zip = buildZip([
    { name: "design.svg", data: Buffer.from(finalSvg, "utf8") },
    { name: "proof.png", data: proofBuffer },
    { name: "job.json", data: jobJson },
    { name: "README.txt", data: readme }
  ]);

  const zipAssetId = createAssetId();
  const dir = await ensureDesignJobAssetDir(job.id);
  const zipPath = path.join(dir, buildStoredAssetFilename(zipAssetId, `proof-package-${job.id}.zip`));
  await fs.writeFile(zipPath, zip);
  await prisma.asset.create({
    data: {
      id: zipAssetId,
      designJobId: job.id,
      kind: "preview",
      originalName: "production-package.zip",
      mimeType: "application/zip",
      byteSize: zip.byteLength,
      filePath: zipPath
    }
  });

  await prisma.designJob.update({ where: { id: job.id }, data: { exportZipAssetId: zipAssetId, proofStatus: "exported" } });
  return { zipAssetId, zipUrl: asAssetPublicUrl(zipAssetId) };
}
