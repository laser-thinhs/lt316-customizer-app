"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { objectPresets } from "@/core/v2/presets";
import { DesignAsset, DesignJob, Placement } from "@/core/v2/types";

type Props = { initialJobId?: string };

const saveDebounceMs = 350;

export default function CustomerEditorClient({ initialJobId }: Props) {
  const [job, setJob] = useState<DesignJob | null>(null);
  const [asset, setAsset] = useState<DesignAsset | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!initialJobId) return;
    fetch(`/api/design-jobs/${initialJobId}`).then((res) => res.json()).then((data) => setJob(data.data));
    fetch(`/api/design-jobs/${initialJobId}/assets`).then((res) => res.json()).then((data) => setAsset(data.data?.[0] ?? null));
  }, [initialJobId]);

  const objectDef = useMemo(() => objectPresets.find((item) => item.id === job?.objectDefinitionId) ?? objectPresets[0], [job?.objectDefinitionId]);
  const width = objectDef.type === "cylinder" ? Math.round(Math.PI * (objectDef.dimensions_mm.diameter ?? 1)) : objectDef.dimensions_mm.width ?? 200;
  const height = objectDef.dimensions_mm.height;

  async function createJob() {
    const res = await fetch("/api/design-jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ v2: true, objectDefinitionId: objectDef.id })
    });
    const payload = await res.json();
    setJob(payload.data);
    window.history.replaceState({}, "", `/customer/${payload.data.id}`);
  }

  function scheduleSave(nextPlacement: Placement, objectDefinitionId = job?.objectDefinitionId) {
    if (!job) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/design-jobs/${job.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placement: nextPlacement, objectDefinitionId })
      });
      const payload = await res.json();
      setJob(payload.data);
    }, saveDebounceMs);
  }

  async function upload(file: File) {
    if (!job) return;
    const form = new FormData();
    form.set("file", file);
    const res = await fetch(`/api/design-jobs/${job.id}/assets`, { method: "POST", body: form });
    const payload = await res.json();
    setAsset(payload.data);
  }

  async function submit() {
    if (!job) return;
    await fetch(`/api/design-jobs/${job.id}/submit`, { method: "POST" });
    const refreshed = await fetch(`/api/design-jobs/${job.id}`).then((res) => res.json());
    setJob(refreshed.data);
  }

  const placement = job?.placement;

  return (
    <div className="space-y-4 p-6">
      {!job ? <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={createJob}>Start New Job</button> : null}
      {job ? (
        <>
          <div className="flex flex-wrap gap-3">
            <label>Object
              <select className="ml-2 border" value={job.objectDefinitionId} onChange={(e) => {
                const next = { ...job.placement, seamX_mm: 0 };
                setJob({ ...job, objectDefinitionId: e.target.value, placement: next });
                scheduleSave(next, e.target.value);
              }}>
                {objectPresets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <input type="file" accept=".svg,image/svg+xml" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button className="rounded bg-emerald-600 px-3 py-2 text-white" onClick={submit}>Submit Job</button>
          </div>
          {placement ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded border p-3">
                <div className="mb-2 text-sm">2D Unwrapped Editor (mm)</div>
                <svg viewBox={`0 0 ${width} ${height}`} className="h-[380px] w-full bg-slate-50">
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M10 0H0V10" fill="none" stroke="#dde3ea" strokeWidth="0.6" />
                  </pattern>
                  <rect width={width} height={height} fill="url(#grid)" />
                  <rect x={objectDef.safeArea_mm.x} y={objectDef.safeArea_mm.y} width={objectDef.safeArea_mm.width} height={objectDef.safeArea_mm.height} fill="none" stroke="#22c55e" strokeDasharray="3 2" />
                  {asset ? (
                    <image
                      href={asset.originalSvgPublicUrl}
                      x={placement.x_mm}
                      y={placement.y_mm}
                      width={asset.bbox.width * placement.scale}
                      height={asset.bbox.height * placement.scale}
                      transform={`rotate(${placement.rotation_deg} ${placement.x_mm} ${placement.y_mm})`}
                      style={{ cursor: "move" }}
                      onPointerDown={(e) => {
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const base = { ...placement };
                        const onMove = (ev: PointerEvent) => {
                          const next = { ...base, x_mm: base.x_mm + (ev.clientX - startX) * 0.5, y_mm: base.y_mm + (ev.clientY - startY) * 0.5 };
                          setJob((prev) => prev ? { ...prev, placement: next } : prev);
                          scheduleSave(next);
                        };
                        const onUp = () => {
                          window.removeEventListener("pointermove", onMove);
                          window.removeEventListener("pointerup", onUp);
                        };
                        window.addEventListener("pointermove", onMove);
                        window.addEventListener("pointerup", onUp);
                      }}
                    />
                  ) : null}
                </svg>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <label>Scale <input type="range" min={0.1} max={3} step={0.05} value={placement.scale} onChange={(e) => {
                    const next = { ...placement, scale: Number(e.target.value) };
                    setJob({ ...job, placement: next });
                    scheduleSave(next);
                  }} /></label>
                  <label>Rotate° <input type="range" min={-180} max={180} step={1} value={placement.rotation_deg} onChange={(e) => {
                    const next = { ...placement, rotation_deg: Number(e.target.value) };
                    setJob({ ...job, placement: next });
                    scheduleSave(next);
                  }} /></label>
                  <label>Wrap <input type="checkbox" checked={placement.wrapEnabled} onChange={(e) => {
                    const next = { ...placement, wrapEnabled: e.target.checked };
                    setJob({ ...job, placement: next });
                    scheduleSave(next);
                  }} /></label>
                  <label>Seam X <input type="range" min={0} max={width} step={1} value={placement.seamX_mm} onChange={(e) => {
                    const next = { ...placement, seamX_mm: Number(e.target.value) };
                    setJob({ ...job, placement: next });
                    scheduleSave(next);
                  }} /></label>
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="mb-2 text-sm">3D Preview (state-synced placeholder)</div>
                <div className="flex h-[380px] items-center justify-center rounded bg-slate-900 text-slate-200">
                  <div className="text-center text-sm">
                    <div>{objectDef.name}</div>
                    <div>Pos {placement.x_mm.toFixed(1)} / {placement.y_mm.toFixed(1)} mm</div>
                    <div>Scale {placement.scale.toFixed(2)} · Rot {placement.rotation_deg}°</div>
                    <div>Wrap {placement.wrapEnabled ? "ON" : "OFF"} · Seam {placement.seamX_mm.toFixed(1)} mm</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}