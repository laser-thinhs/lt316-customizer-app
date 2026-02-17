import { DesignJob, MachineProfile, ProductProfile } from "@prisma/client";
import { parsePlacementDocument } from "@/lib/placement/document";
import { ExportManifest, PreflightIssue, PreflightResult, exportManifestSchema, preflightResultSchema } from "@/schemas/preflight-export";
import { ImagePlacementObject, PlacementObject } from "@/schemas/placement";

type DesignJobWithAssets = DesignJob & { assets: { id: string; filePath: string }[] };

const SEAM_MARGIN_MM = 1;

function roundMm(value: number) {
  return Number(value.toFixed(3));
}

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function isImageObject(object: PlacementObject): object is ImagePlacementObject {
  return object.kind === "image";
}

function anchorToTopLeft(object: Exclude<PlacementObject, ImagePlacementObject>) {
  const halfW = object.boxWidthMm / 2;
  const halfH = object.boxHeightMm / 2;

  switch (object.anchor) {
    case "center":
      return { xMm: object.offsetXMm - halfW, yMm: object.offsetYMm - halfH };
    case "top-left":
      return { xMm: object.offsetXMm, yMm: object.offsetYMm };
    case "top-right":
      return { xMm: object.offsetXMm - object.boxWidthMm, yMm: object.offsetYMm };
    case "bottom-left":
      return { xMm: object.offsetXMm, yMm: object.offsetYMm - object.boxHeightMm };
    case "bottom-right":
      return { xMm: object.offsetXMm - object.boxWidthMm, yMm: object.offsetYMm - object.boxHeightMm };
    default:
      return { xMm: object.offsetXMm, yMm: object.offsetYMm };
  }
}

function toAbsoluteBounds(object: PlacementObject) {
  if (isImageObject(object)) {
    return {
      xMm: roundMm(object.xMm),
      yMm: roundMm(object.yMm),
      widthMm: roundMm(object.widthMm),
      heightMm: roundMm(object.heightMm)
    };
  }

  const { xMm, yMm } = anchorToTopLeft(object);
  return {
    xMm: roundMm(xMm),
    yMm: roundMm(yMm),
    widthMm: roundMm(object.boxWidthMm),
    heightMm: roundMm(object.boxHeightMm)
  };
}

function intersects(a: ReturnType<typeof toAbsoluteBounds>, b: ReturnType<typeof toAbsoluteBounds>) {
  return a.xMm < b.xMm + b.widthMm && a.xMm + a.widthMm > b.xMm && a.yMm < b.yMm + b.heightMm && a.yMm + a.heightMm > b.yMm;
}

function orderObjects(objects: PlacementObject[]) {
  return objects
    .filter((object) => object.visible !== false)
    .sort((left, right) => {
      const leftZ = "zIndex" in left ? left.zIndex : 0;
      const rightZ = "zIndex" in right ? right.zIndex : 0;

      if (leftZ !== rightZ) {
        return leftZ - rightZ;
      }

      return left.id.localeCompare(right.id);
    });
}

