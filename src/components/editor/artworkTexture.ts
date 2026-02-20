import type * as ThreeModule from "three";

export type ArtworkPlacement = {
  scale: number;
  rotationDeg: number;
  offsetX: number;
  offsetY: number;
  fitMode?: "contain" | "cover" | "manual";
};

const MAX_TEXTURE_SIZE = 2048;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function sanitizePlacement(input?: Partial<ArtworkPlacement>): ArtworkPlacement {
  return {
    scale: clamp(Number(input?.scale ?? 1), 0.1, 5),
    rotationDeg: clamp(Number(input?.rotationDeg ?? 0), -180, 180),
    offsetX: clamp(Number(input?.offsetX ?? 0), 0, 1),
    offsetY: clamp(Number(input?.offsetY ?? 0), 0, 1),
    fitMode: input?.fitMode ?? "manual"
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = src;
  });
}

async function svgUrlToImage(url: string): Promise<HTMLImageElement> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not load SVG artwork.");
  }

  const svgText = await response.text();
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const blobUrl = URL.createObjectURL(blob);
  try {
    return await loadImage(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function resolveArtworkImage(sourceUrl: string, mimeType: string): Promise<HTMLImageElement> {
  if (!sourceUrl) {
    throw new Error("Upload artwork to apply texture.");
  }

  if (mimeType === "image/svg+xml") {
    return svgUrlToImage(sourceUrl);
  }

  if (mimeType.startsWith("image/")) {
    return loadImage(sourceUrl);
  }

  throw new Error("Unsupported file type. Please upload SVG, PNG, JPG, or WEBP.");
}

export async function buildCylinderTexture(input: {
  THREE: typeof ThreeModule;
  artworkUrl: string;
  artworkMime: string;
  placement: ArtworkPlacement;
}): Promise<ThreeModule.CanvasTexture> {
  const { THREE, artworkUrl, artworkMime } = input;
  const placement = sanitizePlacement(input.placement);
  const image = await resolveArtworkImage(artworkUrl, artworkMime);

  const canvas = document.createElement("canvas");
  canvas.width = MAX_TEXTURE_SIZE;
  canvas.height = MAX_TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create preview texture canvas.");
  }

  const gradient = ctx.createLinearGradient(0, 0, MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE);
  gradient.addColorStop(0, "#2d3e50");
  gradient.addColorStop(1, "#34495e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE);

  const baseScale = placement.fitMode === "cover"
    ? Math.max(MAX_TEXTURE_SIZE / image.width, MAX_TEXTURE_SIZE / image.height)
    : Math.min(MAX_TEXTURE_SIZE / image.width, MAX_TEXTURE_SIZE / image.height);
  const fitScale = placement.fitMode === "manual" ? placement.scale : baseScale;
  const drawWidth = Math.max(1, Math.min(MAX_TEXTURE_SIZE, image.width * fitScale));
  const drawHeight = Math.max(1, Math.min(MAX_TEXTURE_SIZE, image.height * fitScale));

  ctx.save();
  ctx.translate(MAX_TEXTURE_SIZE * placement.offsetX, MAX_TEXTURE_SIZE * placement.offsetY);
  ctx.rotate((placement.rotationDeg * Math.PI) / 180);
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.center.set(0.5, 0.5);
  texture.rotation = (placement.rotationDeg * Math.PI) / 180;

  const repeat = 1 / Math.max(0.1, placement.scale);
  texture.repeat.set(repeat, repeat);
  texture.offset.set(placement.offsetX, placement.offsetY);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;

  return texture;
}
