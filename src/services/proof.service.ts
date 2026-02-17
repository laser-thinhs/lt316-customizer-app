import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createDefaultPlacementDocument } from "@/schemas/placement";
import { createTracerAsset, readTracerAsset } from "@/lib/tracer-asset-store";
import {
  MAX_COMPOSITION_ITEMS,
  ProofComposition,
  ProofCompositionItem,
  ProofRenderRequest,
  ProofTemplateId,
  createSingleItemComposition,
  proofCompositionSchema,
  proofTemplatePresets
} from "@/schemas/proof";

const execFileAsync = promisify(execFile);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function stripSvgWrapper(svg: string) {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>/i, "")
    .trim();
}

async function getCompositionForJob(jobId: string): Promise<ProofComposition> {
  const job = await prisma.designJob.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError("Design job not found", 404, "NOT_FOUND");

  const raw = (job as { proofCompositionJson?: unknown }).proofCompositionJson;
  if (raw) {
    return proofCompositionSchema.parse(raw);
  }
  if (!job.sourceSvgAssetId) {
    throw new AppError("Proof job is missing source asset", 400, "INVALID_PROOF_JOB");
  }

  const legacyPlacement = (job.proofPlacementJson ?? undefined) as {
    scalePercent: number;
    rotateDeg: number;
    xMm: number;
    yMm: number;
    mirrorH: boolean;
    mirrorV: boolean;
  } | undefined;
  const migrated = createSingleItemComposition({
    svgAssetId: job.sourceSvgAssetId,
    templateId: (job.proofTemplateId as ProofTemplateId) ?? "40oz_tumbler_wrap",
    placement: legacyPlacement
  });

  await prisma.designJob.update({ where: { id: jobId }, data: { proofCompositionJson: migrated as unknown as object } as never });
  return migrated;
}

async function buildCompositionSvg(composition: ProofComposition, outWidthPx: number, production = false) {
  const preset = proofTemplatePresets[composition.templateId];
  const outHeightPx = Math.round((preset.heightMm / preset.widthMm) * outWidthPx);
  const pxPerMm = outWidthPx / preset.widthMm;

  const assetIds = Array.from(new Set(composition.items.flatMap((item) => ("assetId" in item ? [item.assetId] : []))));
  const assetCache = new Map<string, Awaited<ReturnType<typeof readTracerAsset>>>();
  await Promise.all(assetIds.map(async (id) => {
    assetCache.set(id, await readTracerAsset(id));
  }));

  const body: string[] = [];
  for (const itemId of composition.order) {
    const item = composition.items.find((entry) => entry.id === itemId);
    if (!item || item.hidden) continue;

    const t = item.transformMm;
    const x = t.x * pxPerMm;
    const y = t.y * pxPerMm;
    const scaleX = t.scale * (t.flipH ? -1 : 1);
    const scaleY = t.scale * (t.flipV ? -1 : 1);

    const style = `opacity:${item.opacity};mix-blend-mode:${item.blendMode ?? "normal"};`;

    if (item.type === "svg") {
      const asset = assetCache.get(item.assetId);
      if (!asset) continue;
      body.push(`<g data-item-id="${item.id}" transform="translate(${x} ${y}) rotate(${t.rotation}) scale(${scaleX} ${scaleY})" style="${style}">${stripSvgWrapper(asset.buffer.toString("utf8"))}</g>`);
    }

    if (item.type === "image") {
      const asset = assetCache.get(item.assetId);
      if (!asset) continue;
      const sourceBuffer = production || asset.buffer.byteLength <= MAX_IMAGE_BYTES ? asset.buffer : await sharp(asset.buffer).resize({ width: 1800, withoutEnlargement: true }).png().toBuffer();
      const dataUri = `data:${asset.mimeType};base64,${sourceBuffer.toString("base64")}`;
      const meta = await sharp(sourceBuffer).metadata();
      const w = meta.width ?? 512;
      const h = meta.height ?? 512;
      body.push(`<g data-item-id="${item.id}" transform="translate(${x} ${y}) rotate(${t.rotation}) scale(${scaleX} ${scaleY})" style="${style}"><image href="${dataUri}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" /></g>`);
    }

    if (item.type === "text") {
      body.push(`<g data-item-id="${item.id}" transform="translate(${x} ${y}) rotate(${t.rotation}) scale(${scaleX} ${scaleY})" style="${style}"><text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="22" font-family="Inter, Arial, sans-serif">${item.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></g>`);
    }
  }

  return {
    outHeightPx,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidthPx}" height="${outHeightPx}" viewBox="0 0 ${outWidthPx} ${outHeightPx}">
      <rect x="0" y="0" width="${outWidthPx}" height="${outHeightPx}" fill="#f8fafc"/>
      <rect x="1" y="1" width="${outWidthPx - 2}" height="${outHeightPx - 2}" fill="none" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="${proofTemplatePresets[composition.templateId].safeMarginMm * pxPerMm}" y="${proofTemplatePresets[composition.templateId].safeMarginMm * pxPerMm}" width="${outWidthPx - proofTemplatePresets[composition.templateId].safeMarginMm * pxPerMm * 2}" height="${outHeightPx - proofTemplatePresets[composition.templateId].safeMarginMm * pxPerMm * 2}" fill="none" stroke="#a3a3a3" stroke-width="1" stroke-dasharray="8 8"/>
      ${body.join("\n")}
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

  const composition = createSingleItemComposition({ svgAssetId: sourceSvgAssetId });

  return prisma.designJob.create({
    data: {
      productProfileId: product.id,
      machineProfileId: machine.id,
      placementJson: createDefaultPlacementDocument(),
      sourceSvgAssetId,
      proofTemplateId: composition.templateId,
      proofStatus: "draft",
      proofCompositionJson: composition as unknown as object
    } as never
  });
}

