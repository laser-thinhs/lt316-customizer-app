/**
 * SVG Post-Processing Pipeline
 * Cleans, optimizes, and prepares SVG for laser cutting
 */

export type SvgStats = {
  pathCountBefore: number;
  pathCountAfter: number;
  nodeCountBefore: number;
  nodeCountAfter: number;
  bytesBefore: number;
  bytesAfter: number;
  specksRemoved: number;
};

export type SvgPostprocessOptions = {
  minSpeckArea?: number; // minimum bounding box area (px²) to keep
  decimalPlaces?: number; // round coords to this many places
  simplifyTolerance?: number; // simplification tolerance (0-1)
  removeMetadata?: boolean;
  outputMode?: "fill" | "stroke"; // fill or stroke output
};

const DEFAULT_OPTIONS: Required<SvgPostprocessOptions> = {
  minSpeckArea: 10,
  decimalPlaces: 2,
  simplifyTolerance: 0.5,
  removeMetadata: true,
  outputMode: "fill"
};

/**
 * Parse SVG string and extract path data
 */
function parseSvgPaths(svg: string): Array<{ d: string; fill?: string; stroke?: string }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const paths = Array.from(doc.querySelectorAll("path"));
  return paths.map((p) => ({
    d: p.getAttribute("d") || "",
    fill: p.getAttribute("fill") ?? undefined,
    stroke: p.getAttribute("stroke") ?? undefined
  }));
}

/**
 * Compute bounding box of a path
 */
function getPathBBox(pathD: string): { x: number; y: number; width: number; height: number } | null {
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${pathD}"/></svg>`;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const path = doc.querySelector("path");
    if (!path) return null;
    const bbox = (path as any).getBBox?.();
    return bbox ? { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height } : null;
  } catch {
    return null;
  }
}

/**
 * Remove specks (very small paths by area)
 */
function removeSpecks(paths: Array<{ d: string; fill?: string; stroke?: string }>, minArea: number): Array<{ d: string; fill?: string; stroke?: string }> {
  return paths.filter((p) => {
    const bbox = getPathBBox(p.d);
    if (!bbox) return true; // keep if can't compute bbox
    const area = bbox.width * bbox.height;
    return area >= minArea;
  });
}

/**
 * Simplify path by reducing near-collinear points
 */
function simplifyPath(pathD: string, tolerance: number): string {
  if (!pathD || tolerance < 0) return pathD;

  // Simple regex-based point extraction (M, L, C commands)
  const commands = pathD.match(/[a-zA-Z]|[-+]?(\d+\.?\d*|\.\d+)/g) || [];
  let simplified: string[] = [];
  let i = 0;

  while (i < commands.length) {
    const cmd = commands[i];
    if (/[a-zA-Z]/.test(cmd)) {
      simplified.push(cmd);
      i++;

      // Parse coordinates based on command
      let coordCount = 0;
      if (cmd.toUpperCase() === "M" || cmd.toUpperCase() === "L") coordCount = 2;
      else if (cmd.toUpperCase() === "C") coordCount = 6;
      else if (cmd.toUpperCase() === "Q") coordCount = 4;
      else if (cmd.toUpperCase() === "A") coordCount = 7;
      else if (cmd.toUpperCase() === "Z") coordCount = 0;

      // Collect and simplify coordinates
      const coords: number[] = [];
      for (let j = 0; j < coordCount && i < commands.length; j++) {
        if (!/[a-zA-Z]/.test(commands[i])) {
          coords.push(parseFloat(commands[i]));
          i++;
        }
      }

      // Add coords (simplified via tolerance in future if needed)
      simplified.push(...coords.map((c) => c.toFixed(2)));
    } else {
      i++;
    }
  }

  return simplified.join(" ");
}

/**
 * Normalize SVG structure
 */
