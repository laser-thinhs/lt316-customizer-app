import { BedLayout, ObjectDefinition, Placement } from "@/core/v2/types";

export type LightBurnExportOrigin = "top-left";

type LightBurnExportInput = {
  svgString: string;
  placement: Placement;
  objectDefinition: ObjectDefinition;
  bedLayout?: BedLayout;
  origin?: LightBurnExportOrigin;
};

type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const SVG_NS = "http://www.w3.org/2000/svg";

function multiply(left: Matrix, right: Matrix): Matrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f
  };
}

function applyMatrix(m: Matrix, x: number, y: number) {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

function toFixedMm(value: number) {
  return Number(value.toFixed(4));
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*(["'])(.*?)\2/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) attrs[match[1]] = match[3];
  return attrs;
}

function parseViewBox(svg: string) {
  const m = svg.match(/viewBox\s*=\s*['"]\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*['"]/i);
  if (m) return { minX: Number(m[1]), minY: Number(m[2]), width: Number(m[3]), height: Number(m[4]) };
  const w = Number((svg.match(/width\s*=\s*['"]([\d.+-]+)/i) || [])[1] || "100");
  const h = Number((svg.match(/height\s*=\s*['"]([\d.+-]+)/i) || [])[1] || "100");
  return { minX: 0, minY: 0, width: w || 100, height: h || 100 };
}

function parseTransform(transform?: string): Matrix {
  if (!transform) return IDENTITY;
  const fnRe = /([a-zA-Z]+)\(([^)]*)\)/g;
  let matrix = IDENTITY;
  let match: RegExpExecArray | null;
  while ((match = fnRe.exec(transform))) {
    const fn = match[1].toLowerCase();
    const nums = match[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let next = IDENTITY;
    if (fn === "matrix" && nums.length >= 6) {
      next = { a: nums[0], b: nums[1], c: nums[2], d: nums[3], e: nums[4], f: nums[5] };
    } else if (fn === "translate") {
      next = { ...IDENTITY, e: nums[0] || 0, f: nums[1] || 0 };
    } else if (fn === "scale") {
      const sx = nums[0] ?? 1;
      const sy = nums[1] ?? sx;
      next = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
    } else if (fn === "rotate") {
      const angle = ((nums[0] || 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const cx = nums[1] || 0;
      const cy = nums[2] || 0;
      next = multiply(multiply({ ...IDENTITY, e: cx, f: cy }, { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }), { ...IDENTITY, e: -cx, f: -cy });
    }
    matrix = multiply(matrix, next);
  }
  return matrix;
}

function tokenizePath(d: string): string[] {
  return d.match(/[a-zA-Z]|[-+]?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
}

function transformPathData(d: string, matrix: Matrix): string {
  const tokens = tokenizePath(d);
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const out: string[] = [];

  const readNum = () => Number(tokens[i++]);

  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      i++;
    }
    if (!cmd) break;
    const absolute = cmd === cmd.toUpperCase();
    const base = cmd.toUpperCase();

    if (base === "Z") {
      out.push("Z");
      x = startX;
      y = startY;
      continue;
    }

    const takePoint = () => {
      const nx = readNum();
      const ny = readNum();
      const px = absolute ? nx : x + nx;
      const py = absolute ? ny : y + ny;
      return { px, py };
    };

    if (base === "M" || base === "L" || base === "T") {
      while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
        const { px, py } = takePoint();
        const p = applyMatrix(matrix, px, py);
        out.push(`${base === "M" && out.length === 0 ? "M" : base} ${toFixedMm(p.x)} ${toFixedMm(p.y)}`);
        x = px;
        y = py;
        if (base === "M" && out.length === 1) {
          startX = x;
          startY = y;
        }
      }
      continue;
    }

    if (base === "H" || base === "V") {
      while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
        const n = readNum();
        const px = base === "H" ? (absolute ? n : x + n) : x;
        const py = base === "V" ? (absolute ? n : y + n) : y;
        const p = applyMatrix(matrix, px, py);
        out.push(`L ${toFixedMm(p.x)} ${toFixedMm(p.y)}`);
        x = px;
        y = py;
      }
      continue;
    }

    if (base === "C") {
      while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
        const p1 = takePoint();
        const p2 = takePoint();
        const p3 = takePoint();
        const tp1 = applyMatrix(matrix, p1.px, p1.py);
        const tp2 = applyMatrix(matrix, p2.px, p2.py);
        const tp3 = applyMatrix(matrix, p3.px, p3.py);
        out.push(`C ${toFixedMm(tp1.x)} ${toFixedMm(tp1.y)} ${toFixedMm(tp2.x)} ${toFixedMm(tp2.y)} ${toFixedMm(tp3.x)} ${toFixedMm(tp3.y)}`);
        x = p3.px;
        y = p3.py;
      }
      continue;
    }

    if (base === "Q") {
      while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
        const p1 = takePoint();
        const p2 = takePoint();
        const tp1 = applyMatrix(matrix, p1.px, p1.py);
        const tp2 = applyMatrix(matrix, p2.px, p2.py);
        out.push(`Q ${toFixedMm(tp1.x)} ${toFixedMm(tp1.y)} ${toFixedMm(tp2.x)} ${toFixedMm(tp2.y)}`);
        x = p2.px;
        y = p2.py;
      }
      continue;
    }

    if (base === "A") {
      while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
        const rx = readNum();
        const ry = readNum();
        const xAxisRotation = readNum();
        const largeArc = readNum();
        const sweep = readNum();
        const end = takePoint();
        const tend = applyMatrix(matrix, end.px, end.py);
        const sx = Math.hypot(matrix.a, matrix.b);
        const sy = Math.hypot(matrix.c, matrix.d);
        out.push(`A ${toFixedMm(Math.abs(rx * sx))} ${toFixedMm(Math.abs(ry * sy))} ${toFixedMm(xAxisRotation)} ${largeArc} ${sweep} ${toFixedMm(tend.x)} ${toFixedMm(tend.y)}`);
        x = end.px;
        y = end.py;
      }
      continue;
    }

    return d;
  }
  return out.join(" ");
}

function attrsToStyle(attrs: Record<string, string>) {
  const stroke = attrs.stroke || "#000000";
  const strokeWidth = attrs["stroke-width"] || "1";
  return `fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"`;
}

function shapeToPath(name: string, attrs: Record<string, string>): string | null {
  if (name === "path" && attrs.d) return attrs.d;
  if (name === "rect") {
    const x = Number(attrs.x || 0); const y = Number(attrs.y || 0);
    const w = Number(attrs.width || 0); const h = Number(attrs.height || 0);
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  }
  if (name === "line") return `M ${attrs.x1 || 0} ${attrs.y1 || 0} L ${attrs.x2 || 0} ${attrs.y2 || 0}`;
  if (name === "circle") {
    const cx = Number(attrs.cx || 0); const cy = Number(attrs.cy || 0); const r = Number(attrs.r || 0);
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }
  if (name === "ellipse") {
    const cx = Number(attrs.cx || 0); const cy = Number(attrs.cy || 0); const rx = Number(attrs.rx || 0); const ry = Number(attrs.ry || 0);
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  }
  if (name === "polyline" || name === "polygon") {
    const points = (attrs.points || "").trim().split(/\s+/).map((pair) => pair.split(",").map(Number)).filter((pair) => pair.length === 2 && pair.every(Number.isFinite));
    if (!points.length) return null;
    const first = points[0];
    const tail = points.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(" ");
    return `M ${first[0]} ${first[1]} ${tail}${name === "polygon" ? " Z" : ""}`;
  }
  return null;
}

function collectFlattenedPaths(svg: string, baseMatrix: Matrix) {
  const out: string[] = [];
  const shapeRe = /<(path|rect|circle|ellipse|line|polyline|polygon)\b([^>]*)\/?>(?:<\/\1>)?/gi;
  let m: RegExpExecArray | null;
  while ((m = shapeRe.exec(svg))) {
    const tag = m[0];
    const name = m[1].toLowerCase();
    const attrs = parseAttributes(tag);
    const d = shapeToPath(name, attrs);
    if (!d) continue;
    const local = parseTransform(attrs.transform);
    const flattened = transformPathData(d, multiply(baseMatrix, local));
    out.push(`<path d="${flattened}" ${attrsToStyle(attrs)} />`);
  }
  return out;
}

function buildPlacementMatrix(input: LightBurnExportInput, viewBox: { minX: number; minY: number }) {
  const bed = input.bedLayout?.placedItem;
  const bedRotation = input.bedLayout?.placedItem.rotation || 0;
  const placement = input.placement;
  const seamOffset = input.objectDefinition.type === "cylinder" ? -placement.seamX_mm : 0;
  const tx = (bed?.x || 0) + placement.x_mm + seamOffset;
  const ty = (bed?.y || 0) + placement.y_mm;

  const translateToOrigin: Matrix = { ...IDENTITY, e: -viewBox.minX, f: -viewBox.minY };
  const scale: Matrix = { a: placement.scale, b: 0, c: 0, d: placement.scale, e: 0, f: 0 };
  const r1 = ((placement.rotation_deg + bedRotation) * Math.PI) / 180;
  const rotate: Matrix = { a: Math.cos(r1), b: Math.sin(r1), c: -Math.sin(r1), d: Math.cos(r1), e: 0, f: 0 };
  const translateFinal: Matrix = { ...IDENTITY, e: tx, f: ty };
  return multiply(multiply(multiply(translateFinal, rotate), scale), translateToOrigin);
}

function unwrapWidthMm(objectDefinition: ObjectDefinition) {
  if (objectDefinition.type !== "cylinder") return objectDefinition.dimensions_mm.width || objectDefinition.safeArea_mm.width;
  return Number((Math.PI * (objectDefinition.dimensions_mm.diameter || 0)).toFixed(3));
}

export function generateLightBurnSvg(input: LightBurnExportInput) {
  const viewBox = parseViewBox(input.svgString);
  const placementMatrix = buildPlacementMatrix(input, viewBox);
  const paths = collectFlattenedPaths(input.svgString, placementMatrix);
  const widthMm = input.bedLayout?.bedW_mm || unwrapWidthMm(input.objectDefinition);
  const heightMm = input.bedLayout?.bedH_mm || input.objectDefinition.dimensions_mm.height;

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${SVG_NS}" width="${toFixedMm(widthMm)}mm" height="${toFixedMm(heightMm)}mm" viewBox="0 0 ${toFixedMm(widthMm)} ${toFixedMm(heightMm)}" data-export-origin="${input.origin || "top-left"}">\n${paths.join("\n")}\n</svg>`;
}
