"use client";

import { useEffect, useState } from "react";
import { lensPresets, machinePresets, settingsPresets } from "@/core/v2/presets";
import { DesignJob } from "@/core/v2/types";

export default function AdminJobDetailClient({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<DesignJob | null>(null);
  const [generated, setGenerated] = useState<Record<string, string> | null>(null);

  async function load() {
    const res = await fetch(`/api/design-jobs/${jobId}`);
    const payload = await res.json();
    setJob(payload.data);
  }

  useEffect(() => { load(); }, [jobId]);

  async function save(patch: Partial<DesignJob>) {
    const res = await fetch(`/api/admin/design-jobs/${jobId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch)
    });
    const payload = await res.json();
    setJob(payload.data);
  }

  function setLocalBedLayout(nextBedLayout: NonNullable<DesignJob["bedLayout"]>) {
    setJob((prev) => (prev ? { ...prev, bedLayout: nextBedLayout } : prev));
  }

  async function generate() {
    const res = await fetch(`/api/admin/design-jobs/${jobId}/generate`, { method: "POST" });
    const payload = await res.json();
    setGenerated(payload.data?.artifacts ?? null);
  }

  if (!job) return <div className="p-6">Loading…</div>;
  const bed = job.bedLayout;

  return <div className="space-y-4 p-6">
    <h1 className="text-xl font-semibold">Admin Job {job.id}</h1>
    <div className="flex gap-2">
      <button className="rounded border px-3 py-1" onClick={() => save({ status: "in_review" })}>Mark In Review</button>
      <button className="rounded border px-3 py-1" onClick={() => save({ status: "production_ready" })}>Mark Production Ready</button>
      <button className="rounded bg-blue-700 px-3 py-1 text-white" onClick={generate}>Generate Packet</button>
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded border p-3 text-sm">
        <h2 className="mb-2 font-medium">Production Config</h2>
        <div className="space-y-2">
          <select className="w-full border" value={job.productionConfig?.machineId ?? ""} onChange={(e) => save({ productionConfig: { ...job.productionConfig, machineId: e.target.value, lensId: job.productionConfig?.lensId ?? lensPresets[0].id, presetId: job.productionConfig?.presetId ?? settingsPresets[0].id, outputProfile: { format: "svg", namingTemplate: "{JOBID}-{TYPE}" }, destinationRule: "/storage/v2-runtime/jobs/{YYYY}/{MM}/{JOBID}/" } })}>
            {machinePresets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="w-full border" value={job.productionConfig?.lensId ?? ""} onChange={(e) => save({ productionConfig: { ...job.productionConfig, machineId: job.productionConfig?.machineId ?? machinePresets[0].id, lensId: e.target.value, presetId: job.productionConfig?.presetId ?? settingsPresets[0].id, outputProfile: { format: "svg", namingTemplate: "{JOBID}-{TYPE}" }, destinationRule: "/storage/v2-runtime/jobs/{YYYY}/{MM}/{JOBID}/" } })}>
            {lensPresets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="w-full border" value={job.productionConfig?.presetId ?? ""} onChange={(e) => save({ productionConfig: { ...job.productionConfig, machineId: job.productionConfig?.machineId ?? machinePresets[0].id, lensId: job.productionConfig?.lensId ?? lensPresets[0].id, presetId: e.target.value, outputProfile: { format: "svg", namingTemplate: "{JOBID}-{TYPE}" }, destinationRule: "/storage/v2-runtime/jobs/{YYYY}/{MM}/{JOBID}/" } })}>
            {settingsPresets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </section>

      <section className="rounded border p-3 text-sm">
        <h2 className="mb-2 font-medium">Bed Mock Editor</h2>
        {bed ? <>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <label>Grid spacing <input className="w-full border" type="number" value={bed.grid.spacing} onChange={(e) => setLocalBedLayout({ ...bed, grid: { ...bed.grid, spacing: Number(e.target.value) } })} onBlur={(e) => save({ bedLayout: { ...bed, grid: { ...bed.grid, spacing: Number(e.target.value) } } })} /></label>
            <label>Grid enabled <input type="checkbox" checked={bed.grid.enabled} onChange={(e) => save({ bedLayout: { ...bed, grid: { ...bed.grid, enabled: e.target.checked } } })} /></label>
          </div>
          <svg viewBox={`0 0 ${bed.bedW_mm} ${bed.bedH_mm}`} className="h-[280px] w-full rounded bg-slate-950">
            <rect width={bed.bedW_mm} height={bed.bedH_mm} fill="#101826" stroke="#3a4d6c" />
            <line x1={0} x2={bed.bedW_mm} y1={bed.rotaryConfig.axisY} y2={bed.rotaryConfig.axisY} stroke="#60a5fa" strokeDasharray="4 4" />
            <circle cx={bed.rotaryConfig.chuckX} cy={bed.rotaryConfig.axisY} r={7} fill="#f59e0b" />
            <circle cx={bed.rotaryConfig.tailstockX} cy={bed.rotaryConfig.axisY} r={7} fill="#f59e0b" />
            <rect x={bed.placedItem.x - 20} y={bed.placedItem.y - 10} width={40} height={20} fill="#22c55e" transform={`rotate(${bed.placedItem.rotation} ${bed.placedItem.x} ${bed.placedItem.y})`} onPointerDown={(e) => {
              const startX = e.clientX;
              const startY = e.clientY;
              const base = { ...bed.placedItem };
              let latest = base;
              const onMove = (ev: PointerEvent) => {
                latest = { ...base, x: base.x + (ev.clientX - startX) * 0.6, y: base.y + (ev.clientY - startY) * 0.6 };
                setLocalBedLayout({ ...bed, placedItem: latest });
              };
              const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                save({ bedLayout: { ...bed, placedItem: latest } });
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }} />
          </svg>
        </> : null}
      </section>
    </div>

    {generated ? <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(generated, null, 2)}</pre> : null}
  </div>;
}