function normalizeSvgStructure(svg: string, options: Required<SvgPostprocessOptions>): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const svgEl = doc.documentElement;

  // Ensure viewBox
  if (!svgEl.hasAttribute("viewBox")) {
    const w = svgEl.getAttribute("width") || "100";
    const h = svgEl.getAttribute("height") || "100";
    svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }

  // Remove unit suffixes from width/height
  const width = svgEl.getAttribute("width")?.replace(/[a-z%]+/gi, "") || "";
  const height = svgEl.getAttribute("height")?.replace(/[a-z%]+/gi, "") || "";
  if (width) svgEl.setAttribute("width", width + "px");
  if (height) svgEl.setAttribute("height", height + "px");

  // Remove metadata if requested
  if (options.removeMetadata) {
    Array.from(svgEl.querySelectorAll("desc, metadata, defs, title")).forEach((el) => el.remove());
  }

  return svgEl.outerHTML || svg;
}

/**
 * Enforce numeric precision on path data
 */
function enforcePrecision(pathD: string, decimals: number): string {
  return pathD.replace(/[-+]?(\d+\.?\d*|\.\d+)/g, (match) => {
    const num = parseFloat(match);
    return isNaN(num) ? match : num.toFixed(decimals);
  });
}

/**
 * Convert fill paths to stroke (best effort)
 */
function convertFillToStroke(svg: string, strokeWidth: number = 1): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const paths = Array.from(doc.querySelectorAll("path"));

  paths.forEach((p) => {
    p.removeAttribute("fill");
    p.setAttribute("stroke", p.getAttribute("stroke") || "#000000");
    p.setAttribute("stroke-width", strokeWidth.toString());
    p.setAttribute("fill", "none");
  });

  return doc.documentElement.outerHTML || svg;
}

/**
 * Main post-processing function
 */
export function postprocessSvg(svg: string, opts?: Partial<SvgPostprocessOptions>): { optimized: string; stats: SvgStats } {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  // Count before
  const pathsBefore = parseSvgPaths(svg);
  const bytesBefore = new Blob([svg]).size;
  const nodeCountBefore = (svg.match(/[MLCQAZmlcqaz]/g) || []).length;

  // Normalize structure
  let optimized = normalizeSvgStructure(svg, options);

  // Extract and process paths
  let paths = parseSvgPaths(optimized);
  const specksRemoved = paths.length;
  paths = removeSpecks(paths, options.minSpeckArea);

  // Simplify each path
  paths = paths.map((p) => ({
    ...p,
    d: simplifyPath(enforcePrecision(p.d, options.decimalPlaces), options.simplifyTolerance)
  }));

  // Remove empty paths
  paths = paths.filter((p) => p.d.trim().length > 0);

  // Rebuild SVG
  const parser = new DOMParser();
  const doc = parser.parseFromString(optimized, "image/svg+xml");
  const pathElements = Array.from(doc.querySelectorAll("path"));
  pathElements.forEach((el) => el.remove());
  paths.forEach((p) => {
    const pathEl = doc.createElement("path");
    pathEl.setAttribute("d", p.d);
    if (p.fill) pathEl.setAttribute("fill", p.fill);
    if (p.stroke) pathEl.setAttribute("stroke", p.stroke);
    doc.documentElement.appendChild(pathEl);
  });

  // Convert to fill/stroke if needed
  if (options.outputMode === "stroke") {
    optimized = convertFillToStroke(doc.documentElement.outerHTML || optimized, 1);
  } else {
    optimized = doc.documentElement.outerHTML || optimized;
  }

  // Count after
  const pathsAfter = parseSvgPaths(optimized);
  const bytesAfter = new Blob([optimized]).size;
  const nodeCountAfter = (optimized.match(/[MLCQAZmlcqaz]/g) || []).length;

  return {
    optimized,
    stats: {
      pathCountBefore: pathsBefore.length,
      pathCountAfter: pathsAfter.length,
      nodeCountBefore,
      nodeCountAfter,
      bytesBefore,
      bytesAfter,
      specksRemoved: specksRemoved - paths.length
    }
  };
}
