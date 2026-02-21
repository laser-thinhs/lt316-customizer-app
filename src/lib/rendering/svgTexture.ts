import * as THREE from "three";
import { canonicalizeSvgArtwork } from "@/lib/svg-artwork";

const DEFAULT_TEXTURE_WIDTH = 1536;
const DEFAULT_TEXTURE_HEIGHT = 768;

export type SvgTextureDebugOverlay = {
  enabled?: boolean;
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
  ctx.fillText("UP", arrowBaseX, arrowTopY - heightPx * 0.035);

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
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode SVG texture image."));
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

  const sourceWidth = image.naturalWidth || canonical.width;
  const sourceHeight = image.naturalHeight || canonical.height;
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
  texture.needsUpdate = true;
  return texture;
}

export async function loadSvgTextureFromPath(svgPath: string, debugOverlay?: SvgTextureDebugOverlay): Promise<THREE.CanvasTexture> {
  const response = await fetch(svgPath);
  if (!response.ok) {
    throw new Error(`Could not load SVG preview from ${svgPath}`);
  }

  const svgText = await response.text();
  return createSvgCanvasTexture(svgText, DEFAULT_TEXTURE_WIDTH, DEFAULT_TEXTURE_HEIGHT, debugOverlay);
}
