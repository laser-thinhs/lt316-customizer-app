"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePlacementStore, selectPlacementDerived } from "@/store/placementStore";
import type { PlacementInput } from "@/schemas/placement";
import { circumferenceMm } from "@/lib/geometry/cylinder";

const TumblerPreview3D = dynamic(() => import("./TumblerPreview3D"), { ssr: false });

type AssetRef = { id: string; mimeType: string; kind: string };

type Props = {
  jobId: string;
  initialPlacement: PlacementInput;
  profile: { diameterMm: number; engraveZoneHeightMm: number };
  assets: AssetRef[];
};

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      <input type="number" step="0.1" className="w-full rounded border px-2 py-1" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export default function EditorClient({ jobId, initialPlacement, profile, assets }: Props) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeAsset, setActiveAsset] = useState<AssetRef | null>(assets[0] ?? null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(assets[0] ? `/api/assets/${assets[0].id}` : null);
  const [clampEnabled, setClampEnabled] = useState(true);
  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const store = usePlacementStore();
  const derived = useMemo(() => selectPlacementDerived(store), [store]);

  useEffect(() => {
    store.setProfile({
      diameterMm: profile.diameterMm,
      unwrapWidthMm: circumferenceMm(profile.diameterMm),
      unwrapHeightMm: profile.engraveZoneHeightMm
    });
    store.setPlacement(initialPlacement);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.diameterMm, profile.engraveZoneHeightMm]);

  useEffect(() => {
    setWarnings(derived.validation.warnings);
  }, [derived.validation]);

  useEffect(() => {
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(() => {
      void savePlacement(true);
    }, 600);
    return () => {
      if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.placement]);

  const savePlacement = async (silent = false) => {
    const previous = initialPlacement;
    setSaving(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/placement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placementJson: store.placement })
      });
      if (!res.ok) throw new Error("Failed to save placement");
    } catch {
      store.setPlacement(previous);
      if (!silent) setWarnings(["Save failed. Placement rolled back."]);
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setPreviewSrc((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return objectUrl;
    });

    const form = new FormData();
    form.append("file", file);
    form.append("designJobId", jobId);

    const uploadRes = await fetch("/api/assets/upload", { method: "POST", body: form });
    if (!uploadRes.ok) throw new Error("Upload failed");
    const uploadJson = await uploadRes.json();
    const id = uploadJson.data.id as string;

    await fetch(`/api/assets/${id}/normalize`, { method: "POST" });
    setActiveAsset({ id, mimeType: file.type, kind: "original" });
    setPreviewSrc((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return `/api/assets/${id}`;
    });
    store.setAsset(id);
  };

  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  const mmScale = 3;
  const rect = clampEnabled ? derived.clampedRect : derived.resolvedRect;

  return (
    <main className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[320px_1fr_360px]">
      <section className="space-y-3 rounded border bg-white p-3">
        <h2 className="font-semibold">Controls</h2>
        <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp" onChange={(e) => e.target.files?.[0] && void uploadAsset(e.target.files[0])} />
        {previewSrc ? (
          <div className="space-y-1 rounded border p-2">
            <p className="text-xs font-medium text-slate-700">Artwork preview</p>
            <img src={previewSrc} alt="Uploaded artwork preview" className="max-h-40 w-full rounded object-contain" />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Width (mm)" value={store.placement.widthMm} onChange={(value) => store.patchPlacement({ widthMm: value })} />
          <NumberField label="Height (mm)" value={store.placement.heightMm} onChange={(value) => store.patchPlacement({ heightMm: value })} />
          <NumberField label="Offset X (mm)" value={store.placement.offsetXMm} onChange={(value) => store.patchPlacement({ offsetXMm: value })} />
          <NumberField label="Offset Y (mm)" value={store.placement.offsetYMm} onChange={(value) => store.patchPlacement({ offsetYMm: value })} />
          <NumberField label="Rotation (deg)" value={store.placement.rotationDeg} onChange={(value) => store.patchPlacement({ rotationDeg: value })} />
        </div>
        <select value={store.placement.anchor} onChange={(e) => store.patchPlacement({ anchor: e.target.value as PlacementInput["anchor"] })} className="w-full rounded border px-2 py-1 text-sm">
          {(["center", "top-left", "top-right", "bottom-left", "bottom-right"] as const).map((anchor) => (
            <option key={anchor} value={anchor}>{anchor}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={store.lockAspectRatio} onChange={store.toggleAspectLock} /> Lock aspect</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={store.snapToGrid} onChange={store.toggleSnapToGrid} /> Snap 1mm</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={clampEnabled} onChange={() => setClampEnabled((v) => !v)} /> Hard clamp preview</label>
        <div className="rounded bg-amber-50 p-2 text-xs text-amber-800">{warnings.length ? warnings.join(" ") : "No warnings."}</div>
        <div className="flex gap-2">
          <button onClick={() => store.undo()} className="rounded border px-2 py-1 text-xs">Undo</button>
          <button onClick={() => store.redo()} className="rounded border px-2 py-1 text-xs">Redo</button>
          <button onClick={() => void savePlacement()} className="ml-auto rounded bg-slate-900 px-3 py-1 text-xs text-white">{saving ? "Saving..." : "Save draft"}</button>
        </div>
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">2D Unwrapped Canvas</h2>
        <div className="relative overflow-auto rounded border bg-slate-50" style={{ width: "100%", minHeight: 420 }}>
          <div
            className="relative border border-slate-300"
            style={{ width: derived.zone.widthMm * mmScale, height: derived.zone.heightMm * mmScale, backgroundSize: `${mmScale * 10}px ${mmScale * 10}px`, backgroundImage: "linear-gradient(to right,#e2e8f0 1px,transparent 1px),linear-gradient(to bottom,#e2e8f0 1px,transparent 1px)" }}
            onPointerMove={(e) => {
              if ((e.buttons & 1) === 0) return;
              const target = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - target.left) / mmScale;
              const y = (e.clientY - target.top) / mmScale;
              store.patchPlacement({ offsetXMm: x, offsetYMm: y });
            }}
          >
            <div className="absolute left-0 top-0 h-full w-0.5 bg-red-500" />
            <div
              className="absolute border-2 border-blue-600/80 bg-blue-300/20"
              style={{
                left: rect.xMm * mmScale,
                top: rect.yMm * mmScale,
                width: rect.widthMm * mmScale,
                height: rect.heightMm * mmScale,
                transform: `rotate(${store.placement.rotationDeg}deg)`,
                transformOrigin: "center"
              }}
            />
          </div>
        </div>
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">3D Preview</h2>
        <TumblerPreview3D
          diameterMm={profile.diameterMm}
          heightMm={profile.engraveZoneHeightMm}
          rotationDeg={store.placement.rotationDeg}
          offsetYMm={store.placement.offsetYMm}
          engraveZoneHeightMm={profile.engraveZoneHeightMm}
        />
        <p className="mt-2 text-xs text-slate-600">Asset: {activeAsset?.id ?? "none"}</p>
      </section>
    </main>
  );
}
