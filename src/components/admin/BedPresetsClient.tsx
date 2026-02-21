"use client";

import { BedPreset } from "@/core/v2/types";
import { useEffect, useMemo, useState } from "react";

type BedPresetInput = Omit<BedPreset, "id">;

const emptyPreset = (): BedPresetInput => ({
  name: "New preset",
  isDefault: false,
  bedW_mm: 300,
  bedH_mm: 300,
  grid: { enabled: true, spacing: 25, offsetX_mm: 0, offsetY_mm: 0, snapToGrid: true, showIntersections: false },
  rotaryDefaults: { showRotary: true, axisY_mm: 150, chuckX_mm: 45, tailstockX_mm: 255, cylinderDiameter_mm: 80 },
  holes: { gridEnabled: false, spacing: 25, offsetX_mm: 0, offsetY_mm: 0, customHoles: [] }
});

export default function BedPresetsClient() {
  const [presets, setPresets] = useState<BedPreset[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  async function load() {
    const res = await fetch("/api/admin/bed-presets");
    const payload = await res.json();
    const list = payload.data ?? [];
    setPresets(list);
    setSelectedId((prev) => prev || list[0]?.id || "");
  }
  useEffect(() => {
    void load();
  }, []);

  const selected = useMemo(() => presets.find((p) => p.id === selectedId) ?? null, [presets, selectedId]);

  async function createPreset() {
    await fetch("/api/admin/bed-presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(emptyPreset()) });
    await load();
  }

  async function duplicatePreset(id: string) {
    await fetch("/api/admin/bed-presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ duplicateFromId: id }) });
    await load();
  }

  async function savePreset(next: BedPreset) {
    await fetch(`/api/admin/bed-presets/${next.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    await load();
  }

  async function deletePreset(id: string) {
    await fetch(`/api/admin/bed-presets/${id}`, { method: "DELETE" });
    setSelectedId("");
    await load();
  }

  return <div className="grid gap-4 p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
    <aside className="space-y-3 rounded border p-3">
      <h1 className="text-lg font-semibold">Bed Presets</h1>
      <button className="w-full rounded border px-3 py-2 text-sm" onClick={() => void createPreset()}>Create new</button>
      <div className="space-y-2">
        {presets.map((preset) => <button key={preset.id} className={`w-full rounded border px-2 py-2 text-left text-sm ${selectedId === preset.id ? "border-blue-600 bg-blue-50" : ""}`} onClick={() => setSelectedId(preset.id)}>
          <div className="flex items-center justify-between gap-2">
            <span>{preset.name}</span>
            {preset.isDefault ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">default</span> : null}
          </div>
        </button>)}
      </div>
      {selected ? <button className="w-full rounded border px-3 py-2 text-sm" onClick={() => void duplicatePreset(selected.id)}>Duplicate selected</button> : null}
    </aside>

    {selected ? <section className="space-y-4 rounded border p-4">
      <h2 className="text-lg font-medium">Preset editor</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">Name<input className="mt-1 w-full rounded border px-2 py-1" value={selected.name} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, name: e.target.value } : p))} /></label>
        <label className="flex items-center justify-between rounded border px-3 py-2 text-sm"><span>Set as default</span><input type="checkbox" checked={!!selected.isDefault} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, isDefault: e.target.checked } : p))} /></label>
        <label className="block text-sm">Bed W (mm)<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={selected.bedW_mm} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, bedW_mm: Number(e.target.value) || 0 } : p))} /></label>
        <label className="block text-sm">Bed H (mm)<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={selected.bedH_mm} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, bedH_mm: Number(e.target.value) || 0 } : p))} /></label>
        <label className="block text-sm">Grid spacing<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={selected.grid.spacing} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, grid: { ...p.grid, spacing: Number(e.target.value) || 0 } } : p))} /></label>
        <label className="block text-sm">Grid offset X<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={selected.grid.offsetX_mm} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, grid: { ...p.grid, offsetX_mm: Number(e.target.value) || 0 } } : p))} /></label>
        <label className="block text-sm">Grid offset Y<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={selected.grid.offsetY_mm} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, grid: { ...p.grid, offsetY_mm: Number(e.target.value) || 0 } } : p))} /></label>
        <label className="flex items-center justify-between rounded border px-3 py-2 text-sm"><span>Grid enabled</span><input type="checkbox" checked={selected.grid.enabled} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, grid: { ...p.grid, enabled: e.target.checked } } : p))} /></label>
        <label className="flex items-center justify-between rounded border px-3 py-2 text-sm"><span>Snap to grid</span><input type="checkbox" checked={selected.grid.snapToGrid} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, grid: { ...p.grid, snapToGrid: e.target.checked } } : p))} /></label>
        <label className="flex items-center justify-between rounded border px-3 py-2 text-sm"><span>Show intersections</span><input type="checkbox" checked={selected.grid.showIntersections} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, grid: { ...p.grid, showIntersections: e.target.checked } } : p))} /></label>
        <label className="block text-sm">Axis Y<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={selected.rotaryDefaults.axisY_mm} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, rotaryDefaults: { ...p.rotaryDefaults, axisY_mm: Number(e.target.value) || 0 } } : p))} /></label>
        <label className="block text-sm">Chuck X<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={selected.rotaryDefaults.chuckX_mm} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, rotaryDefaults: { ...p.rotaryDefaults, chuckX_mm: Number(e.target.value) || 0 } } : p))} /></label>
        <label className="block text-sm">Tailstock X<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={selected.rotaryDefaults.tailstockX_mm} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, rotaryDefaults: { ...p.rotaryDefaults, tailstockX_mm: Number(e.target.value) || 0 } } : p))} /></label>
        <label className="block text-sm">Cylinder diameter<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={selected.rotaryDefaults.cylinderDiameter_mm} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, rotaryDefaults: { ...p.rotaryDefaults, cylinderDiameter_mm: Number(e.target.value) || 0 } } : p))} /></label>
        <label className="block text-sm">Holes spacing<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={selected.holes.spacing} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, holes: { ...p.holes, spacing: Number(e.target.value) || 0 } } : p))} /></label>
        <label className="flex items-center justify-between rounded border px-3 py-2 text-sm"><span>Holes grid enabled</span><input type="checkbox" checked={selected.holes.gridEnabled} onChange={(e) => setPresets((prev) => prev.map((p) => p.id === selected.id ? { ...p, holes: { ...p.holes, gridEnabled: e.target.checked } } : p))} /></label>
      </div>
      <div className="flex gap-2">
        <button className="rounded bg-blue-700 px-3 py-2 text-sm text-white" onClick={() => void savePreset(selected)}>Save preset</button>
        <button className="rounded border px-3 py-2 text-sm" onClick={() => void deletePreset(selected.id)}>Delete preset</button>
      </div>

      <div className="rounded border bg-slate-900 p-2" style={{ aspectRatio: `${selected.bedW_mm} / ${selected.bedH_mm}` }}>
        <svg viewBox={`0 0 ${selected.bedW_mm} ${selected.bedH_mm}`} className="h-full w-full">
          <rect width={selected.bedW_mm} height={selected.bedH_mm} fill="#111827" stroke="#334155" />
          {selected.grid.enabled ? Array.from({ length: Math.floor(selected.bedW_mm / selected.grid.spacing) + 1 }, (_, i) => i * selected.grid.spacing + selected.grid.offsetX_mm).map((x) => <line key={`x-${x}`} x1={x} x2={x} y1={0} y2={selected.bedH_mm} stroke="#1f2937" strokeWidth={0.6} />) : null}
          {selected.grid.enabled ? Array.from({ length: Math.floor(selected.bedH_mm / selected.grid.spacing) + 1 }, (_, i) => i * selected.grid.spacing + selected.grid.offsetY_mm).map((y) => <line key={`y-${y}`} y1={y} y2={y} x1={0} x2={selected.bedW_mm} stroke="#1f2937" strokeWidth={0.6} />) : null}
          {selected.rotaryDefaults.showRotary ? <line x1={0} x2={selected.bedW_mm} y1={selected.rotaryDefaults.axisY_mm} y2={selected.rotaryDefaults.axisY_mm} stroke="#60a5fa" strokeDasharray="4 4" /> : null}
          {selected.holes.customHoles.map((hole, idx) => <circle key={idx} cx={hole.x_mm} cy={hole.y_mm} r={2} fill="#f59e0b" />)}
        </svg>
      </div>
    </section> : null}
  </div>;
}
