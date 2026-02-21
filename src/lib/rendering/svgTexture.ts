import * as THREE from "three";
import { canonicalizeSvgArtwork } from "@/lib/svg-artwork";

const DEFAULT_TEXTURE_WIDTH = 1536;
const DEFAULT_TEXTURE_HEIGHT = 768;

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
      reject(new Error(`Failed to decode SVG texture image: ${error}`));
    };
    image.src = objectUrl;
  });
}

export async function createSvgCanvasTexture(svgText: string, widthPx = DEFAULT_TEXTURE_WIDTH, heightPx = DEFAULT_TEXTURE_HEIGHT): Promise<THREE.CanvasTexture> {
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

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
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

export async function loadSvgTextureFromPath(svgPath: string): Promise<THREE.CanvasTexture> {
  try {
    const response = await fetch(svgPath, {
      method: "GET",
      headers: { "Accept": "image/svg+xml,*/*" },
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

    return createSvgCanvasTexture(svgText);
  } catch (error) {
    throw new Error(`Failed to load SVG texture: ${error instanceof Error ? error.message : String(error)}`);
  }
}
