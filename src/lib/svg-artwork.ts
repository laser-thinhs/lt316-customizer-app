export type CanonicalSvgArtwork = {
  svgText: string;
  width: number;
  height: number;
  viewBox: string;
};

function parseNumericLength(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.trim().replace(/px$/i, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseViewBox(value: string | undefined): { width: number; height: number } | null {
  if (!value) return null;
  const parts = value.trim().split(/[\s,]+/).map((entry) => Number.parseFloat(entry));
  if (parts.length !== 4 || parts.some((entry) => !Number.isFinite(entry))) return null;
  const width = parts[2];
  const height = parts[3];
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function extractSvgRoot(svgText: string) {
  const match = svgText.match(/<svg\b([^>]*)>/i);
  if (!match) {
    throw new Error("Invalid SVG: missing <svg> root element.");
  }
  return { fullMatch: match[0], attrs: match[1] ?? "" };
}

export function canonicalizeSvgArtwork(svgText: string): CanonicalSvgArtwork {
  const trimmed = svgText.trim();
  const { fullMatch, attrs } = extractSvgRoot(trimmed);

  const widthAttr = attrs.match(/\bwidth\s*=\s*["']([^"']+)["']/i)?.[1];
  const heightAttr = attrs.match(/\bheight\s*=\s*["']([^"']+)["']/i)?.[1];
  const viewBoxAttr = attrs.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];

  const widthFromAttr = parseNumericLength(widthAttr);
  const heightFromAttr = parseNumericLength(heightAttr);
  const parsedViewBox = parseViewBox(viewBoxAttr);

  const width = widthFromAttr ?? parsedViewBox?.width;
  const height = heightFromAttr ?? parsedViewBox?.height;

  if (!width || !height) {
    throw new Error("Invalid SVG: width/height could not be resolved.");
  }

  const resolvedViewBox = viewBoxAttr?.trim() || `0 0 ${width} ${height}`;

  if (viewBoxAttr) {
    return {
      svgText: trimmed,
      width,
      height,
      viewBox: resolvedViewBox
    };
  }

  const injectedRoot = fullMatch.replace(/>$/, ` viewBox="${resolvedViewBox}">`);
  const withViewBox = trimmed.replace(fullMatch, injectedRoot);

  return {
    svgText: withViewBox,
    width,
    height,
    viewBox: resolvedViewBox
  };
}

export async function renderSvgToCanvas(svgText: string, sizePx: number): Promise<HTMLCanvasElement> {
  const canonical = canonicalizeSvgArtwork(svgText);

  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create canvas context for SVG rasterization.");
  }

  ctx.clearRect(0, 0, sizePx, sizePx);

  const blob = new Blob([canonical.svgText], { type: "image/svg+xml" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Failed to load SVG into image."));
      nextImage.src = objectUrl;
    });

    const sourceWidth = image.naturalWidth || canonical.width;
    const sourceHeight = image.naturalHeight || canonical.height;
    const scale = Math.min(sizePx / sourceWidth, sizePx / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const x = (sizePx - drawWidth) / 2;
    const y = (sizePx - drawHeight) / 2;

    ctx.drawImage(image, x, y, drawWidth, drawHeight);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
