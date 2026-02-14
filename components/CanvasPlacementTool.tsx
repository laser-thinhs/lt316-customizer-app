'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  widthMm: number;
  heightMm: number;
  assetUrl?: string;
  onTransformChange: (transform: {
    scale: number;
    xMm: number;
    yMm: number;
    rotateDeg: number;
  }) => void;
};

const CANVAS_WIDTH_PX = 800;
const CANVAS_HEIGHT_PX = 340;

export function CanvasPlacementTool({ widthMm, heightMm, assetUrl, onTransformChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(1);
  const [xMm, setXMm] = useState(0);
  const [yMm, setYMm] = useState(0);
  const [rotateDeg, setRotateDeg] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const pxPerMm = useMemo(() => CANVAS_WIDTH_PX / widthMm, [widthMm]);

  useEffect(() => {
    onTransformChange({ scale, xMm, yMm, rotateDeg });
  }, [onTransformChange, rotateDeg, scale, xMm, yMm]);

  useEffect(() => {
    if (!assetUrl) {
      setImage(null);
      return;
    }

    const img = new Image();
    img.src = assetUrl;
    img.onload = () => setImage(img);
  }, [assetUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH_PX, CANVAS_HEIGHT_PX);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_WIDTH_PX, CANVAS_HEIGHT_PX);

    const engravingHeightPx = heightMm * pxPerMm;
    const yStart = (CANVAS_HEIGHT_PX - engravingHeightPx) / 2;

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, yStart, CANVAS_WIDTH_PX, engravingHeightPx);

    ctx.strokeStyle = '#22d3ee';
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(10, yStart + 10, CANVAS_WIDTH_PX - 20, engravingHeightPx - 20);
    ctx.setLineDash([]);

    if (image) {
      const imgW = image.width * scale;
      const imgH = image.height * scale;
      const xPx = CANVAS_WIDTH_PX / 2 + xMm * pxPerMm;
      const yPx = CANVAS_HEIGHT_PX / 2 - yMm * pxPerMm;

      ctx.save();
      ctx.translate(xPx, yPx);
      ctx.rotate((rotateDeg * Math.PI) / 180);
      ctx.drawImage(image, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.restore();
    }
  }, [heightMm, image, pxPerMm, rotateDeg, scale, xMm, yMm]);

  return (
    <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH_PX}
        height={CANVAS_HEIGHT_PX}
        className="h-auto w-full rounded border border-slate-700"
      />
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <label className="space-y-1">
          <span>Scale</span>
          <input
            className="w-full rounded bg-slate-800 p-2"
            type="number"
            min={0.1}
            step={0.1}
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
          />
        </label>
        <label className="space-y-1">
          <span>X (mm)</span>
          <input
            className="w-full rounded bg-slate-800 p-2"
            type="number"
            step={0.5}
            value={xMm}
            onChange={(event) => setXMm(Number(event.target.value))}
          />
        </label>
        <label className="space-y-1">
          <span>Y (mm)</span>
          <input
            className="w-full rounded bg-slate-800 p-2"
            type="number"
            step={0.5}
            value={yMm}
            onChange={(event) => setYMm(Number(event.target.value))}
          />
        </label>
        <label className="space-y-1">
          <span>Rotate (°)</span>
          <input
            className="w-full rounded bg-slate-800 p-2"
            type="number"
            step={1}
            value={rotateDeg}
            onChange={(event) => setRotateDeg(Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
