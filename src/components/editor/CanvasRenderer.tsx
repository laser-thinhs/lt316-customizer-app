"use client";

import { useEffect, useRef, useState } from "react";

type CanvasAsset = {
  id: string;
  type: "image" | "svg";
  url: string;
  svgContent?: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  opacity: number;
};

type CanvasSize = {
  widthMm: number;
  heightMm: number;
};

type Props = {
  canvasSize: CanvasSize;
  assets: CanvasAsset[];
  selectedAssetId?: string;
  mmScale?: number;
  gridEnabled?: boolean;
  gridSpacingMm?: number;
  showCenterlines?: boolean;
  onAssetSelect?: (assetId: string) => void;
  onAssetMove?: (assetId: string, xMm: number, yMm: number) => void;
  onAssetResize?: (assetId: string, widthMm: number, heightMm: number) => void;
  onAssetRotate?: (assetId: string, rotationDeg: number) => void;
};

const HANDLE_SIZE = 8;
const SNAP_GRID = 1; // mm

export default function CanvasRenderer({
  canvasSize,
  assets,
  selectedAssetId,
  mmScale = 3,
  gridEnabled = true,
  gridSpacingMm = 5,
  showCenterlines = true,
  onAssetSelect,
  onAssetMove,
  onAssetResize,
  onAssetRotate
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<"move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se">("move");
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, assetX: 0, assetY: 0, assetW: 0, assetH: 0 });
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [loadedSvgs, setLoadedSvgs] = useState<Record<string, SVGSVGElement>>({});

  // Load images and SVGs
  useEffect(() => {
    const loadAssets = async () => {
      const images: Record<string, HTMLImageElement> = {};
      const svgs: Record<string, SVGSVGElement> = {};

      for (const asset of assets) {
        if (asset.type === "image" && !loadedImages[asset.id]) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = asset.url;
          await new Promise((resolve) => {
            img.onload = () => {
              images[asset.id] = img;
              resolve(null);
            };
            img.onerror = resolve;
          });
        }

        if (asset.type === "svg" && !loadedSvgs[asset.id]) {
          if (asset.svgContent) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(asset.svgContent, "image/svg+xml");
            if (doc.documentElement.tagName === "svg") {
              const svgEl = doc.documentElement as SVGSVGElement;
              svgs[asset.id] = svgEl;
            }
          }
        }
      }

      if (Object.keys(images).length > 0) {
        setLoadedImages((prev) => ({ ...prev, ...images }));
      }
      if (Object.keys(svgs).length > 0) {
        setLoadedSvgs((prev) => ({ ...prev, ...svgs }));
      }
    };

    loadAssets();
  }, [assets, loadedImages, loadedSvgs]);

  // Main canvas render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const canvasWidth = canvasSize.widthMm * mmScale;
    const canvasHeight = canvasSize.heightMm * mmScale;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // White background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Grid
    if (gridEnabled) {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      const gridPx = gridSpacingMm * mmScale;
      for (let x = 0; x <= canvasWidth; x += gridPx) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      for (let y = 0; y <= canvasHeight; y += gridPx) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }
    }

    // Centerlines
    if (showCenterlines) {
      ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, canvasHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(canvasWidth, centerY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw assets
    for (const asset of assets) {
      const x = asset.xMm * mmScale;
      const y = asset.yMm * mmScale;
      const w = asset.widthMm * mmScale;
      const h = asset.heightMm * mmScale;

      ctx.save();
      ctx.globalAlpha = asset.opacity;

      // Transform: translate to center, rotate, translate back
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((asset.rotationDeg * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));

      // Draw image or SVG
      if (asset.type === "image" && loadedImages[asset.id]) {
        ctx.drawImage(loadedImages[asset.id], x, y, w, h);
      } else if (asset.type === "svg" && loadedSvgs[asset.id]) {
        // Render SVG via canvas
        const svg = loadedSvgs[asset.id];
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, x, y, w, h);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }

      ctx.restore();
    }

    // Draw selection box + handles for selected asset
    if (selectedAssetId) {
      const selected = assets.find((a) => a.id === selectedAssetId);
      if (selected) {
        const x = selected.xMm * mmScale;
        const y = selected.yMm * mmScale;
        const w = selected.widthMm * mmScale;
        const h = selected.heightMm * mmScale;

        // Selection box
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate((selected.rotationDeg * Math.PI) / 180);
        ctx.translate(-(x + w / 2), -(y + h / 2));

        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // Resize handles
        const handles = [
          { x: x, y: y, cursor: "nwse-resize", key: "nw" },
          { x: x + w, y: y, cursor: "nesw-resize", key: "ne" },
          { x: x, y: y + h, cursor: "nesw-resize", key: "sw" },
          { x: x + w, y: y + h, cursor: "nwse-resize", key: "se" }
        ];

        ctx.fillStyle = "#3b82f6";
        handles.forEach((handle) => {
          ctx.fillRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        });

        ctx.restore();
      }
    }
  }, [canvasSize, assets, selectedAssetId, mmScale, gridEnabled, gridSpacingMm, showCenterlines, loadedImages, loadedSvgs]);

  const getAssetAtPoint = (canvasX: number, canvasY: number): string | null => {
    const mmX = canvasX / mmScale;
    const mmY = canvasY / mmScale;

    // Check in reverse order (top to bottom)
    for (let i = assets.length - 1; i >= 0; i--) {
      const asset = assets[i];
      const x = asset.xMm;
      const y = asset.yMm;
      const w = asset.widthMm;
      const h = asset.heightMm;

      // Simple AABB check (not accounting for rotation, but good enough for now)
      if (mmX >= x && mmX <= x + w && mmY >= y && mmY <= y + h) {
        return asset.id;
      }
    }

    return null;
  };

  const getResizeHandle = (canvasX: number, canvasY: number, asset: CanvasAsset): string | null => {
    const x = asset.xMm * mmScale;
    const y = asset.yMm * mmScale;
    const w = asset.widthMm * mmScale;
    const h = asset.heightMm * mmScale;
    const threshold = HANDLE_SIZE + 2;

    const handles: Record<string, { x: number; y: number }> = {
      "nw": { x, y },
      "ne": { x: x + w, y },
      "sw": { x, y: y + h },
      "se": { x: x + w, y: y + h }
    };

    for (const [key, handle] of Object.entries(handles)) {
      if (Math.abs(canvasX - handle.x) < threshold && Math.abs(canvasY - handle.y) < threshold) {
        return key;
      }
    }

    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (selectedAssetId) {
      const selected = assets.find((a) => a.id === selectedAssetId);
      if (selected) {
        const handle = getResizeHandle(canvasX, canvasY, selected);
        if (handle) {
          setDragMode(`resize-${handle}` as any);
          setDragStart({
            x: canvasX,
            y: canvasY,
            assetX: selected.xMm,
            assetY: selected.yMm,
            assetW: selected.widthMm,
            assetH: selected.heightMm
          });
          setDraggedAssetId(selectedAssetId);
          setIsDragging(true);
          return;
        }
      }
    }

    const assetId = getAssetAtPoint(canvasX, canvasY);
    if (assetId) {
      onAssetSelect?.(assetId);
      const asset = assets.find((a) => a.id === assetId);
      if (asset) {
        setDragMode("move");
        setDragStart({
          x: canvasX,
          y: canvasY,
          assetX: asset.xMm,
          assetY: asset.yMm,
          assetW: asset.widthMm,
          assetH: asset.heightMm
        });
        setDraggedAssetId(assetId);
        setIsDragging(true);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (!isDragging) {
      // Update cursor on hover
      if (selectedAssetId) {
        const selected = assets.find((a) => a.id === selectedAssetId);
        if (selected) {
          const handle = getResizeHandle(canvasX, canvasY, selected);
          if (handle) {
            canvas.style.cursor = handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize";
            return;
          }
        }
      }

      const assetId = getAssetAtPoint(canvasX, canvasY);
      canvas.style.cursor = assetId ? "grab" : "default";
      return;
    }

    if (!draggedAssetId) return;

    const deltaX = (canvasX - dragStart.x) / mmScale;
    const deltaY = (canvasY - dragStart.y) / mmScale;

    if (dragMode === "move") {
      const newX = dragStart.assetX + deltaX;
      const newY = dragStart.assetY + deltaY;
      onAssetMove?.(draggedAssetId, newX, newY);
    } else if (dragMode.startsWith("resize")) {
      // Resize based on handle
      let newW = dragStart.assetW;
      let newH = dragStart.assetH;

      if (dragMode.includes("e")) {
        newW = Math.max(5, dragStart.assetW + deltaX);
      } else if (dragMode.includes("w")) {
        newW = Math.max(5, dragStart.assetW - deltaX);
      }

      if (dragMode.includes("s")) {
        newH = Math.max(5, dragStart.assetH + deltaY);
      } else if (dragMode.includes("n")) {
        newH = Math.max(5, dragStart.assetH - deltaY);
      }

      onAssetResize?.(draggedAssetId, newW, newH);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedAssetId(null);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="block cursor-default border border-slate-300 rounded bg-white"
      style={{ width: "100%", height: "auto", maxWidth: "100%" }}
    />
  );
}
