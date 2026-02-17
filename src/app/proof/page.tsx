"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { defaultPlacement, getProofTemplate, mmToPx, ProofPlacement } from "@/lib/proof-template";

type JobPayload = {
  id: string;
  sourceSvgUrl: string | null;
  proofUrl: string | null;
  exportZipUrl: string | null;
  placement: ProofPlacement | null;
  templateId: string;
};

export default function ProofPage() {
  const [job, setJob] = useState<JobPayload | null>(null);
  const [placement, setPlacement] = useState<ProofPlacement>(defaultPlacement("40oz_tumbler_wrap"));
  const [renderUrl, setRenderUrl] = useState<string | null>(null);

  const template = getProofTemplate(job?.templateId);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("jobId");
    if (!jobId) return;

    fetch(`/api/proof/jobs/${jobId}`).then(async (res) => {
      const payload = await res.json();
      if (payload.ok) {
        setJob(payload.data);
        const base = payload.data.placement ?? defaultPlacement(payload.data.templateId);
        const persisted = localStorage.getItem(`proof:last:${payload.data.templateId}`);
        setPlacement(persisted ? { ...base, ...JSON.parse(persisted) } : base);
      }
    });
  }, []);

  useEffect(() => {
    if (!job) return;
    localStorage.setItem(`proof:last:${job.templateId}`, JSON.stringify(placement));
  }, [job, placement]);

  async function generateProof(highRes = false) {
    if (!job) return;
    const res = await fetch("/api/proof/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: job.id, placement, templateId: job.templateId, highRes })
    });
    const payload = await res.json();
    if (payload.ok) {
      setRenderUrl(payload.data.proofUrl);
    }
  }

  async function exportPackage() {
    if (!job) return;
    const res = await fetch("/api/proof/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: job.id })
    });
    const payload = await res.json();
    if (payload.ok) window.location.href = payload.data.zipUrl;
  }

  const bbox = useMemo(() => ({ width: Math.round(400 * (placement.scalePct / 100)), height: Math.round(400 * (placement.scalePct / 100)) }), [placement.scalePct]);

  return (
    <main className="mx-auto flex max-w-7xl gap-4 p-6">
      <section className="w-80 space-y-3 rounded border p-4">
        <h1 className="text-xl font-semibold">Proof Placement</h1>
        <label className="block">Scale % <input type="number" className="ml-2 w-24 border" value={placement.scalePct} onChange={(e) => setPlacement((p) => ({ ...p, scalePct: Number(e.target.value) }))} /></label>
        <label className="block">Rotate ° <input type="number" className="ml-2 w-24 border" value={placement.rotateDeg} onChange={(e) => setPlacement((p) => ({ ...p, rotateDeg: Number(e.target.value) }))} /></label>
        <label className="block">X px/mm <input type="number" className="ml-2 w-24 border" value={placement.xPx} onChange={(e) => setPlacement((p) => ({ ...p, xPx: Number(e.target.value) }))} /> <span className="text-xs text-slate-600">{(placement.xPx * (template.wrapWidthMm / template.previewWidthPx)).toFixed(2)}mm</span></label>
        <label className="block">Y px/mm <input type="number" className="ml-2 w-24 border" value={placement.yPx} onChange={(e) => setPlacement((p) => ({ ...p, yPx: Number(e.target.value) }))} /> <span className="text-xs text-slate-600">{(placement.yPx * (template.wrapHeightMm / template.previewHeightPx)).toFixed(2)}mm</span></label>
        <label className="block">Repeat mode
          <select className="ml-2 border" value={placement.repeatMode} onChange={(e) => setPlacement((p) => ({ ...p, repeatMode: e.target.value as ProofPlacement["repeatMode"] }))}>
            <option value="none">none</option>
            <option value="step-and-repeat">step-and-repeat</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button className="rounded border px-2 py-1" onClick={() => setPlacement((p) => ({ ...p, xPx: template.previewWidthPx / 2 }))}>Center X</button>
          <button className="rounded border px-2 py-1" onClick={() => setPlacement((p) => ({ ...p, yPx: template.previewHeightPx / 2 }))}>Center Y</button>
        </div>
        <div className="flex gap-2">
          <button className="rounded border px-2 py-1" onClick={() => setPlacement((p) => ({ ...p, mirrorH: !p.mirrorH }))}>Mirror H</button>
          <button className="rounded border px-2 py-1" onClick={() => setPlacement((p) => ({ ...p, mirrorV: !p.mirrorV }))}>Mirror V</button>
        </div>
        <div className="text-xs">Bounding box: {bbox.width} x {bbox.height}px</div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded border px-2 py-1" onClick={() => generateProof(false)}>Render Proof</button>
          <button className="rounded border px-2 py-1" onClick={() => generateProof(true)}>Render High-Res</button>
          <button className="rounded border px-2 py-1" onClick={exportPackage}>Download Production Package (ZIP)</button>
          <Link href="/tracer" className="rounded border px-2 py-1">Back to Tracer</Link>
          {renderUrl ? <a className="rounded border px-2 py-1" href={renderUrl}>Download Proof PNG</a> : null}
        </div>
      </section>
      <section className="flex-1 rounded border p-4">
        <div className="mx-auto w-full max-w-5xl rounded border bg-slate-100 p-4">
          <svg viewBox={`0 0 ${template.previewWidthPx} ${template.previewHeightPx}`} className="h-auto w-full">
            <rect width="100%" height="100%" fill="#eef2ff" />
            <rect x="40" y="40" width={template.previewWidthPx - 80} height={template.previewHeightPx - 80} rx="120" fill="#fff" stroke="#94a3b8" />
            <rect x={40 + mmToPx(placement.safeMarginMm, template, template.previewWidthPx)} y={40 + mmToPx(placement.safeMarginMm, template, template.previewWidthPx)} width={template.previewWidthPx - 80 - mmToPx(placement.safeMarginMm, template, template.previewWidthPx) * 2} height={template.previewHeightPx - 80 - mmToPx(placement.safeMarginMm, template, template.previewWidthPx) * 2} fill="none" stroke="#64748b" strokeDasharray="8 6" />
            {job?.sourceSvgUrl ? (
              <g transform={`translate(${placement.xPx} ${placement.yPx}) rotate(${placement.rotateDeg}) scale(${placement.mirrorH ? -1 : 1} ${placement.mirrorV ? -1 : 1})`}>
                <image href={job.sourceSvgUrl} x={-bbox.width / 2} y={-bbox.height / 2} width={bbox.width} height={bbox.height} />
              </g>
            ) : null}
          </svg>
        </div>
      </section>
    </main>
  );
}
