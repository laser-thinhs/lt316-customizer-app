"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultDestinationRule, lensPresets, machinePresets, objectPresets, settingsPresets } from "@/core/v2/presets";
import { BedLayout, DesignJob, JobStatus } from "@/core/v2/types";

type MutationKey = "status" | "production" | "bed" | "none";

type ArtifactsState = {
  generatedAt: string;
  artifacts: Record<string, string>;
};

type LocalBedUi = {
  snapToGrid: boolean;
  showIntersections: boolean;
};

const statusLabel: Record<JobStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In Review",
  production_ready: "Production Ready",
  completed: "Completed"
};

const statusClass: Record<JobStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  production_ready: "bg-emerald-100 text-emerald-700",
  completed: "bg-indigo-100 text-indigo-700"
};

function toMm(deltaPx: number, viewboxSize: number, cssSize: number) {
  if (!cssSize) return 0;
  return (deltaPx / cssSize) * viewboxSize;
}

function roundMm(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function spinner(label: string) {
  return <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />{label}</span>;
}

export default function AdminJobDetailClient({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<DesignJob | null>(null);
  const [generated, setGenerated] = useState<ArtifactsState | null>(null);
  const [error, setError] = useState<string>("");
  const [copyState, setCopyState] = useState<string>("");
  const [mutation, setMutation] = useState<MutationKey>("none");
  const [generating, setGenerating] = useState(false);
  const [bedUi, setBedUi] = useState<LocalBedUi>({ snapToGrid: true, showIntersections: false });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/design-jobs/${jobId}`);
    const payload = await res.json();
    setJob(payload.data);
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<DesignJob>, key: MutationKey) {
    setError("");
    setMutation(key);
    try {
      const res = await fetch(`/api/admin/design-jobs/${jobId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message ?? "Failed to save changes");
      setJob(payload.data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save changes");
    } finally {
      setMutation("none");
    }
  }

  function setLocalBedLayout(nextBedLayout: NonNullable<DesignJob["bedLayout"]>) {
    setJob((prev) => (prev ? { ...prev, bedLayout: nextBedLayout } : prev));
  }

  async function generate() {
    if (generating) return;
    setError("");
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/design-jobs/${jobId}/generate`, { method: "POST" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message ?? "Failed to generate packet");
      setGenerated({ generatedAt: new Date().toISOString(), artifacts: payload.data?.artifacts ?? {} });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate packet");
    } finally {
      setGenerating(false);
    }
  }

  async function copyPath(key: string, value: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement("textarea");
        input.value = value;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopyState(key);
      window.setTimeout(() => setCopyState(""), 1600);
    } catch {
      setError("Could not copy path to clipboard.");
    }
  }

  const objectPreset = useMemo(() => objectPresets.find((item) => item.id === job?.objectDefinitionId), [job?.objectDefinitionId]);

  if (!job) return <div className="p-6">Loading…</div>;
  const bed = job.bedLayout;
  const productionConfig = {
    machineId: job.productionConfig?.machineId ?? machinePresets[0].id,
    lensId: job.productionConfig?.lensId ?? lensPresets[0].id,
    presetId: job.productionConfig?.presetId ?? settingsPresets[0].id,
    outputProfile: { format: "svg" as const, namingTemplate: "{JOBID}-{TYPE}" },
    destinationRule: defaultDestinationRule
  };

  const withGridSnap = (value: number, layout: BedLayout, axis: "x" | "y") => {
    if (!bedUi.snapToGrid || !layout.grid.enabled || layout.grid.spacing <= 0) return roundMm(value);
    const spacing = layout.grid.spacing;
    const offset = axis === "x" ? layout.grid.offsetX : layout.grid.offsetY;
    const snapped = Math.round((value - offset) / spacing) * spacing + offset;
    return roundMm(snapped);
  };

  return <div className="space-y-4 p-6">
    <div className="sticky top-0 z-20 -mx-6 border-b bg-white/95 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => save({ status: "in_review" }, "status")}
          disabled={mutation !== "none" || generating || job.status === "in_review"}
        >
          {mutation === "status" ? spinner("Saving…") : "Mark In Review"}
        </button>
        <button
          className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => save({ status: "production_ready" }, "status")}
          disabled={mutation !== "none" || generating || job.status === "production_ready"}
        >
          {mutation === "status" ? spinner("Saving…") : "Mark Production Ready"}
        </button>
        <button
          className="rounded bg-blue-700 px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={generate}
          disabled={mutation !== "none" || generating}
        >
          {generating ? spinner("Generating…") : "Generate Packet"}
        </button>
      </div>
    </div>

    <section className="rounded border p-3">
      <div className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
        <div><span className="text-slate-500">Job ID</span><p className="font-medium">{job.id}</p></div>
        <div>
          <span className="text-slate-500">Status</span>
          <p><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[job.status]}`}>{statusLabel[job.status]}</span></p>
        </div>
        <div>
          <span className="text-slate-500">Object</span>
          <p className="font-medium">{objectPreset?.name ?? job.objectDefinitionId}</p>
          <p className="text-xs text-slate-500">
            {objectPreset?.type === "cylinder"
              ? `Ø ${objectPreset.dimensions_mm.diameter}mm × H ${objectPreset.dimensions_mm.height}mm`
              : `${objectPreset?.dimensions_mm.width}mm × ${objectPreset?.dimensions_mm.height}mm`}
          </p>
        </div>
        <div><span className="text-slate-500">Updated</span><p className="font-medium">{new Date(job.updatedAt).toLocaleString()}</p></div>
      </div>
      {(job.productTemplateId || job.templateGblPath || job.templatePreviewSvgPath) ? (
        <div className="mt-3 grid gap-2 border-t pt-3 text-sm md:grid-cols-2">
          <div className="space-y-1">
            <div>Template: {job.productTemplateId ?? "(legacy / none)"}</div>
            <div>Color: {job.colorId ?? "(none)"}</div>
            <div>Design: {job.templateDesignId ?? "default"}</div>
            <div className="break-all">Production GBL: {job.templateGblPath ?? "(not set)"}</div>
            {job.templateMeshPath ? <div className="break-all">Mesh: {job.templateMeshPath}</div> : null}
          </div>
          {job.templatePreviewSvgPath ? (
            <div className="flex items-center justify-start md:justify-end">
              <img src={job.templatePreviewSvgPath} alt="Template preview" className="h-24 rounded border bg-white p-1" />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>

    {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded border p-3 text-sm">
        <h2 className="mb-2 font-medium">Bed Mock Editor</h2>
        {bed ? <>
          <div className="relative w-full overflow-hidden rounded bg-slate-950" style={{ aspectRatio: `${bed.bedW_mm} / ${bed.bedH_mm}` }}>
            <svg ref={svgRef} viewBox={`0 0 ${bed.bedW_mm} ${bed.bedH_mm}`} className="h-full w-full select-none">
              <rect width={bed.bedW_mm} height={bed.bedH_mm} fill="#101826" stroke="#3a4d6c" />
              {bed.grid.enabled ? <g>
                {Array.from({ length: Math.floor(bed.bedW_mm / bed.grid.spacing) + 1 }, (_, i) => roundMm(i * bed.grid.spacing + bed.grid.offsetX))
                  .filter((x) => x >= 0 && x <= bed.bedW_mm)
                  .map((x) => <line key={`vx-${x}`} x1={x} x2={x} y1={0} y2={bed.bedH_mm} stroke="#1e293b" strokeWidth={0.6} />)}
                {Array.from({ length: Math.floor(bed.bedH_mm / bed.grid.spacing) + 1 }, (_, i) => roundMm(i * bed.grid.spacing + bed.grid.offsetY))
                  .filter((y) => y >= 0 && y <= bed.bedH_mm)
                  .map((y) => <line key={`hy-${y}`} y1={y} y2={y} x1={0} x2={bed.bedW_mm} stroke="#1e293b" strokeWidth={0.6} />)}
              </g> : null}

              {bedUi.showIntersections && bed.grid.enabled ? <g>
                {Array.from({ length: Math.floor(bed.bedW_mm / bed.grid.spacing) + 1 }, (_, i) => roundMm(i * bed.grid.spacing + bed.grid.offsetX))
                  .filter((x) => x >= 0 && x <= bed.bedW_mm)
                  .flatMap((x) => Array.from({ length: Math.floor(bed.bedH_mm / bed.grid.spacing) + 1 }, (_, i) => roundMm(i * bed.grid.spacing + bed.grid.offsetY))
                    .filter((y) => y >= 0 && y <= bed.bedH_mm)
                    .map((y) => <circle key={`pt-${x}-${y}`} cx={x} cy={y} r={0.8} fill="#334155" />))}
              </g> : null}

              {bed.rotaryConfig.enabled ? <>
                <line
                  x1={0}
                  x2={bed.bedW_mm}
                  y1={bed.rotaryConfig.axisY}
                  y2={bed.rotaryConfig.axisY}
                  stroke="#60a5fa"
                  strokeDasharray="4 4"
                  className="cursor-row-resize"
                  onPointerDown={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const baseAxis = bed.rotaryConfig.axisY;
                    const startY = e.clientY;
                    let latest = baseAxis;
                    const onMove = (ev: PointerEvent) => {
                      const next = clamp(baseAxis + toMm(ev.clientY - startY, bed.bedH_mm, rect.height), 0, bed.bedH_mm);
                      latest = bedUi.snapToGrid ? withGridSnap(next, bed, "y") : roundMm(next);
                      setLocalBedLayout({ ...bed, rotaryConfig: { ...bed.rotaryConfig, axisY: latest } });
                    };
                    const onUp = () => {
                      window.removeEventListener("pointermove", onMove);
                      window.removeEventListener("pointerup", onUp);
                      void save({ bedLayout: { ...bed, rotaryConfig: { ...bed.rotaryConfig, axisY: latest } } }, "bed");
                    };
                    window.addEventListener("pointermove", onMove);
                    window.addEventListener("pointerup", onUp);
                  }}
                />
                <circle
                  cx={bed.rotaryConfig.chuckX}
                  cy={bed.rotaryConfig.axisY}
                  r={7}
                  fill="#f59e0b"
                  className="cursor-ew-resize"
                  onPointerDown={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const baseX = bed.rotaryConfig.chuckX;
                    const startX = e.clientX;
                    let latest = baseX;
                    const onMove = (ev: PointerEvent) => {
                      const next = clamp(baseX + toMm(ev.clientX - startX, bed.bedW_mm, rect.width), 0, bed.bedW_mm);
                      latest = bedUi.snapToGrid ? withGridSnap(next, bed, "x") : roundMm(next);
                      setLocalBedLayout({ ...bed, rotaryConfig: { ...bed.rotaryConfig, chuckX: latest } });
                    };
                    const onUp = () => {
                      window.removeEventListener("pointermove", onMove);
                      window.removeEventListener("pointerup", onUp);
                      void save({ bedLayout: { ...bed, rotaryConfig: { ...bed.rotaryConfig, chuckX: latest } } }, "bed");
                    };
                    window.addEventListener("pointermove", onMove);
                    window.addEventListener("pointerup", onUp);
                  }}
                />
                <circle
                  cx={bed.rotaryConfig.tailstockX}
                  cy={bed.rotaryConfig.axisY}
                  r={7}
                  fill="#f59e0b"
                  className="cursor-ew-resize"
                  onPointerDown={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const baseX = bed.rotaryConfig.tailstockX;
                    const startX = e.clientX;
                    let latest = baseX;
                    const onMove = (ev: PointerEvent) => {
                      const next = clamp(baseX + toMm(ev.clientX - startX, bed.bedW_mm, rect.width), 0, bed.bedW_mm);
                      latest = bedUi.snapToGrid ? withGridSnap(next, bed, "x") : roundMm(next);
                      setLocalBedLayout({ ...bed, rotaryConfig: { ...bed.rotaryConfig, tailstockX: latest } });
                    };
                    const onUp = () => {
                      window.removeEventListener("pointermove", onMove);
                      window.removeEventListener("pointerup", onUp);
                      void save({ bedLayout: { ...bed, rotaryConfig: { ...bed.rotaryConfig, tailstockX: latest } } }, "bed");
                    };
                    window.addEventListener("pointermove", onMove);
                    window.addEventListener("pointerup", onUp);
                  }}
                />
              </> : null}

              <g>
                <line x1={8} y1={bed.bedH_mm - 8} x2={68} y2={bed.bedH_mm - 8} stroke="#94a3b8" strokeWidth={1.2} />
                <line x1={8} y1={bed.bedH_mm - 8} x2={8} y2={bed.bedH_mm - 68} stroke="#94a3b8" strokeWidth={1.2} />
                <text x={72} y={bed.bedH_mm - 6} fill="#94a3b8" fontSize={8}>X (mm)</text>
                <text x={10} y={bed.bedH_mm - 74} fill="#94a3b8" fontSize={8}>Y (mm)</text>
              </g>

              <rect
                x={bed.placedItem.x - 20}
                y={bed.placedItem.y - 10}
                width={40}
                height={20}
                fill="#22c55e"
                transform={`rotate(${bed.placedItem.rotation} ${bed.placedItem.x} ${bed.placedItem.y})`}
                className="cursor-move"
                onPointerDown={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const base = { ...bed.placedItem };
                  let latest = base;
                  const onMove = (ev: PointerEvent) => {
                    const x = clamp(base.x + toMm(ev.clientX - startX, bed.bedW_mm, rect.width), 0, bed.bedW_mm);
                    const y = clamp(base.y + toMm(ev.clientY - startY, bed.bedH_mm, rect.height), 0, bed.bedH_mm);
                    latest = {
                      ...base,
                      x: bedUi.snapToGrid ? withGridSnap(x, bed, "x") : roundMm(x),
                      y: bedUi.snapToGrid ? withGridSnap(y, bed, "y") : roundMm(y)
                    };
                    setLocalBedLayout({ ...bed, placedItem: latest });
                  };
                  const onUp = () => {
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerup", onUp);
                    void save({ bedLayout: { ...bed, placedItem: latest } }, "bed");
                  };
                  window.addEventListener("pointermove", onMove);
                  window.addEventListener("pointerup", onUp);
                }}
              />
            </svg>
          </div>
        </> : null}
      </section>

      <aside className="space-y-3 text-sm">
        <section className="rounded border p-3">
          <h2 className="mb-2 font-medium">Production Config</h2>
          <div className="space-y-3">
            <label className="block">Machine
              <select className="mt-1 w-full rounded border px-2 py-1" value={productionConfig.machineId} onChange={(e) => save({ productionConfig: { ...productionConfig, machineId: e.target.value } }, "production")}>
                {machinePresets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <p className="text-xs text-slate-500">Select output hardware profile.</p>
            </label>
            <label className="block">Lens
              <select className="mt-1 w-full rounded border px-2 py-1" value={productionConfig.lensId} onChange={(e) => save({ productionConfig: { ...productionConfig, lensId: e.target.value } }, "production")}>
                {lensPresets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <p className="text-xs text-slate-500">Affects marking field dimensions.</p>
            </label>
            <label className="block">Preset
              <select className="mt-1 w-full rounded border px-2 py-1" value={productionConfig.presetId} onChange={(e) => save({ productionConfig: { ...productionConfig, presetId: e.target.value } }, "production")}>
                {settingsPresets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <p className="text-xs text-slate-500">Use existing validated process settings.</p>
            </label>
          </div>
        </section>

        {bed ? <>
          <section className="rounded border p-3">
            <h3 className="mb-2 font-medium">Grid Controls</h3>
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-2"><span>Enabled</span><input type="checkbox" checked={bed.grid.enabled} onChange={(e) => void save({ bedLayout: { ...bed, grid: { ...bed.grid, enabled: e.target.checked } } }, "bed")} /></label>
              <label className="block">Spacing (mm)<input className="mt-1 w-full rounded border px-2 py-1" type="number" min={1} value={bed.grid.spacing} onChange={(e) => setLocalBedLayout({ ...bed, grid: { ...bed.grid, spacing: Number(e.target.value) || 1 } })} onBlur={(e) => void save({ bedLayout: { ...bed, grid: { ...bed.grid, spacing: Math.max(1, Number(e.target.value) || 1) } } }, "bed")} /></label>
              <label className="block">offsetX_mm<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={bed.grid.offsetX} onChange={(e) => setLocalBedLayout({ ...bed, grid: { ...bed.grid, offsetX: Number(e.target.value) || 0 } })} onBlur={(e) => void save({ bedLayout: { ...bed, grid: { ...bed.grid, offsetX: Number(e.target.value) || 0 } } }, "bed")} /></label>
              <label className="block">offsetY_mm<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={bed.grid.offsetY} onChange={(e) => setLocalBedLayout({ ...bed, grid: { ...bed.grid, offsetY: Number(e.target.value) || 0 } })} onBlur={(e) => void save({ bedLayout: { ...bed, grid: { ...bed.grid, offsetY: Number(e.target.value) || 0 } } }, "bed")} /></label>
              <label className="flex items-center justify-between gap-2"><span>snapToGrid</span><input type="checkbox" checked={bedUi.snapToGrid} onChange={(e) => setBedUi((prev) => ({ ...prev, snapToGrid: e.target.checked }))} /></label>
              <label className="flex items-center justify-between gap-2"><span>showIntersections</span><input type="checkbox" checked={bedUi.showIntersections} onChange={(e) => setBedUi((prev) => ({ ...prev, showIntersections: e.target.checked }))} /></label>
            </div>
          </section>

          <section className="rounded border p-3">
            <h3 className="mb-2 font-medium">Rotary Controls</h3>
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-2"><span>showRotary</span><input type="checkbox" checked={bed.rotaryConfig.enabled} onChange={(e) => void save({ bedLayout: { ...bed, rotaryConfig: { ...bed.rotaryConfig, enabled: e.target.checked } } }, "bed")} /></label>
              <label className="block">axisY_mm<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={bed.rotaryConfig.axisY} onChange={(e) => setLocalBedLayout({ ...bed, rotaryConfig: { ...bed.rotaryConfig, axisY: Number(e.target.value) || 0 } })} onBlur={(e) => void save({ bedLayout: { ...bed, rotaryConfig: { ...bed.rotaryConfig, axisY: Number(e.target.value) || 0 } } }, "bed")} /></label>
              <label className="block">chuckX_mm<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={bed.rotaryConfig.chuckX} onChange={(e) => setLocalBedLayout({ ...bed, rotaryConfig: { ...bed.rotaryConfig, chuckX: Number(e.target.value) || 0 } })} onBlur={(e) => void save({ bedLayout: { ...bed, rotaryConfig: { ...bed.rotaryConfig, chuckX: Number(e.target.value) || 0 } } }, "bed")} /></label>
              <label className="block">tailstockX_mm<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={bed.rotaryConfig.tailstockX} onChange={(e) => setLocalBedLayout({ ...bed, rotaryConfig: { ...bed.rotaryConfig, tailstockX: Number(e.target.value) || 0 } })} onBlur={(e) => void save({ bedLayout: { ...bed, rotaryConfig: { ...bed.rotaryConfig, tailstockX: Number(e.target.value) || 0 } } }, "bed")} /></label>
              <label className="block">cylinderDiameter_mm<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={bed.rotaryConfig.cylinderGhostDiameter ?? 0} onChange={(e) => setLocalBedLayout({ ...bed, rotaryConfig: { ...bed.rotaryConfig, cylinderGhostDiameter: Number(e.target.value) || 0 } })} onBlur={(e) => void save({ bedLayout: { ...bed, rotaryConfig: { ...bed.rotaryConfig, cylinderGhostDiameter: Number(e.target.value) || 0 } } }, "bed")} /></label>
            </div>
          </section>

          <section className="rounded border p-3">
            <h3 className="mb-2 font-medium">Part Placement</h3>
            <div className="space-y-2">
              <label className="block">partX_mm<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={bed.placedItem.x} onChange={(e) => setLocalBedLayout({ ...bed, placedItem: { ...bed.placedItem, x: Number(e.target.value) || 0 } })} onBlur={(e) => void save({ bedLayout: { ...bed, placedItem: { ...bed.placedItem, x: Number(e.target.value) || 0 } } }, "bed")} /></label>
              <label className="block">partY_mm<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={bed.placedItem.y} onChange={(e) => setLocalBedLayout({ ...bed, placedItem: { ...bed.placedItem, y: Number(e.target.value) || 0 } })} onBlur={(e) => void save({ bedLayout: { ...bed, placedItem: { ...bed.placedItem, y: Number(e.target.value) || 0 } } }, "bed")} /></label>
              <label className="block">rotation_deg<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={bed.placedItem.rotation} onChange={(e) => setLocalBedLayout({ ...bed, placedItem: { ...bed.placedItem, rotation: Number(e.target.value) || 0 } })} onBlur={(e) => void save({ bedLayout: { ...bed, placedItem: { ...bed.placedItem, rotation: Number(e.target.value) || 0 } } }, "bed")} /></label>
              <button className="w-full rounded border px-3 py-1" onClick={() => void save({ bedLayout: { ...bed, placedItem: { ...bed.placedItem, x: roundMm(bed.bedW_mm / 2), y: roundMm(bed.bedH_mm / 2) } } }, "bed")}>centerOnBed</button>
            </div>
          </section>
        </> : null}
      </aside>
    </div>

    {generated ? <section className="rounded border p-3 text-sm">
      <h2 className="mb-1 font-medium">Artifacts</h2>
      <p className="mb-2 text-xs text-emerald-700">Generated ✅ {new Date(generated.generatedAt).toLocaleString()}</p>
      <ul className="space-y-2">
        {Object.entries(generated.artifacts).map(([key, value]) => (
          <li key={key} className="rounded border p-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{key === "jobJson" ? "job.json" : key === "proof" ? "proof.svg" : "bed.svg"}</p>
                <p className="break-all text-xs text-slate-600">{value}</p>
              </div>
              <button className="shrink-0 rounded border px-2 py-1 text-xs" onClick={() => void copyPath(key, value)}>{copyState === key ? "Copied" : "Copy"}</button>
            </div>
          </li>
        ))}
      </ul>
    </section> : null}
  </div>;
}
