export function mmToPx(mm: number, dpi: number) {
  return (mm / 25.4) * dpi;
}

export function pxToMm(px: number, dpi: number) {
  return (px / dpi) * 25.4;
}
