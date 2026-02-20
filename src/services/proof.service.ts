import JSZip from "jszip";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createDefaultPlacementDocument } from "@/schemas/placement";
import { createTracerAsset, readTracerAsset } from "@/lib/tracer-asset-store";
import { defaultTemplateId, getTemplateById } from "@/lib/templates";
import { mmToPx } from "@/lib/units";
import { ProofPlacement, ProofRenderRequest, proofUiSettingsSchema } from "@/schemas/proof";

function stripSvgWrapper(svg: string) {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>/i, "")
    .trim();
}

function resolvePlacementMm(raw: unknown): ProofPlacement {
  return (raw ? raw : {
    scalePercent: 100,
    rotateDeg: 0,
    xMm: getTemplateById(defaultTemplateId).wrapWidthMm / 2,
    yMm: getTemplateById(defaultTemplateId).wrapHeightMm / 2,
    mirrorH: false,
    mirrorV: false,
    repeatMode: "none",
    stepMm: 20
  }) as ProofPlacement;
}

function buildPlacedArtworkSvg(input: {
  rawSvg: string;
  placementMm: ProofPlacement;
  templateId: string;
  dpi: number;
  outWidthPx?: number;
}) {
  const template = getTemplateById(input.templateId);
  const naturalWidthPx = mmToPx(template.wrapWidthMm, input.dpi);
  const naturalHeightPx = mmToPx(template.wrapHeightMm, input.dpi);

  const outWidthPx = input.outWidthPx ?? Math.round(naturalWidthPx);
  const scaleForOutput = outWidthPx / naturalWidthPx;
  const outHeightPx = Math.round(naturalHeightPx * scaleForOutput);

  const xPx = mmToPx(input.placementMm.xMm, input.dpi) * scaleForOutput;
  const yPx = mmToPx(input.placementMm.yMm, input.dpi) * scaleForOutput;
  const sx = input.placementMm.scalePercent / 100 * (input.placementMm.mirrorH ? -1 : 1);
  const sy = input.placementMm.scalePercent / 100 * (input.placementMm.mirrorV ? -1 : 1);
  const tileStepPx = mmToPx(input.placementMm.stepMm, input.dpi) * scaleForOutput;

  const safeMarginPx = mmToPx(template.safeMarginMm ?? 0, input.dpi) * scaleForOutput;
  const bleedPx = mmToPx(template.bleedMm ?? 0, input.dpi) * scaleForOutput;
  const content = stripSvgWrapper(input.rawSvg);

  const repeats = input.placementMm.repeatMode === "step-and-repeat"
    ? Array.from({ length: 7 }, (_, idx) => {
        const offset = (idx - 3) * tileStepPx;
        return `<g transform="translate(${offset} 0)">${content}</g>`;
      }).join("\n")
    : content;

  return {
    outHeightPx,
    naturalWidthPx: Math.round(naturalWidthPx),
    naturalHeightPx: Math.round(naturalHeightPx),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidthPx}" height="${outHeightPx}" viewBox="0 0 ${outWidthPx} ${outHeightPx}">
      <rect x="0" y="0" width="${outWidthPx}" height="${outHeightPx}" fill="#f8fafc"/>
      <rect x="1" y="1" width="${outWidthPx - 2}" height="${outHeightPx - 2}" fill="none" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="${safeMarginPx}" y="${safeMarginPx}" width="${Math.max(0, outWidthPx - safeMarginPx * 2)}" height="${Math.max(0, outHeightPx - safeMarginPx * 2)}" fill="none" stroke="#a3a3a3" stroke-width="1" stroke-dasharray="8 8"/>
      <rect x="${bleedPx}" y="${bleedPx}" width="${Math.max(0, outWidthPx - bleedPx * 2)}" height="${Math.max(0, outHeightPx - bleedPx * 2)}" fill="none" stroke="#fb7185" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="${outWidthPx / 2}" y1="0" x2="${outWidthPx / 2}" y2="${outHeightPx}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="0" y1="${outHeightPx / 2}" x2="${outWidthPx}" y2="${outHeightPx / 2}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 4"/>
      <g transform="translate(${xPx} ${yPx}) rotate(${input.placementMm.rotateDeg}) scale(${sx} ${sy})">
        ${repeats}
      </g>
    </svg>`
  };
}

function buildProductionSvg(input: { rawSvg: string; templateId: string; placementMm: ProofPlacement; dpi: number }) {
  const template = getTemplateById(input.templateId);
  const widthPx = Math.round(mmToPx(template.wrapWidthMm, input.dpi));
  const heightPx = Math.round(mmToPx(template.wrapHeightMm, input.dpi));
  const xPx = mmToPx(input.placementMm.xMm, input.dpi);
  const yPx = mmToPx(input.placementMm.yMm, input.dpi);
  const sx = input.placementMm.scalePercent / 100 * (input.placementMm.mirrorH ? -1 : 1);
  const sy = input.placementMm.scalePercent / 100 * (input.placementMm.mirrorV ? -1 : 1);
  const content = stripSvgWrapper(input.rawSvg);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${template.wrapWidthMm}mm" height="${template.wrapHeightMm}mm" viewBox="0 0 ${widthPx} ${heightPx}">
  <desc>template=${template.id};dpi=${input.dpi};units=mm-canonical;bleedMm=${template.bleedMm ?? 0};safeMarginMm=${template.safeMarginMm ?? 0}</desc>
  <g transform="translate(${xPx} ${yPx}) rotate(${input.placementMm.rotateDeg}) scale(${sx} ${sy})">
    ${content}
  </g>
</svg>`;
}