function transformForObject(object: PlacementObject, bounds: ReturnType<typeof toAbsoluteBounds>) {
  const cx = bounds.xMm + bounds.widthMm / 2;
  const cy = bounds.yMm + bounds.heightMm / 2;
  const transforms: string[] = [];
  if (object.rotationDeg !== 0) transforms.push(`rotate(${roundMm(object.rotationDeg)} ${roundMm(cx)} ${roundMm(cy)})`);
  if (!isImageObject(object) && (object.mirrorX || object.mirrorY)) {
    transforms.push(`translate(${roundMm(cx)} ${roundMm(cy)})`);
    transforms.push(`scale(${object.mirrorX ? -1 : 1} ${object.mirrorY ? -1 : 1})`);
    transforms.push(`translate(${roundMm(-cx)} ${roundMm(-cy)})`);
  }
  return transforms.join(" ");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function runDesignJobPreflight(input: {
  job: DesignJobWithAssets;
  productProfile: ProductProfile;
  machineProfile: MachineProfile;
}): PreflightResult {
  const issues: PreflightIssue[] = [];
  let placement;

  try {
    placement = parsePlacementDocument(input.job.placementJson);
  } catch {
    issues.push({
      code: "INVALID_PLACEMENT",
      severity: "error",
      message: "Placement payload is invalid and cannot be parsed.",
      suggestedFix: "Open the job editor and save placement again."
    });
    return preflightResultSchema.parse({ status: "fail", issues });
  }

  const zoneWidth = toNumber(input.productProfile.engraveZoneWidthMm);
  const zoneHeight = toNumber(input.productProfile.engraveZoneHeightMm);

  if (placement.canvas.widthMm > zoneWidth || placement.canvas.heightMm > zoneHeight) {
    issues.push({
      code: "CANVAS_EXCEEDS_ENGRAVE_ZONE",
      severity: "error",
      message: "Canvas dimensions exceed product engrave zone.",
      suggestedFix: "Resize canvas to fit within product profile engrave zone."
    });
  }

  const knownAssets = new Set(input.job.assets.flatMap((asset) => [asset.id, asset.filePath, `/api/assets/${asset.id}`]));
  const orderedObjects = orderObjects(placement.objects);
  const strokeThreshold = placement.machine.strokeWidthWarningThresholdMm;

  for (const object of orderedObjects) {
    const bounds = toAbsoluteBounds(object);

    const widthMm = isImageObject(object) ? object.widthMm : object.boxWidthMm;
    const heightMm = isImageObject(object) ? object.heightMm : object.boxHeightMm;

    if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) {
      issues.push({
        code: "INVALID_OBJECT_DATA",
        severity: "error",
        message: "Object has invalid geometry values.",
        objectId: object.id,
        suggestedFix: "Recreate this object in the editor."
      });
      continue;
    }

    if (bounds.xMm < 0 || bounds.yMm < 0 || bounds.xMm + bounds.widthMm > placement.canvas.widthMm || bounds.yMm + bounds.heightMm > placement.canvas.heightMm) {
      issues.push({
        code: "OBJECT_OUT_OF_CANVAS",
        severity: "error",
        message: "Object exceeds canvas bounds.",
        objectId: object.id,
        suggestedFix: "Move or resize object within canvas bounds."
      });
    }

    if (bounds.xMm < 0 || bounds.yMm < 0 || bounds.xMm + bounds.widthMm > zoneWidth || bounds.yMm + bounds.heightMm > zoneHeight) {
      issues.push({
        code: "OBJECT_OUT_OF_ENGRAVE_ZONE",
        severity: "error",
        message: "Object exceeds product engrave zone.",
        objectId: object.id,
        suggestedFix: "Clamp object to engrave zone before export."
      });
    }

    if ((object.kind === "text_line" || object.kind === "text_block" || object.kind === "text_arc") && object.fillMode === "stroke" && object.strokeWidthMm < strokeThreshold) {
      issues.push({
        code: "STROKE_TOO_THIN",
        severity: "warning",
        message: `Stroke width ${object.strokeWidthMm}mm is below threshold ${strokeThreshold}mm.`,
        objectId: object.id,
        suggestedFix: "Increase stroke width or switch to fill mode."
      });
    }

    if (object.kind === "image" && !knownAssets.has(object.assetId)) {
      issues.push({
        code: "MISSING_ASSET_REFERENCE",
        severity: "error",
        message: "Image object references a missing asset.",
        objectId: object.id,
        suggestedFix: "Upload/relink the image asset before export."
      });
    }

    if (bounds.xMm <= SEAM_MARGIN_MM || bounds.xMm + bounds.widthMm >= placement.canvas.widthMm - SEAM_MARGIN_MM) {
      issues.push({
        code: "SEAM_RISK",
        severity: "warning",
        message: "Object is very close to the seam boundary.",
        objectId: object.id,
        suggestedFix: "Offset object away from seam boundary."
      });
    }
  }

  for (let i = 0; i < orderedObjects.length; i += 1) {
    const left = orderedObjects[i];
    const leftBounds = toAbsoluteBounds(left);
    for (let j = i + 1; j < orderedObjects.length; j += 1) {
      const right = orderedObjects[j];
      const rightBounds = toAbsoluteBounds(right);
      if (intersects(leftBounds, rightBounds)) {
        issues.push({
          code: "OBJECT_OVERLAP_RISK",
          severity: "warning",
          message: `Objects ${left.id} and ${right.id} overlap and may over-burn.`,
          objectId: left.id,
          suggestedFix: "Separate objects or tune operation order/power in LightBurn."
        });
      }
    }
  }

  const status: PreflightResult["status"] = issues.some((issue) => issue.severity === "error")
    ? "fail"
    : issues.some((issue) => issue.severity === "warning")
      ? "warn"
      : "pass";

  return preflightResultSchema.parse({ status, issues });
}

