export type FontStyle = "normal" | "italic";

export type FontVariant = {
  weight: number;
  style: FontStyle;
  filePath: string;
  displayName: string;
};

export type FontFamily = {
  family: string;
  fallback: string;
  variants: FontVariant[];
};

const REGISTRY: FontFamily[] = [
  {
    family: "Inter",
    fallback: "sans-serif",
    variants: [
      { weight: 400, style: "normal", filePath: "/fonts/Inter-Regular.woff2", displayName: "Inter Regular" },
      { weight: 700, style: "normal", filePath: "/fonts/Inter-Bold.woff2", displayName: "Inter Bold" },
      { weight: 400, style: "italic", filePath: "/fonts/Inter-Italic.woff2", displayName: "Inter Italic" }
    ]
  },
  {
    family: "Roboto Mono",
    fallback: "monospace",
    variants: [
      {
        weight: 400,
        style: "normal",
        filePath: "/fonts/RobotoMono-Regular.woff2",
        displayName: "Roboto Mono Regular"
      },
      { weight: 700, style: "normal", filePath: "/fonts/RobotoMono-Bold.woff2", displayName: "Roboto Mono Bold" }
    ]
  }
];

const ASCII_GLYPH_RANGE = /^[\x20-\x7E\n\t\r]*$/;

export function getFontRegistry() {
  return REGISTRY;
}

export function findFontVariant(fontFamily: string, fontWeight: number, fontStyle: FontStyle) {
  const family = REGISTRY.find((entry) => entry.family === fontFamily);
  if (!family) return null;

  const exact = family.variants.find((variant) => variant.weight === fontWeight && variant.style === fontStyle);
  if (exact) return { family, variant: exact };

  const styleMatch = family.variants.find((variant) => variant.style === fontStyle) ?? family.variants[0];
  return styleMatch ? { family, variant: styleMatch } : null;
}

export function getUnsupportedGlyphs(content: string) {
  if (ASCII_GLYPH_RANGE.test(content)) return [];
  return [...new Set(content.split("").filter((ch) => !ASCII_GLYPH_RANGE.test(ch)))];
}

function simpleHash(input: string) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildFontHash(fontFamily: string, fontWeight: number, fontStyle: FontStyle) {
  const variant = findFontVariant(fontFamily, fontWeight, fontStyle);
  const descriptor = variant
    ? `${variant.family.family}:${variant.variant.weight}:${variant.variant.style}:${variant.variant.filePath}`
    : `${fontFamily}:${fontWeight}:${fontStyle}:fallback`;

  return simpleHash(descriptor);
}
