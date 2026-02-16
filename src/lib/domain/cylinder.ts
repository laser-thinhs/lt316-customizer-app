export function roundMm(value: number, decimals = 3): number {
  const precision = 10 ** decimals;
  return Math.round(value * precision) / precision;
}

export function circumferenceMm(diameterMm: number): number {
  return roundMm(Math.PI * diameterMm);
}

export function diameterToWrapWidthMm(diameterMm: number): number {
  return circumferenceMm(diameterMm);
}

export function mmToDegrees(xMm: number, wrapWidthMm: number): number {
  return roundMm((xMm / wrapWidthMm) * 360);
}

export function degreesToMm(deg: number, wrapWidthMm: number): number {
  return roundMm((deg / 360) * wrapWidthMm);
}
