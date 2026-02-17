import { mmToPx, pxToMm } from "@/lib/units";

export function mmToCanvasPx(mm: number, dpi: number) {
  return mmToPx(mm, dpi);
}

export function canvasPxToMm(px: number, dpi: number) {
  return pxToMm(px, dpi);
}
