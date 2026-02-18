"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getTemplateById, templates } from "@/lib/templates";
import { mmToPx, pxToMm } from "@/lib/units";
import { proofTemplatePresets, type ProofPlacement } from "@/schemas/proof";

const DEFAULT_TEMPLATE = "40oz_tumbler_wrap";

function defaultPlacement(templateId: string): ProofPlacement {
  const template = getTemplateById(templateId);
  return {
    scalePercent: 100,
    rotateDeg: 0,
    xMm: template.wrapWidthMm / 2,
    yMm: template.wrapHeightMm / 2,
    mirrorH: false,
    mirrorV: false,
    repeatMode: "none",
    stepMm: 20
  };
}

function ProofPageClient() {
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [svgAssetId, setSvgAssetId] = useState<string>(searchParams.get("svgAssetId") ?? "");
  const [jobId] = useState<string>(searchParams.get("jobId") ?? "");
  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE);
  const [dpi, setDpi] = useState<number>(proofTemplatePresets[DEFAULT_TEMPLATE].defaultDpi);
  const [lockDpi, setLockDpi] = useState<boolean>(true);
  const [placementMm, setPlacementMm] = useState<ProofPlacement>(defaultPlacement(DEFAULT_TEMPLATE));
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSpacingMm, setGridSpacingMm] = useState(10);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToCenterlines, setSnapToCenterlines] = useState(true);
  const [snapToSafeBounds, setSnapToSafeBounds] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofAssetId, setProofAssetId] = useState<string | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  const template = getTemplateById(templateId);
  const templateWidthMm = template.wrapWidthMm;
  const templateHeightMm = template.wrapHeightMm;

  const applySnap = (xMm: number, yMm: number) => {
    let x = xMm;
    let y = yMm;
    const thresholdMm = 1.2;
    if (snapToCenterlines) {
      const cx = templateWidthMm / 2;
      const cy = templateHeightMm / 2;
      if (Math.abs(x - cx) <= thresholdMm) x = cx;
      if (Math.abs(y - cy) <= thresholdMm) y = cy;
    }

    const safe = template.safeMarginMm ?? 0;
    if (snapToSafeBounds && safe > 0) {
      if (Math.abs(x - safe) <= thresholdMm) x = safe;
      if (Math.abs(x - (templateWidthMm - safe)) <= thresholdMm) x = templateWidthMm - safe;
      if (Math.abs(y - safe) <= thresholdMm) y = safe;
      if (Math.abs(y - (templateHeightMm - safe)) <= thresholdMm) y = templateHeightMm - safe;
    }

    if (snapToGrid && gridSpacingMm > 0) {
      x = Math.round(x / gridSpacingMm) * gridSpacingMm;
      y = Math.round(y / gridSpacingMm) * gridSpacingMm;
    }

    return { x, y };
  };

  useEffect(() => {
    const raw = localStorage.getItem(`proof:last:${templateId}`);
    if (!raw) {
      setPlacementMm(defaultPlacement(templateId));
      if (!lockDpi) return;
      setDpi(template.defaultDpi);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { placementMm: ProofPlacement; dpi?: number; grid?: { enabled: boolean; spacingMm: number } };
      setPlacementMm(parsed.placementMm);
      if (parsed.dpi && lockDpi) setDpi(parsed.dpi);
      if (parsed.grid) {
        setGridEnabled(parsed.grid.enabled);
        setGridSpacingMm(parsed.grid.spacingMm);
      }
    } catch {
      localStorage.removeItem(`proof:last:${templateId}`);
    }
  }, [template.defaultDpi, templateId, lockDpi]);

  useEffect(() => {
    localStorage.setItem(`proof:last:${templateId}`, JSON.stringify({ placementMm, dpi, grid: { enabled: gridEnabled, spacingMm: gridSpacingMm } }));
  }, [placementMm, templateId, dpi, gridEnabled, gridSpacingMm]);

  useEffect(() => {
    if (!svgAssetId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const previewWidth = 900;
    const previewHeight = Math.round((templateHeightMm / templateWidthMm) * previewWidth);
    canvas.width = previewWidth;
    canvas.height = previewHeight;

    const pxPerMmX = previewWidth / templateWidthMm;
    const pxPerMmY = previewHeight / templateHeightMm;

    ctx.clearRect(0, 0, previewWidth, previewHeight);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, previewWidth, previewHeight);
    ctx.strokeStyle = "#94a3b8";
    ctx.strokeRect(1, 1, previewWidth - 2, previewHeight - 2);

    if (gridEnabled) {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      for (let x = 0; x <= templateWidthMm; x += gridSpacingMm) {
        const xPx = x * pxPerMmX;
        ctx.beginPath();
        ctx.moveTo(xPx, 0);
        ctx.lineTo(xPx, previewHeight);
        ctx.stroke();
      }
      for (let y = 0; y <= templateHeightMm; y += gridSpacingMm) {
        const yPx = y * pxPerMmY;
        ctx.beginPath();
        ctx.moveTo(0, yPx);
        ctx.lineTo(previewWidth, yPx);
        ctx.stroke();
      }
    }

    const safeMarginPxX = (template.safeMarginMm ?? 0) * pxPerMmX;
    const safeMarginPxY = (template.safeMarginMm ?? 0) * pxPerMmY;
    ctx.strokeStyle = "#9ca3af";
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(safeMarginPxX, safeMarginPxY, previewWidth - safeMarginPxX * 2, previewHeight - safeMarginPxY * 2);

    const bleedPxX = (template.bleedMm ?? 0) * pxPerMmX;
    const bleedPxY = (template.bleedMm ?? 0) * pxPerMmY;
    ctx.strokeStyle = "#f43f5e";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(bleedPxX, bleedPxY, previewWidth - bleedPxX * 2, previewHeight - bleedPxY * 2);

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(previewWidth / 2, 0);
    ctx.lineTo(previewWidth / 2, previewHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, previewHeight / 2);
    ctx.lineTo(previewWidth, previewHeight / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const xPx = placementMm.xMm * pxPerMmX;
    const yPx = placementMm.yMm * pxPerMmY;
    const scale = placementMm.scalePercent / 100;

    const drawSvg = async () => {
      const svgRes = await fetch(`/api/tracer/assets/${svgAssetId}`);
      if (!svgRes.ok) return;
      const svgText = await svgRes.text();
      const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
      const img = new Image();
      img.src = blobUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const drawOne = (offsetPx: number) => {
        ctx.save();
        ctx.translate(xPx + offsetPx, yPx);
        ctx.rotate((placementMm.rotateDeg * Math.PI) / 180);
        ctx.scale(scale * (placementMm.mirrorH ? -1 : 1), scale * (placementMm.mirrorV ? -1 : 1));
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      };

      if (placementMm.repeatMode === "step-and-repeat") {
        const stepPx = placementMm.stepMm * pxPerMmX;
        for (let i = -3; i <= 3; i += 1) drawOne(i * stepPx);
      } else {
        drawOne(0);
      }

      URL.revokeObjectURL(blobUrl);
    };

    void drawSvg();
  }, [placementMm, svgAssetId, template, templateHeightMm, templateWidthMm, gridEnabled, gridSpacingMm]);

  const bounding = useMemo(() => ({
    xPx: mmToPx(placementMm.xMm, dpi).toFixed(1),
    yPx: mmToPx(placementMm.yMm, dpi).toFixed(1),
    xMmFromPx: pxToMm(mmToPx(placementMm.xMm, dpi), dpi).toFixed(2)
  }), [placementMm.xMm, placementMm.yMm, dpi]);

  const persistPlacement = async (nextPlacement = placementMm) => {
    if (!jobId) return;
    await fetch(`/api/proof/jobs/${jobId}/placement`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placementMm: nextPlacement,
        templateId,
        dpi,
        uiSettings: { gridEnabled, gridSpacingMm, snapToGrid, snapToCenterlines, snapToSafeBounds }
      })
    });
  };

  const setSnappedPlacement = (next: ProofPlacement) => {
    const snapped = applySnap(next.xMm, next.yMm);
    setPlacementMm({ ...next, xMm: snapped.x, yMm: snapped.y });
  };

  const generateProof = async () => {
    if (!svgAssetId) return;
    setStatus("Rendering proof...");
    const res = await fetch("/api/proof/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svgAssetId, templateId, dpi, placementMm })
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(json?.error?.message ?? "Proof render failed");
      return;
    }
    setProofAssetId(json.data.proofAssetId);
    setProofUrl(json.data.proofUrl);
    setStatus("Proof rendered.");
  };

  const exportPackage = async () => {
    if (!jobId) {
      setStatus("Missing jobId. Use Send to Proof from tracer.");
      return;
    }
    setStatus("Exporting package...");
    await persistPlacement();
    const res = await fetch("/api/proof/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId })
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(json?.error?.message ?? "Export failed");
      return;
    }
    setZipUrl(json.data.exportUrl);
    setProofAssetId(json.data.proofAssetId);
    setProofUrl(json.data.proofUrl);
    setStatus("Production package ready.");
  };

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Proof Placement</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <section className="space-y-3 rounded border p-4">
          <div className="text-sm text-slate-600">Template preset</div>
          <select
            className="w-full rounded border p-2"
            value={templateId}
            onChange={(e) => {
              const nextId = e.target.value;
              setTemplateId(nextId);
              if (lockDpi) setDpi(getTemplateById(nextId).defaultDpi);
            }}
          >
            {templates.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>

          <label className="block text-sm">DPI
            <input className="mt-1 w-full rounded border p-2" type="number" value={dpi} onChange={(e) => setDpi(Number(e.target.value))} />
          </label>
          <label className="text-sm"><input type="checkbox" checked={lockDpi} onChange={(e) => setLockDpi(e.target.checked)} /> Lock to template default</label>

          <label className="block text-sm">SVG Asset ID<input className="mt-1 w-full rounded border p-2" value={svgAssetId} onChange={(e) => setSvgAssetId(e.target.value)} /></label>
          <label className="block text-sm">Scale %<input className="mt-1 w-full rounded border p-2" type="number" value={placementMm.scalePercent} onChange={(e) => setPlacementMm((prev) => ({ ...prev, scalePercent: Number(e.target.value) }))} /></label>
          <label className="block text-sm">Rotate °<input className="mt-1 w-full rounded border p-2" type="number" value={placementMm.rotateDeg} onChange={(e) => setPlacementMm((prev) => ({ ...prev, rotateDeg: Number(e.target.value) }))} /></label>
          <label className="block text-sm">X (mm)<input className="mt-1 w-full rounded border p-2" type="number" value={placementMm.xMm} onChange={(e) => setSnappedPlacement({ ...placementMm, xMm: Number(e.target.value) })} /></label>
          <div className="text-xs text-slate-500">X (px @dpi): {bounding.xPx}</div>
          <label className="block text-sm">Y (mm)<input className="mt-1 w-full rounded border p-2" type="number" value={placementMm.yMm} onChange={(e) => setSnappedPlacement({ ...placementMm, yMm: Number(e.target.value) })} /></label>
          <div className="text-xs text-slate-500">Y (px @dpi): {bounding.yPx}</div>
          <div className="text-xs text-slate-500">Round-trip mm check: {bounding.xMmFromPx}</div>

          <div className="flex gap-2 text-sm">
            <label><input type="checkbox" checked={placementMm.mirrorH} onChange={(e) => setPlacementMm((prev) => ({ ...prev, mirrorH: e.target.checked }))} /> Mirror H</label>
            <label><input type="checkbox" checked={placementMm.mirrorV} onChange={(e) => setPlacementMm((prev) => ({ ...prev, mirrorV: e.target.checked }))} /> Mirror V</label>
          </div>

          <div className="rounded border p-2 text-sm">
            <div className="font-medium">Guides + snapping</div>
            <label className="block"><input type="checkbox" checked={gridEnabled} onChange={(e) => setGridEnabled(e.target.checked)} /> Grid overlay</label>
            <label className="block">Grid spacing (mm)
              <input className="mt-1 w-full rounded border p-1" type="number" value={gridSpacingMm} onChange={(e) => setGridSpacingMm(Number(e.target.value))} />
            </label>
            <label className="block"><input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} /> Snap to grid</label>
            <label className="block"><input type="checkbox" checked={snapToCenterlines} onChange={(e) => setSnapToCenterlines(e.target.checked)} /> Snap to centerlines</label>
            <label className="block"><input type="checkbox" checked={snapToSafeBounds} onChange={(e) => setSnapToSafeBounds(e.target.checked)} /> Snap to safe bounds</label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="rounded border px-3 py-1" onClick={generateProof}>Generate Proof PNG</button>
            <button className="rounded border px-3 py-1" onClick={exportPackage}>Download Production Package (ZIP)</button>
            <Link className="rounded border px-3 py-1" href="/tracer">Back to Tracer</Link>
          </div>

          {proofUrl ? <a className="block text-sm text-blue-600 underline" href={proofUrl}>Download Proof PNG</a> : null}
          {zipUrl ? <a className="block text-sm text-blue-600 underline" href={zipUrl}>Download Production Package (ZIP)</a> : null}
          {status ? <p className="text-sm text-slate-700">{status}</p> : null}
        </section>

        <section className="rounded border p-4">
          <canvas ref={canvasRef} className="h-auto w-full rounded border" />
          {proofAssetId ? <p className="mt-2 text-xs text-slate-500">Latest proof asset: {proofAssetId}</p> : null}
        </section>
      </div>
    </main>
  );
}

export default function ProofPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl p-6 text-sm text-slate-600">Loading proof editor…</main>}>
      <ProofPageClient />
    </Suspense>
  );
}
