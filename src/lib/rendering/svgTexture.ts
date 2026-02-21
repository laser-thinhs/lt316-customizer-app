import * as THREE from "three";
import { canonicalizeSvgArtwork } from "@/lib/svg-artwork";

const DEFAULT_TEXTURE_WIDTH = 1536;
const DEFAULT_TEXTURE_HEIGHT = 768;

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

export async function createSvgCanvasTexture(svgText: string, widthPx = DEFAULT_TEXTURE_WIDTH, heightPx = DEFAULT_TEXTURE_HEIGHT): Promise<THREE.CanvasTexture> {
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

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export async function loadSvgTextureFromPath(svgPath: string): Promise<THREE.CanvasTexture> {
  const response = await fetch(svgPath);
  if (!response.ok) {
    throw new Error(`Could not load SVG preview from ${svgPath}`);
  }

  const svgText = await response.text();
  return createSvgCanvasTexture(svgText);
}
