/**
 * Converts 2D canvas design to 3D cylinder texture with wrap-around support
 */

export type DesignParams = {
  canvasWidth: number;
  canvasHeight: number;
  assetUrl?: string;
  assetType?: "image" | "svg";
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  opacity: number;
  mmScale: number;
};

export type CylinderTextureParams = {
  circumferenceMm: number;
  heightMm: number;
  designParams: DesignParams;
};

/**
 * Create a texture canvas that wraps around the cylinder
 * The texture is as wide as the circumference and as tall as the engrave zone
 */
export async function createCylinderTexture(params: CylinderTextureParams): Promise<HTMLCanvasElement> {
  const { circumferenceMm, heightMm, designParams } = params;
  const mmScale = designParams.mmScale || 3;

  // Create texture canvas (circumference x height in pixels)
  const textureWidth = Math.ceil(circumferenceMm * mmScale);
  const textureHeight = Math.ceil(heightMm * mmScale);

  const canvas = document.createElement("canvas");
  canvas.width = textureWidth;
  canvas.height = textureHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  // White background
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, textureWidth, textureHeight);

  // Load and draw the asset
  if (designParams.assetUrl) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const x = designParams.xMm * mmScale;
          const y = designParams.yMm * mmScale;
          const w = designParams.widthMm * mmScale;
          const h = designParams.heightMm * mmScale;

          ctx.save();
          ctx.globalAlpha = designParams.opacity;

          // Apply rotation around center
          const centerX = x + w / 2;
          const centerY = y + h / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((designParams.rotationDeg * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);

          ctx.drawImage(img, x, y, w, h);
          ctx.restore();

          resolve();
        };
        img.onerror = reject;
        img.src = designParams.assetUrl!;
      });
    } catch (error) {
      console.warn("Failed to load asset for texture:", error);
      // Continue with blank texture
    }
  }

  // Draw seam line (red dashed line at x=0 and x=width to show wrap-around)
  ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, textureHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(textureWidth - 1, 0);
  ctx.lineTo(textureWidth - 1, textureHeight);
  ctx.stroke();
  ctx.setLineDash([]);

  return canvas;
}

/**
 * Apply texture with wrap-around visualization
 * Draws the texture twice (side by side) so the seam is visible in the middle
 */
export function createWrappedTexture(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const wrappedCanvas = document.createElement("canvas");
  wrappedCanvas.width = sourceCanvas.width * 2; // Double width to show wrap
  wrappedCanvas.height = sourceCanvas.height;

  const ctx = wrappedCanvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  // Draw source twice for wrap-around effect
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.drawImage(sourceCanvas, sourceCanvas.width, 0);

  return wrappedCanvas;
}