export async function createProofJobFromTracerSvg(sourceSvgAssetId: string) {
  const [product, machine] = await Promise.all([
    prisma.productProfile.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.machineProfile.findFirst({ orderBy: { createdAt: "asc" } })
  ]);

  if (!product || !machine) {
    throw new AppError("Product or machine profile is missing", 400, "MISSING_BASE_PROFILES");
  }

  const template = getTemplateById(defaultTemplateId);
  const placement = resolvePlacementMm(null);

  return prisma.designJob.create({
    data: {
      productProfileId: product.id,
      machineProfileId: machine.id,
      placementJson: createDefaultPlacementDocument(),
      sourceSvgAssetId,
      proofTemplateId: template.id,
      proofDpi: template.defaultDpi,
      proofPlacementJson: placement,
      proofPlacementMmJson: placement,
      proofUiSettingsJson: proofUiSettingsSchema.parse({}),
      proofStatus: "draft"
    }
  });
}

export async function renderProof(input: ProofRenderRequest) {
  const svgAsset = await readTracerAsset(input.svgAssetId);
  const rawSvg = svgAsset.buffer.toString("utf8");
  const template = getTemplateById(input.templateId);
  const dpi = input.dpi ?? template.defaultDpi;
  const previewWidth = input.highRes ? 4000 : 2000;

  const composed = buildPlacedArtworkSvg({
    rawSvg,
    placementMm: input.placementMm,
    templateId: template.id,
    dpi,
    outWidthPx: previewWidth
  });

  const png = await sharp(Buffer.from(composed.svg, "utf8")).png().toBuffer();
  const proofAsset = await createTracerAsset({
    buffer: png,
    mimeType: "image/png",
    originalName: `proof-${input.svgAssetId}.png`
  });

  return {
    proofAssetId: proofAsset.id,
    proofUrl: proofAsset.url,
    width: previewWidth,
    height: composed.outHeightPx,
    dpi,
    png
  };
}

export async function renderProofForJob(jobId: string, highRes = false) {
  const job = await prisma.designJob.findUnique({ where: { id: jobId } });
  if (!job || !job.sourceSvgAssetId) {
    throw new AppError("Proof job is missing placement data", 400, "INVALID_PROOF_JOB");
  }

  const templateId = job.proofTemplateId ?? defaultTemplateId;
  const dpi = job.proofDpi ?? getTemplateById(templateId).defaultDpi;
  const placementMm = resolvePlacementMm(job.proofPlacementMmJson ?? job.proofPlacementJson);

  const result = await renderProof({
    svgAssetId: job.sourceSvgAssetId,
    templateId,
    dpi,
    placementMm,
    highRes
  });

  await prisma.designJob.update({
    where: { id: jobId },
    data: {
      proofPngAssetId: result.proofAssetId,
      proofStatus: "proofed",
      proofImagePath: result.proofUrl,
      proofError: null,
      proofDpi: dpi,
      proofPlacementMmJson: placementMm,
      proofPlacementJson: placementMm,
      proofTemplateId: templateId
    }
  });

  return result;
}

export async function updateProofPlacement(jobId: string, placementMm: ProofPlacement, templateId: string, dpi?: number, uiSettings?: unknown) {
  const job = await prisma.designJob.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) throw new AppError("Design job not found", 404, "NOT_FOUND");

  return prisma.designJob.update({
    where: { id: jobId },
    data: {
      proofPlacementJson: placementMm,
      proofPlacementMmJson: placementMm,
      proofTemplateId: templateId,
      proofDpi: dpi,
      proofUiSettingsJson: uiSettings ? proofUiSettingsSchema.parse(uiSettings) : undefined,
      proofStatus: "draft"
    }
  });
}

export async function exportProofPackage(jobId: string) {
  const job = await prisma.designJob.findUnique({ where: { id: jobId } });
  if (!job || !job.sourceSvgAssetId) {
    throw new AppError("Proof job is missing placement data", 400, "INVALID_PROOF_JOB");
  }

  const templateId = job.proofTemplateId ?? defaultTemplateId;
  const template = getTemplateById(templateId);
  const dpi = job.proofDpi ?? template.defaultDpi;
  const placementMm = resolvePlacementMm(job.proofPlacementMmJson ?? job.proofPlacementJson);

  const svgAsset = await readTracerAsset(job.sourceSvgAssetId);
  const rawSvg = svgAsset.buffer.toString("utf8");
  const proof = await renderProofForJob(jobId, false);
  const productionSvg = buildProductionSvg({ rawSvg, templateId, placementMm, dpi });
  const readme = `Production package for ${job.id}\nTemplate: ${template.name}\nTemplate dimensions: ${template.wrapWidthMm}mm x ${template.wrapHeightMm}mm\nDPI: ${dpi}\nBleed: ${template.bleedMm ?? 0}mm\nSafe area margin: ${template.safeMarginMm ?? 0}mm\n`;

  const zip = new JSZip();
  zip.file("production.svg", productionSvg);
  zip.file("proof.png", proof.png);
  zip.file("template.json", JSON.stringify(template, null, 2));
  zip.file("placement.json", JSON.stringify(placementMm, null, 2));
  zip.file("README.txt", readme);

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  });
  const zipAsset = await createTracerAsset({
    buffer: zipBuffer,
    mimeType: "application/zip",
    originalName: `production-package-${job.id}.zip`
  });

  await prisma.designJob.update({
    where: { id: jobId },
    data: {
      exportZipAssetId: zipAsset.id,
      proofStatus: "exported",
      status: "exported"
    }
  });

  return {
    exportAssetId: zipAsset.id,
    exportUrl: zipAsset.url,
    proofAssetId: proof.proofAssetId,
    proofUrl: proof.proofUrl
  };
}