export function buildExportManifest(
  job: DesignJob,
  productProfile: ProductProfile,
  machineProfile: MachineProfile,
  preflight: PreflightResult
): ExportManifest {
  const placement = parsePlacementDocument(job.placementJson);
  const ordered = orderObjects(placement.objects).map((object, index) => ({
    id: object.id,
    kind: object.kind,
    zIndex: "zIndex" in object ? object.zIndex : index,
    source: object.kind === "image"
      ? {
          anchor: "top-left",
          offsetXMm: roundMm(object.xMm),
          offsetYMm: roundMm(object.yMm),
          boxWidthMm: roundMm(object.widthMm),
          boxHeightMm: roundMm(object.heightMm),
          rotationDeg: roundMm(object.rotationDeg),
          mirrorX: false,
          mirrorY: false
        }
      : {
          anchor: object.anchor,
          offsetXMm: roundMm(object.offsetXMm),
          offsetYMm: roundMm(object.offsetYMm),
          boxWidthMm: roundMm(object.boxWidthMm),
          boxHeightMm: roundMm(object.boxHeightMm),
          rotationDeg: roundMm(object.rotationDeg),
          mirrorX: object.mirrorX,
          mirrorY: object.mirrorY
        },
    absoluteBoundsMm: toAbsoluteBounds(object)
  }));

  return exportManifestSchema.parse({
    version: "1.0",
    designJobId: job.id,
    machineProfileId: machineProfile.id,
    placementVersion: placement.version,
    createdAt: new Date().toISOString(),
    productProfile: {
      id: productProfile.id,
      sku: productProfile.sku,
      name: productProfile.name,
      engraveZoneWidthMm: toNumber(productProfile.engraveZoneWidthMm),
      engraveZoneHeightMm: toNumber(productProfile.engraveZoneHeightMm),
      diameterMm: toNumber(productProfile.diameterMm),
      heightMm: toNumber(productProfile.heightMm)
    },
    objects: ordered,
    preflight: {
      status: preflight.status,
      issueCount: preflight.issues.length,
      errorCount: preflight.issues.filter((issue) => issue.severity === "error").length,
      warningCount: preflight.issues.filter((issue) => issue.severity === "warning").length
    }
  });
}

export function buildExportSvg(job: DesignJob, productProfile: ProductProfile) {
  const placement = parsePlacementDocument(job.placementJson);
  const ordered = orderObjects(placement.objects);

  const body = ordered.map((object) => {
    const bounds = toAbsoluteBounds(object);
    const transform = transformForObject(object, bounds);
    const transformAttr = transform ? ` transform="${transform}"` : "";

    if (object.kind === "image") {
      return `<image id="${escapeXml(object.id)}" x="${bounds.xMm}" y="${bounds.yMm}" width="${bounds.widthMm}" height="${bounds.heightMm}" href="${escapeXml(`/api/assets/${object.assetId}`)}" opacity="${roundMm(object.opacity)}" preserveAspectRatio="none"${transformAttr} />`;
    }

    if (object.kind === "vector") {
      return `<path id="${escapeXml(object.id)}" d="${escapeXml(object.pathData)}" fill="none" stroke="black" stroke-width="0.1"${transformAttr} />`;
    }

    if (object.kind === "text_arc") {
      const pathId = `arc-${object.id}`;
      const startX = roundMm(bounds.xMm);
      const startY = roundMm(bounds.yMm + bounds.heightMm / 2);
      const endX = roundMm(bounds.xMm + bounds.widthMm);
      const endY = startY;
      return `<defs><path id="${escapeXml(pathId)}" d="M ${startX} ${startY} A ${roundMm(object.arc.radiusMm)} ${roundMm(object.arc.radiusMm)} 0 0 1 ${endX} ${endY}" /></defs><text id="${escapeXml(object.id)}" font-family="${escapeXml(object.fontFamily)}" font-size="${roundMm(object.fontSizeMm)}"${transformAttr}><textPath href="#${escapeXml(pathId)}">${escapeXml(object.content)}</textPath></text>`;
    }

    return `<text id="${escapeXml(object.id)}" x="${bounds.xMm}" y="${roundMm(bounds.yMm + object.fontSizeMm)}" font-family="${escapeXml(object.fontFamily)}" font-size="${roundMm(object.fontSizeMm)}"${transformAttr}>${escapeXml(object.content)}</text>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${placement.canvas.widthMm}mm" height="${placement.canvas.heightMm}mm" viewBox="0 0 ${placement.canvas.widthMm} ${placement.canvas.heightMm}" data-product-profile="${escapeXml(productProfile.id)}">\n${body}\n</svg>`;
}
