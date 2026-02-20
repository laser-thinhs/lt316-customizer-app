"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canvasPxToMm, mmToCanvasPx } from "./wrapCanvasUnits";

export type WrapCanvasObject = {
  id: string;
  kind: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg?: number;
  assetHref?: string;
  label?: string;
};

type WrapCanvasProps = {
  template: { widthMm: number; heightMm: number; safeMarginMm?: number };
  objects: WrapCanvasObject[];
  selectedId: string | null;
  dpi: number;
  gridEnabled: boolean;
  gridSpacingMm: 5 | 10;
  showCenterlines: boolean;
  showSafeMargin: boolean;
  keepAspectRatio: boolean;
  displayMode?: "default" | "overlay";
  onSelect: (id: string | null) => void;
  onUpdateTransform: (id: string, patch: { xMm: number; yMm: number; widthMm: number; heightMm: number }) => void;
};

type DragState =
  | { type: "move"; id: string; startX: number; startY: number; object: WrapCanvasObject; lockAxis: boolean }
  | { type: "resize"; id: string; startX: number; startY: number; object: WrapCanvasObject; handle: "nw" | "ne" | "sw" | "se" }
  | null;

const HANDLE_SIZE_MM = 2;

export default function WrapCanvas(props: WrapCanvasProps) {
  const {
    template,
    objects,
    selectedId,
    dpi,
    gridEnabled,
    gridSpacingMm,
    showCenterlines,
    showSafeMargin,
    keepAspectRatio,
    displayMode = "default",
    onSelect,
    onUpdateTransform
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>(null);

  const widthPx = useMemo(() => mmToCanvasPx(template.widthMm, dpi), [template.widthMm, dpi]);
  const heightPx = useMemo(() => mmToCanvasPx(template.heightMm, dpi), [template.heightMm, dpi]);
  const gridPx = useMemo(() => mmToCanvasPx(gridSpacingMm, dpi), [gridSpacingMm, dpi]);
  const handleSizePx = useMemo(() => mmToCanvasPx(HANDLE_SIZE_MM, dpi), [dpi]);

  const selected = useMemo(() => objects.find((entry) => entry.id === selectedId) ?? null, [objects, selectedId]);
  const isOverlay = displayMode === "overlay";
  const svgWidth = isOverlay ? "100%" : widthPx;
  const svgHeight = isOverlay ? "100%" : heightPx;

  useEffect(() => {
    if (!drag) return;

    const onPointerMove = (event: PointerEvent) => {
      const dxMm = canvasPxToMm(event.clientX - drag.startX, dpi);
      const dyMm = canvasPxToMm(event.clientY - drag.startY, dpi);

      if (drag.type === "move") {
        const lockX = drag.lockAxis && Math.abs(dxMm) < Math.abs(dyMm);
        const lockY = drag.lockAxis && !lockX;
        const xMm = Math.max(0, drag.object.xMm + (lockX ? 0 : dxMm));
        const yMm = Math.max(0, drag.object.yMm + (lockY ? 0 : dyMm));
        onUpdateTransform(drag.id, {
          xMm,
          yMm,
          widthMm: drag.object.widthMm,
          heightMm: drag.object.heightMm
        });
        return;
      }

      const minMm = 0.1;
      const aspect = Math.max(drag.object.widthMm / Math.max(drag.object.heightMm, minMm), minMm);
      const next = {
        xMm: drag.object.xMm,
        yMm: drag.object.yMm,
        widthMm: drag.object.widthMm,
        heightMm: drag.object.heightMm
      };

      if (drag.handle === "se") {
        next.widthMm = Math.max(minMm, drag.object.widthMm + dxMm);
        next.heightMm = Math.max(minMm, drag.object.heightMm + dyMm);
      } else if (drag.handle === "sw") {
        next.widthMm = Math.max(minMm, drag.object.widthMm - dxMm);
        next.heightMm = Math.max(minMm, drag.object.heightMm + dyMm);
        next.xMm = drag.object.xMm + (drag.object.widthMm - next.widthMm);
      } else if (drag.handle === "ne") {
        next.widthMm = Math.max(minMm, drag.object.widthMm + dxMm);
        next.heightMm = Math.max(minMm, drag.object.heightMm - dyMm);
        next.yMm = drag.object.yMm + (drag.object.heightMm - next.heightMm);
      } else {
        next.widthMm = Math.max(minMm, drag.object.widthMm - dxMm);
        next.heightMm = Math.max(minMm, drag.object.heightMm - dyMm);
        next.xMm = drag.object.xMm + (drag.object.widthMm - next.widthMm);
        next.yMm = drag.object.yMm + (drag.object.heightMm - next.heightMm);
      }

      if (keepAspectRatio) {
        const widthFromHeight = next.heightMm * aspect;
        const heightFromWidth = next.widthMm / aspect;
        if (Math.abs(next.widthMm - widthFromHeight) < Math.abs(next.heightMm - heightFromWidth)) {
          next.widthMm = Math.max(minMm, widthFromHeight);
        } else {
          next.heightMm = Math.max(minMm, heightFromWidth);
        }
      }

      onUpdateTransform(drag.id, next);
    };

    const onPointerUp = () => setDrag(null);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dpi, drag, keepAspectRatio, onUpdateTransform]);

  return (
    <div
      ref={containerRef}
      className={isOverlay ? "h-full w-full" : "space-y-2"}
      tabIndex={0}
      onKeyDown={(event) => {
        if (!selected) return;
        const step = event.shiftKey ? 5 : 1;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onUpdateTransform(selected.id, { ...selected, yMm: Math.max(0, selected.yMm - step) });
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          onUpdateTransform(selected.id, { ...selected, yMm: selected.yMm + step });
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          onUpdateTransform(selected.id, { ...selected, xMm: Math.max(0, selected.xMm - step) });
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onUpdateTransform(selected.id, { ...selected, xMm: selected.xMm + step });
        }
      }}
    >
      <div className={isOverlay ? "h-full w-full overflow-hidden rounded border border-transparent bg-transparent p-0" : "overflow-auto rounded border bg-slate-50 p-2"}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${widthPx} ${heightPx}`}
          className={isOverlay ? "block h-full w-full bg-transparent" : "border border-slate-300 bg-white"}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onSelect(null);
          }}
        >
          {gridEnabled ? (
            <defs>
              <pattern id="wrap-grid" width={gridPx} height={gridPx} patternUnits="userSpaceOnUse">
                <path d={`M ${gridPx} 0 L 0 0 0 ${gridPx}`} fill="none" stroke="#e2e8f0" strokeWidth={1} />
              </pattern>
            </defs>
          ) : null}
          {gridEnabled ? <rect x={0} y={0} width={widthPx} height={heightPx} fill="url(#wrap-grid)" /> : null}
          {showCenterlines ? (
            <>
              <line x1={widthPx / 2} y1={0} x2={widthPx / 2} y2={heightPx} stroke="#f97316" strokeDasharray="6 4" />
              <line x1={0} y1={heightPx / 2} x2={widthPx} y2={heightPx / 2} stroke="#f97316" strokeDasharray="6 4" />
            </>
          ) : null}
          {showSafeMargin && template.safeMarginMm ? (
            <rect
              x={mmToCanvasPx(template.safeMarginMm, dpi)}
              y={mmToCanvasPx(template.safeMarginMm, dpi)}
              width={Math.max(0, widthPx - mmToCanvasPx(template.safeMarginMm * 2, dpi))}
              height={Math.max(0, heightPx - mmToCanvasPx(template.safeMarginMm * 2, dpi))}
              fill="none"
              stroke="#10b981"
              strokeDasharray="4 4"
            />
          ) : null}

          {objects.map((object) => {
            const x = mmToCanvasPx(object.xMm, dpi);
            const y = mmToCanvasPx(object.yMm, dpi);
            const width = mmToCanvasPx(object.widthMm, dpi);
            const height = mmToCanvasPx(object.heightMm, dpi);
            const isSelected = selectedId === object.id;

            return (
              <g
                key={object.id}
                transform={`translate(${x} ${y}) rotate(${object.rotationDeg ?? 0} ${width / 2} ${height / 2})`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect(object.id);
                  setDrag({
                    type: "move",
                    id: object.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    object,
                    lockAxis: event.shiftKey
                  });
                }}
              >
                {object.assetHref ? (
                  <image href={object.assetHref} x={0} y={0} width={width} height={height} preserveAspectRatio="none" opacity={0.95} />
                ) : (
                  <rect x={0} y={0} width={width} height={height} fill="#cbd5e1" opacity={0.6} />
                )}
                <rect x={0} y={0} width={width} height={height} fill="none" stroke={isSelected ? "#2563eb" : "#64748b"} strokeWidth={isSelected ? 2 : 1} />
                {!object.assetHref ? <text x={4} y={14} fontSize={12} fill="#0f172a">{object.label ?? object.kind}</text> : null}
              </g>
            );
          })}

          {selected ? (() => {
            const x = mmToCanvasPx(selected.xMm, dpi);
            const y = mmToCanvasPx(selected.yMm, dpi);
            const width = mmToCanvasPx(selected.widthMm, dpi);
            const height = mmToCanvasPx(selected.heightMm, dpi);
            const handles: Array<{ key: "nw" | "ne" | "sw" | "se"; x: number; y: number }> = [
              { key: "nw", x: x - handleSizePx / 2, y: y - handleSizePx / 2 },
              { key: "ne", x: x + width - handleSizePx / 2, y: y - handleSizePx / 2 },
              { key: "sw", x: x - handleSizePx / 2, y: y + height - handleSizePx / 2 },
              { key: "se", x: x + width - handleSizePx / 2, y: y + height - handleSizePx / 2 }
            ];
            return (
              <>
                {handles.map((handle) => (
                  <rect
                    key={handle.key}
                    x={handle.x}
                    y={handle.y}
                    width={handleSizePx}
                    height={handleSizePx}
                    fill="#2563eb"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setDrag({ type: "resize", id: selected.id, startX: event.clientX, startY: event.clientY, object: selected, handle: handle.key });
                    }}
                  />
                ))}
              </>
            );
          })() : null}
        </svg>
      </div>
      {isOverlay ? null : <p className="text-xs text-slate-500">Canvas: {template.widthMm}mm × {template.heightMm}mm @ {dpi} DPI</p>}
    </div>
  );
}
