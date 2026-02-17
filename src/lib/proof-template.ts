export type RepeatMode = "none" | "step-and-repeat";

export type ProofPlacement = {
  scalePct: number;
  rotateDeg: number;
  xPx: number;
  yPx: number;
  mirrorH: boolean;
  mirrorV: boolean;
  repeatMode: RepeatMode;
  repeatSpacingPx: number;
  safeMarginMm: number;
};

export type ProofTemplate = {
  id: string;
  name: string;
  wrapWidthMm: number;
  wrapHeightMm: number;
  previewWidthPx: number;
  previewHeightPx: number;
  highResWidthPx: number;
};

const templates: Record<string, ProofTemplate> = {
  "40oz_tumbler_wrap": {
    id: "40oz_tumbler_wrap",
    name: "40oz Tumbler Wrap",
    wrapWidthMm: 280,
    wrapHeightMm: 115,
    previewWidthPx: 2000,
    previewHeightPx: 920,
    highResWidthPx: 4000
  }
};

export function getProofTemplate(id = "40oz_tumbler_wrap") {
  return templates[id] ?? templates["40oz_tumbler_wrap"];
}

export function defaultPlacement(templateId?: string): ProofPlacement {
  const tpl = getProofTemplate(templateId);
  return {
    scalePct: 45,
    rotateDeg: 0,
    xPx: Math.round(tpl.previewWidthPx / 2),
    yPx: Math.round(tpl.previewHeightPx / 2),
    mirrorH: false,
    mirrorV: false,
    repeatMode: "none",
    repeatSpacingPx: 100,
    safeMarginMm: 5
  };
}

export function mmToPx(mm: number, template: ProofTemplate, widthPx: number) {
  return mm * (widthPx / template.wrapWidthMm);
}
