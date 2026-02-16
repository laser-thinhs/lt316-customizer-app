import { NextResponse } from "next/server";
import { getDesignJobById } from "@/services/design-job.service";
import { fail } from "@/lib/response";
import { PlacementObject } from "@/schemas/placement";

type Params = { params: Promise<{ id: string }> };

type Bounds = { minX: number; maxX: number };

function objectBounds(object: PlacementObject): Bounds {
  const x = object.offsetXMm;
  const width = object.boxWidthMm;

  switch (object.anchor) {
    case "center":
      return { minX: x - width / 2, maxX: x + width / 2 };
    case "top-left":
    case "bottom-left":
      return { minX: x, maxX: x + width };
    case "top-right":
    case "bottom-right":
      return { minX: x - width, maxX: x };
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function objectToSvg(object: PlacementObject, translateX = 0): string {
  const commonTransform = `translate(${object.offsetXMm + translateX} ${object.offsetYMm}) rotate(${object.rotationDeg})`;

  if (object.kind === "vector") {
    return `<path id="${escapeXml(object.id)}" d="${escapeXml(object.pathData)}" transform="${commonTransform}" fill="none" stroke="black" stroke-width="${Math.max(object.strokeWidthMm ?? 0.1, 0.1)}" />`;
  }

  if (object.kind === "image") {
    const { minX } = objectBounds(object);
    return `<rect id="${escapeXml(object.id)}" x="${minX + translateX}" y="${object.offsetYMm}" width="${object.boxWidthMm}" height="${object.boxHeightMm}" fill="none" stroke="black" stroke-width="0.1" />`;
  }

  const textAnchor = object.horizontalAlign === "center" ? "middle" : object.horizontalAlign === "right" ? "end" : "start";
  const fontStyle = `${object.fontStyle}${object.fontWeight >= 700 ? " font-weight:700;" : ""}`;
  const fill = object.fillMode === "stroke" ? "none" : "black";
  const stroke = object.fillMode === "stroke" ? "black" : "none";

  return `<text id="${escapeXml(object.id)}" transform="${commonTransform}" font-family="${escapeXml(object.fontFamily)}" font-size="${object.fontSizeMm}mm" text-anchor="${textAnchor}" style="font-style:${fontStyle}" letter-spacing="${object.letterSpacingMm}mm" fill="${fill}" stroke="${stroke}" stroke-width="${object.strokeWidthMm}">${escapeXml(object.content)}</text>`;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const job = await getDesignJobById(id);
    const includeGuides = new URL(request.url).searchParams.get("guides") === "1";
    const sortedObjects = [...job.placementJson.objects].sort((a, b) =>
      a.zIndex === b.zIndex ? a.id.localeCompare(b.id) : a.zIndex - b.zIndex
    );

    const wrap = job.placementJson.wrap;
    const wrapEnabled = Boolean(wrap?.enabled);
    const wrapWidth = wrap?.wrapWidthMm ?? job.placementJson.canvas.widthMm;
    const overlap = wrap?.microOverlapMm ?? 0;

    const objectFragments: string[] = [];
    for (const object of sortedObjects) {
      objectFragments.push(objectToSvg(object));

      if (wrapEnabled && overlap > 0) {
        const bounds = objectBounds(object);
        if (bounds.maxX >= wrapWidth - overlap) {
          objectFragments.push(objectToSvg(object, -wrapWidth));
        }
        if (bounds.minX <= overlap) {
          objectFragments.push(objectToSvg(object, wrapWidth));
        }
      }
    }

    const guides: string[] = [];
    if (includeGuides && wrapEnabled && wrap) {
      guides.push(
        `<line x1="${wrap.seamXmm}" y1="0" x2="${wrap.seamXmm}" y2="${job.placementJson.canvas.heightMm}" stroke="#ef4444" stroke-width="0.1" />`,
        `<line x1="${wrap.seamXmm + wrap.wrapWidthMm}" y1="0" x2="${wrap.seamXmm + wrap.wrapWidthMm}" y2="${job.placementJson.canvas.heightMm}" stroke="#ef4444" stroke-width="0.1" />`
      );
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${job.placementJson.canvas.widthMm}mm" height="${job.placementJson.canvas.heightMm}mm" viewBox="0 0 ${job.placementJson.canvas.widthMm} ${job.placementJson.canvas.heightMm}">\n  <g id="artwork">\n    ${objectFragments.join("\n    ")}\n  </g>\n  ${guides.length > 0 ? `<g id="guides">${guides.join("")}</g>` : ""}\n</svg>`;

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="job-${id}.svg"`
      }
    });
  } catch (error) {
    return fail(error);
  }
}