export async function renderProof(input: ProofRenderRequest) {
  if (input.composition.items.length > MAX_COMPOSITION_ITEMS) {
    throw new AppError(`Composition exceeds max items (${MAX_COMPOSITION_ITEMS})`, 400, "TOO_MANY_ITEMS");
  }

  const outWidthPx = input.highRes ? 4000 : 2000;
  const composed = await buildCompositionSvg(input.composition, outWidthPx, false);

  const png = await sharp(Buffer.from(composed.svg, "utf8")).png().toBuffer();
  const proofAsset = await createTracerAsset({
    buffer: png,
    mimeType: "image/png",
    originalName: `proof-${randomUUID()}.png`
  });

  return {
    proofAssetId: proofAsset.id,
    proofUrl: proofAsset.url,
    width: outWidthPx,
    height: composed.outHeightPx,
    png,
    renderSvg: composed.svg
  };
}

export async function renderProofForJob(jobId: string, highRes = false) {
  const composition = await getCompositionForJob(jobId);
  const result = await renderProof({ composition, highRes });

  await prisma.designJob.update({
    where: { id: jobId },
    data: {
      proofPngAssetId: result.proofAssetId,
      proofStatus: "proofed",
      proofImagePath: result.proofUrl,
      proofError: null
    }
  });

  return { ...result, composition };
}

export async function updateProofComposition(jobId: string, composition: ProofComposition) {
  const job = await prisma.designJob.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) throw new AppError("Design job not found", 404, "NOT_FOUND");

  return prisma.designJob.update({
    where: { id: jobId },
    data: {
      proofCompositionJson: composition as unknown as object,
      proofTemplateId: composition.templateId,
      proofStatus: "draft"
    } as never
  });
}

export async function exportProofPackage(jobId: string) {
  const composition = await getCompositionForJob(jobId);
  const preset = proofTemplatePresets[composition.templateId];

  const proof = await renderProofForJob(jobId, false);
  const production = await buildCompositionSvg(composition, 4000, true);
  const productionSvg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${preset.widthMm}mm" height="${preset.heightMm}mm" viewBox="0 0 4000 ${production.outHeightPx}">${stripSvgWrapper(production.svg)}</svg>`;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `proof-export-${jobId}-`));
  const zipPath = path.join(tempDir, "package.zip");

  const assetList = composition.items.filter((item) => "assetId" in item).map((item) => `${item.type}:${item.assetId}`);

  await fs.writeFile(path.join(tempDir, "production.svg"), productionSvg, "utf8");
  await fs.writeFile(path.join(tempDir, "proof.png"), proof.png);
  await fs.writeFile(path.join(tempDir, "composition.json"), JSON.stringify(composition, null, 2), "utf8");
  await fs.writeFile(path.join(tempDir, "template.json"), JSON.stringify(preset, null, 2), "utf8");
  await fs.writeFile(path.join(tempDir, "README.txt"), `Production package for ${jobId}\nTemplate: ${preset.label}\nWrap size: ${preset.widthMm}mm x ${preset.heightMm}mm\nAssets:\n${assetList.map((line) => `- ${line}`).join("\n")}\nText: embedded as <text> (font requirement: Inter, Arial, sans-serif)\nImages: embedded as base64\n`, "utf8");

  await execFileAsync("zip", ["-j", zipPath, "production.svg", "proof.png", "composition.json", "template.json", "README.txt"], { cwd: tempDir });
  const zipBuffer = await fs.readFile(zipPath);
  const zipAsset = await createTracerAsset({
    buffer: zipBuffer,
    mimeType: "application/zip",
    originalName: `production-package-${jobId}.zip`
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

export async function getProofComposition(jobId: string) {
  return getCompositionForJob(jobId);
}

export async function createProofImageAsset(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/png";
  if (!mimeType.startsWith("image/")) {
    throw new AppError("Only image uploads are supported", 400, "UNSUPPORTED_MIME");
  }
  return createTracerAsset({ buffer, mimeType, originalName: file.name });
}
