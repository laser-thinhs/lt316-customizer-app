import * as THREE from "three";
import { canonicalizeSvgArtwork } from "@/lib/svg-artwork";

const DEFAULT_TEXTURE_WIDTH = 1536;
const DEFAULT_TEXTURE_HEIGHT = 768;

export type SvgTextureDebugOverlay = {
  enabled?: boolean;
};

export type WrapUvTransform = {
  rotateDeg?: number;
  flipU?: boolean;
  flipV?: boolean;
  uOffset?: number;
  vOffset?: number;
  invertSeamDirection?: boolean;
};

export type BuildWrapTextureOptions = {
  svgText: string;
  texSizePx?: { width: number; height: number };
  rotateDeg?: number;
  seamX?: number;
  wrapWidthMm?: number;
  wrapEnabled?: boolean;
  scale?: number;
  uvTransform?: WrapUvTransform;
  debugOverlay?: SvgTextureDebugOverlay;
};

function drawDebugUvOverlay(ctx: CanvasRenderingContext2D, widthPx: number, heightPx: number) {
  const seamX = Math.round(widthPx * 0.02);

  ctx.save();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
  ctx.lineWidth = Math.max(2, Math.round(widthPx * 0.006));
  ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
  ctx.font = `bold ${Math.max(24, Math.round(heightPx * 0.07))}px sans-serif`;
  ctx.textAlign = "center";

  const arrowBaseX = widthPx * 0.9;
  const arrowBaseY = heightPx * 0.82;
  const arrowTopY = heightPx * 0.18;

  ctx.beginPath();
  ctx.moveTo(arrowBaseX, arrowBaseY);
  ctx.lineTo(arrowBaseX, arrowTopY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(arrowBaseX, arrowTopY);
  ctx.lineTo(arrowBaseX - widthPx * 0.03, arrowTopY + heightPx * 0.055);
  ctx.lineTo(arrowBaseX + widthPx * 0.03, arrowTopY + heightPx * 0.055);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.fillText("UP ↑", arrowBaseX, arrowTopY - heightPx * 0.035);

  ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
  ctx.fillRect(seamX - widthPx * 0.006, 0, widthPx * 0.012, heightPx);

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.textAlign = "left";
  ctx.fillText("SEAM", seamX + widthPx * 0.02, heightPx * 0.08);
  ctx.textAlign = "center";
  ctx.fillText("TOP", widthPx * 0.5, heightPx * 0.08);
  ctx.fillText("BOTTOM", widthPx * 0.5, heightPx * 0.95);
  ctx.restore();
}

function loadSvgImage(svgText: string): Promise<HTMLImageElement> {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode SVG texture image: ${String(error)}`));
    };
    image.src = objectUrl;
  });
}

export async function createSvgCanvasTexture(
  svgText: string,
  widthPx = DEFAULT_TEXTURE_WIDTH,
  heightPx = DEFAULT_TEXTURE_HEIGHT,
  debugOverlay?: SvgTextureDebugOverlay
): Promise<THREE.CanvasTexture> {
  try {
    const canonical = canonicalizeSvgArtwork(svgText);
    const image = await loadSvgImage(canonical.svgText);

    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create 2D canvas for SVG texture.");
    }

    ctx.clearRect(0, 0, widthPx, heightPx);
    ctx.fillStyle = "rgba(255, 255, 255, 0)";
    ctx.fillRect(0, 0, widthPx, heightPx);

    const sourceWidth = image.naturalWidth || canonical.width || 1024;
    const sourceHeight = image.naturalHeight || canonical.height || 512;
    const scale = Math.min((widthPx * 0.78) / sourceWidth, (heightPx * 0.78) / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const offsetX = (widthPx - drawWidth) / 2;
    const offsetY = (heightPx - drawHeight) / 2;

    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    if (debugOverlay?.enabled) {
      drawDebugUvOverlay(ctx, widthPx, heightPx);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    return texture;
  } catch (error) {
    throw new Error(`SVG canvas texture creation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeUnitOffset(value: number) {
  return THREE.MathUtils.euclideanModulo(value, 1);
}

export function applyWrapTextureTransform(texture: THREE.Texture, options: Omit<BuildWrapTextureOptions, "svgText" | "texSizePx" | "debugOverlay">) {
  const rotationDeg = options.rotateDeg ?? 0;
  const normalizedSeamShift = options.wrapEnabled && options.wrapWidthMm && options.wrapWidthMm > 0
    ? (options.seamX ?? 0) / options.wrapWidthMm
    : 0;
  const scale = Math.max(options.scale ?? 1, 0.15);

  const uvRotateDeg = options.uvTransform?.rotateDeg ?? 0;
  const flipU = Boolean(options.uvTransform?.flipU);
  const flipV = Boolean(options.uvTransform?.flipV);
  const invertSeamDirection = Boolean(options.uvTransform?.invertSeamDirection);
  const baseUOffset = options.uvTransform?.uOffset ?? 0;
  const baseVOffset = options.uvTransform?.vOffset ?? 0;

  const seamOffset = invertSeamDirection ? -normalizedSeamShift : normalizedSeamShift;
  let uOffset = normalizeUnitOffset(baseUOffset + seamOffset);
  let vOffset = normalizeUnitOffset(baseVOffset);
  let uRepeat = 1 / scale;
  let vRepeat = 1;

  if (flipU) {
    uRepeat *= -1;
    uOffset = 1 - uOffset;
  }

  if (flipV) {
    vRepeat = -1;
    vOffset = 1 - vOffset;
  }

  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.center.set(0.5, 0.5);
  texture.matrixAutoUpdate = false;
  texture.matrix.setUvTransform(
    normalizeUnitOffset(uOffset),
    normalizeUnitOffset(vOffset),
    uRepeat,
    vRepeat,
    -THREE.MathUtils.degToRad(rotationDeg + uvRotateDeg),
    0.5,
    0.5
  );
  texture.needsUpdate = true;
}

export async function buildWrapTexture(options: BuildWrapTextureOptions): Promise<THREE.CanvasTexture> {
  const size = options.texSizePx ?? { width: DEFAULT_TEXTURE_WIDTH, height: DEFAULT_TEXTURE_HEIGHT };
  const texture = await createSvgCanvasTexture(options.svgText, size.width, size.height, options.debugOverlay);
  applyWrapTextureTransform(texture, options);
  return texture;
}

export async function loadSvgTextureFromPath(svgPath: string, debugOverlay?: SvgTextureDebugOverlay): Promise<THREE.CanvasTexture> {
  try {
    const response = await fetch(svgPath, {
      method: "GET",
      headers: { Accept: "image/svg+xml,*/*" },
      mode: "cors"
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Could not load SVG preview from ${svgPath}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("svg") && !contentType.includes("xml") && !contentType.includes("text")) {
      console.warn(`[SVG Texture] Unexpected content-type: ${contentType}`);
    }

    const svgText = await response.text();
    if (!svgText || svgText.trim().length === 0) {
      throw new Error("SVG content is empty");
    }

    return buildWrapTexture({
      svgText,
      texSizePx: { width: DEFAULT_TEXTURE_WIDTH, height: DEFAULT_TEXTURE_HEIGHT },
      debugOverlay
    });
  } catch (error) {
    throw new Error(`Failed to load SVG texture: ${error instanceof Error ? error.message : String(error)}`);
  }
}
