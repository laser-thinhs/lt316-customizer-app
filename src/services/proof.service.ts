import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createDefaultPlacementDocument } from "@/schemas/placement";
import { createTracerAsset, readTracerAsset } from "@/lib/tracer-asset-store";
import {
  ProofPlacement,
  ProofRenderRequest,
  ProofTemplateId,
  proofTemplatePresets
} from "@/schemas/proof";

const execFileAsync = promisify(execFile);

function stripSvgWrapper(svg: string) {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>/i, "")
    .trim();
}

function buildPlacedArtworkSvg(input: {
  rawSvg: string;
  placement: ProofPlacement;
  templateId: ProofTemplateId;
  outWidthPx: number;
}) {
  const preset = proofTemplatePresets[input.templateId];
  const outHeightPx = Math.round((preset.heightMm / preset.widthMm) * input.outWidthPx);
  const pxPerMm = input.outWidthPx / preset.widthMm;
  const xPx = input.placement.xMm * pxPerMm;
  const yPx = input.placement.yMm * pxPerMm;
  const sx = input.placement.scalePercent / 100 * (input.placement.mirrorH ? -1 : 1);
  const sy = input.placement.scalePercent / 100 * (input.placement.mirrorV ? -1 : 1);
  const tileStepPx = input.placement.stepMm * pxPerMm;

  const content = stripSvgWrapper(input.rawSvg);
  const repeats = input.placement.repeatMode === "step-and-repeat"
    ? Array.from({ length: 7 }, (_, idx) => {
        const offset = (idx - 3) * tileStepPx;
        return `<g transform="translate(${offset} 0)">${content}</g>`;
      }).join("\n")
    : content;

  return {
    outHeightPx,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${input.outWidthPx}" height="${outHeightPx}" viewBox="0 0 ${input.outWidthPx} ${outHeightPx}">
      <rect x="0" y="0" width="${input.outWidthPx}" height="${outHeightPx}" fill="#f8fafc"/>
      <rect x="1" y="1" width="${input.outWidthPx - 2}" height="${outHeightPx - 2}" fill="none" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="${proofTemplatePresets[input.templateId].safeMarginMm * pxPerMm}" y="${proofTemplatePresets[input.templateId].safeMarginMm * pxPerMm}" width="${input.outWidthPx - proofTemplatePresets[input.templateId].safeMarginMm * pxPerMm * 2}" height="${outHeightPx - proofTemplatePresets[input.templateId].safeMarginMm * pxPerMm * 2}" fill="none" stroke="#a3a3a3" stroke-width="1" stroke-dasharray="8 8"/>
      <g transform="translate(${xPx} ${yPx}) rotate(${input.placement.rotateDeg}) scale(${sx} ${sy})">
        ${repeats}
      </g>
    </svg>`
  };
}

export async function createProofJobFromTracerSvg(sourceSvgAssetId: string) {
  const [product, machine] = await Promise.all([
    prisma.productProfile.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.machineProfile.findFirst({ orderBy: { createdAt: "asc" } })
  ]);

  if (!product || !machine) {
    throw new AppError("Product or machine profile is missing", 400, "MISSING_BASE_PROFILES");
  }

  const placement = {
    scalePercent: 100,
    rotateDeg: 0,
    xMm: proofTemplatePresets["40oz_tumbler_wrap"].widthMm / 2,
    yMm: proofTemplatePresets["40oz_tumbler_wrap"].heightMm / 2,
    mirrorH: false,
    mirrorV: false,
    repeatMode: "none" as const,
    stepMm: 20
  };

  return prisma.designJob.create({
    data: {
      productProfileId: product.id,
      machineProfileId: machine.id,
      placementJson: createDefaultPlacementDocument(),
      sourceSvgAssetId,
      proofTemplateId: "40oz_tumbler_wrap",
      proofPlacementJson: placement,
      proofStatus: "draft"
    }
  });
}

export async function renderProof(input: ProofRenderRequest) {
  const svgAsset = await readTracerAsset(input.svgAssetId);
  const rawSvg = svgAsset.buffer.toString("utf8");
  const outWidthPx = input.highRes ? 4000 : 2000;

  const composed = buildPlacedArtworkSvg({
    rawSvg,
    placement: input.placement,
    templateId: input.templateId,
    outWidthPx
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
    width: outWidthPx,
    height: composed.outHeightPx,
    png
  };
}

export async function renderProofForJob(jobId: string, highRes = false) {
  const job = await prisma.designJob.findUnique({ where: { id: jobId } });
  if (!job || !job.sourceSvgAssetId || !job.proofTemplateId || !job.proofPlacementJson) {
    throw new AppError("Proof job is missing placement data", 400, "INVALID_PROOF_JOB");
  }

  const result = await renderProof({
    svgAssetId: job.sourceSvgAssetId,
    templateId: job.proofTemplateId as ProofTemplateId,
    placement: job.proofPlacementJson as ProofPlacement,
    highRes
  });

  await prisma.designJob.update({
    where: { id: jobId },
    data: {
      proofPngAssetId: result.proofAssetId,
      proofStatus: "proofed",
      proofImagePath: result.proofUrl,
      proofError: null
    }
  });

  return result;
}

export async function updateProofPlacement(jobId: string, placement: ProofPlacement, templateId: ProofTemplateId) {
  const job = await prisma.designJob.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) throw new AppError("Design job not found", 404, "NOT_FOUND");

  return prisma.designJob.update({
    where: { id: jobId },
    data: {
      proofPlacementJson: placement,
      proofTemplateId: templateId,
      proofStatus: "draft"
    }
  });
}

export async function exportProofPackage(jobId: string) {
  const job = await prisma.designJob.findUnique({ where: { id: jobId } });
  if (!job || !job.sourceSvgAssetId || !job.proofTemplateId || !job.proofPlacementJson) {
    throw new AppError("Proof job is missing placement data", 400, "INVALID_PROOF_JOB");
  }

  const svgAsset = await readTracerAsset(job.sourceSvgAssetId);
  const placement = job.proofPlacementJson as ProofPlacement;
  const templateId = job.proofTemplateId as ProofTemplateId;
  const preset = proofTemplatePresets[templateId];

  const proof = await renderProofForJob(jobId, false);
  const finalSvg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${preset.widthMm}mm" height="${preset.heightMm}mm" viewBox="0 0 ${preset.widthMm} ${preset.heightMm}">\n<g transform="translate(${placement.xMm} ${placement.yMm}) rotate(${placement.rotateDeg}) scale(${(placement.scalePercent / 100) * (placement.mirrorH ? -1 : 1)} ${(placement.scalePercent / 100) * (placement.mirrorV ? -1 : 1)})">\n${stripSvgWrapper(svgAsset.buffer.toString("utf8"))}\n</g>\n</svg>`;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `proof-export-${jobId}-`));
  const zipPath = path.join(tempDir, "package.zip");

  await fs.writeFile(path.join(tempDir, "design.svg"), finalSvg, "utf8");
  await fs.writeFile(path.join(tempDir, "proof.png"), proof.png);
  await fs.writeFile(
    path.join(tempDir, "job.json"),
    JSON.stringify({
      jobId: job.id,
      sourceSvgAssetId: job.sourceSvgAssetId,
      templateId,
      placement,
      proofPngAssetId: proof.proofAssetId,
      generatedAt: new Date().toISOString()
    }, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(tempDir, "README.txt"),
    `Production package for ${job.id}\nTemplate: ${preset.label}\nWrap size: ${preset.widthMm}mm x ${preset.heightMm}mm\nProof render width: ${proof.width}px\n`,
    "utf8"
  );

  await execFileAsync("zip", ["-j", zipPath, "design.svg", "proof.png", "job.json", "README.txt"], { cwd: tempDir });
  const zipBuffer = await fs.readFile(zipPath);
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
