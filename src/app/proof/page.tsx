"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { proofTemplatePresets, type ProofPlacement, type ProofTemplateId } from "@/schemas/proof";

const DEFAULT_TEMPLATE: ProofTemplateId = "40oz_tumbler_wrap";

const DEFAULT_PLACEMENT: ProofPlacement = {
  scalePercent: 100,
  rotateDeg: 0,
  xMm: proofTemplatePresets[DEFAULT_TEMPLATE].widthMm / 2,
  yMm: proofTemplatePresets[DEFAULT_TEMPLATE].heightMm / 2,
  mirrorH: false,
  mirrorV: false,
  repeatMode: "none",
  stepMm: 20
};

export default function ProofPage() {
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [svgAssetId, setSvgAssetId] = useState<string>(searchParams.get("svgAssetId") ?? "");
  const [jobId, setJobId] = useState<string>(searchParams.get("jobId") ?? "");
  const [templateId, setTemplateId] = useState<ProofTemplateId>(DEFAULT_TEMPLATE);
  const [templateWidthMm, setTemplateWidthMm] = useState<number>(proofTemplatePresets[DEFAULT_TEMPLATE].widthMm);
  const [templateHeightMm, setTemplateHeightMm] = useState<number>(proofTemplatePresets[DEFAULT_TEMPLATE].heightMm);
  const [placement, setPlacement] = useState<ProofPlacement>(DEFAULT_PLACEMENT);
  const [status, setStatus] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofAssetId, setProofAssetId] = useState<string | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(`proof:last:${templateId}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { placement: ProofPlacement; widthMm: number; heightMm: number };
      setPlacement(parsed.placement);
      setTemplateWidthMm(parsed.widthMm);
      setTemplateHeightMm(parsed.heightMm);
    } catch {
      localStorage.removeItem(`proof:last:${templateId}`);
    }
  }, [templateId]);

  useEffect(() => {
    localStorage.setItem(`proof:last:${templateId}`, JSON.stringify({ placement, widthMm: templateWidthMm, heightMm: templateHeightMm }));
  }, [placement, templateId, templateWidthMm, templateHeightMm]);

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

    ctx.clearRect(0, 0, previewWidth, previewHeight);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, previewWidth, previewHeight);
    ctx.strokeStyle = "#94a3b8";
    ctx.strokeRect(1, 1, previewWidth - 2, previewHeight - 2);

    const safeMarginPx = (proofTemplatePresets[templateId].safeMarginMm / templateWidthMm) * previewWidth;
    ctx.strokeStyle = "#9ca3af";
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(safeMarginPx, safeMarginPx, previewWidth - safeMarginPx * 2, previewHeight - safeMarginPx * 2);
    ctx.setLineDash([]);

    const xPx = (placement.xMm / templateWidthMm) * previewWidth;
    const yPx = (placement.yMm / templateHeightMm) * previewHeight;
    const scale = placement.scalePercent / 100;

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
        ctx.rotate((placement.rotateDeg * Math.PI) / 180);
        ctx.scale(scale * (placement.mirrorH ? -1 : 1), scale * (placement.mirrorV ? -1 : 1));
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      };

      if (placement.repeatMode === "step-and-repeat") {
        const stepPx = (placement.stepMm / templateWidthMm) * previewWidth;
        for (let i = -3; i <= 3; i += 1) drawOne(i * stepPx);
      } else {
        drawOne(0);
      }

      URL.revokeObjectURL(blobUrl);
    };

    void drawSvg();
  }, [placement, svgAssetId, templateHeightMm, templateId, templateWidthMm]);

  const bounding = useMemo(() => ({
    xPx: ((placement.xMm / templateWidthMm) * 900).toFixed(1),
    yPx: ((placement.yMm / templateHeightMm) * ((templateHeightMm / templateWidthMm) * 900)).toFixed(1)
  }), [placement.xMm, placement.yMm, templateHeightMm, templateWidthMm]);

  const persistPlacement = async (nextPlacement = placement) => {
    if (!jobId) return;
    await fetch(`/api/proof/jobs/${jobId}/placement`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placement: nextPlacement, templateId })
    });
  };

  const centerX = () => {
    const next = { ...placement, xMm: templateWidthMm / 2 };
    setPlacement(next);
    void persistPlacement(next);
  };

  const centerY = () => {
    const next = { ...placement, yMm: templateHeightMm / 2 };
    setPlacement(next);
    void persistPlacement(next);
  };

  const generateProof = async () => {
    if (!svgAssetId) return;
    setStatus("Rendering proof...");
    const res = await fetch("/api/proof/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svgAssetId, templateId, placement })
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
          <select className="w-full rounded border p-2" value={templateId} onChange={(e) => setTemplateId(e.target.value as ProofTemplateId)}>
            {Object.values(proofTemplatePresets).map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>

          <label className="block text-sm">SVG Asset ID<input className="mt-1 w-full rounded border p-2" value={svgAssetId} onChange={(e) => setSvgAssetId(e.target.value)} /></label>
          <label className="block text-sm">Scale %<input className="mt-1 w-full rounded border p-2" type="number" value={placement.scalePercent} onChange={(e) => setPlacement((prev) => ({ ...prev, scalePercent: Number(e.target.value) }))} /></label>
          <label className="block text-sm">Rotate °<input className="mt-1 w-full rounded border p-2" type="number" value={placement.rotateDeg} onChange={(e) => setPlacement((prev) => ({ ...prev, rotateDeg: Number(e.target.value) }))} /></label>
          <label className="block text-sm">X (mm)<input className="mt-1 w-full rounded border p-2" type="number" value={placement.xMm} onChange={(e) => setPlacement((prev) => ({ ...prev, xMm: Number(e.target.value) }))} /></label>
          <div className="text-xs text-slate-500">X (px preview): {bounding.xPx}</div>
          <label className="block text-sm">Y (mm)<input className="mt-1 w-full rounded border p-2" type="number" value={placement.yMm} onChange={(e) => setPlacement((prev) => ({ ...prev, yMm: Number(e.target.value) }))} /></label>
          <div className="text-xs text-slate-500">Y (px preview): {bounding.yPx}</div>

          <div className="flex gap-2 text-sm">
            <label><input type="checkbox" checked={placement.mirrorH} onChange={(e) => setPlacement((prev) => ({ ...prev, mirrorH: e.target.checked }))} /> Mirror H</label>
            <label><input type="checkbox" checked={placement.mirrorV} onChange={(e) => setPlacement((prev) => ({ ...prev, mirrorV: e.target.checked }))} /> Mirror V</label>
          </div>

          <label className="block text-sm">Repeat mode
            <select className="mt-1 w-full rounded border p-2" value={placement.repeatMode} onChange={(e) => setPlacement((prev) => ({ ...prev, repeatMode: e.target.value as ProofPlacement["repeatMode"] }))}>
              <option value="none">none</option>
              <option value="step-and-repeat">step-and-repeat</option>
            </select>
          </label>
          {placement.repeatMode === "step-and-repeat" ? (
            <label className="block text-sm">Step (mm)<input className="mt-1 w-full rounded border p-2" type="number" value={placement.stepMm} onChange={(e) => setPlacement((prev) => ({ ...prev, stepMm: Number(e.target.value) }))} /></label>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">Wrap width (mm)<input className="mt-1 w-full rounded border p-2" type="number" value={templateWidthMm} onChange={(e) => setTemplateWidthMm(Number(e.target.value))} /></label>
            <label className="text-sm">Wrap height (mm)<input className="mt-1 w-full rounded border p-2" type="number" value={templateHeightMm} onChange={(e) => setTemplateHeightMm(Number(e.target.value))} /></label>
          </div>

          <div className="flex gap-2">
            <button className="rounded border px-3 py-1" onClick={centerX}>Center X</button>
            <button className="rounded border px-3 py-1" onClick={centerY}>Center Y</button>
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
