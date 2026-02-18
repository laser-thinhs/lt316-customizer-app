"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePlacementStore, selectPlacementDerived } from "@/store/placementStore";
import type { PlacementInput } from "@/schemas/placement";
import { circumferenceMm } from "@/lib/geometry/cylinder";

const TumblerPreview3D = dynamic(() => import("./TumblerPreview3D"), { ssr: false });

type AssetRef = {
  id: string;
  kind: string;
  filename: string;
  mime: string;
  widthPx: number | null;
  heightPx: number | null;
  bytes: number | null;
  createdAt: string;
  url: string;
};

type Props = {
  jobId: string;
  initialPlacement: PlacementInput;
  profile: { diameterMm: number; engraveZoneHeightMm: number };
  assets: AssetRef[];
};

type Toast = { id: number; kind: "success" | "error"; message: string };

function toLegacyPlacement(input: PlacementInput): {
  widthMm: number;
  heightMm: number;
  offsetXMm: number;
  offsetYMm: number;
  rotationDeg: number;
  anchor: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
} {
  if ("widthMm" in input) {
    return {
      widthMm: input.widthMm,
      heightMm: input.heightMm,
      offsetXMm: input.offsetXMm,
      offsetYMm: input.offsetYMm,
      rotationDeg: input.rotationDeg,
      anchor: input.anchor
    };
  }

  return {
    widthMm: input.canvas.widthMm,
    heightMm: input.canvas.heightMm,
    offsetXMm: 0,
    offsetYMm: 0,
    rotationDeg: 0,
    anchor: "top-left"
  };
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      <input type="number" step="0.1" className="w-full rounded border px-2 py-1" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function uploadWithProgress(form: FormData, onProgress: (progress: number) => void): Promise<AssetRef> {
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/assets/upload");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error("Upload failed"));
        return;
      }
      const payload = JSON.parse(xhr.responseText) as { data: AssetRef };
      resolve(payload.data);
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

export default function EditorClient({ jobId, initialPlacement, profile, assets: initialAssets }: Props) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<AssetRef[]>(initialAssets);
  const [activeAsset, setActiveAsset] = useState<AssetRef | null>(initialAssets[0] ?? null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(initialAssets[0]?.url ?? null);
  const [clampEnabled, setClampEnabled] = useState(true);
  const [search, setSearch] = useState("");
  const [imagesOnly, setImagesOnly] = useState(true);
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "name">("recent");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const store = usePlacementStore();
  const derived = useMemo(() => selectPlacementDerived(store), [store]);

  const pushToast = (kind: Toast["kind"], message: string) => {
    const next = { id: Date.now() + Math.random(), kind, message };
    setToasts((current) => [...current, next]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== next.id));
    }, 2600);
  };

  useEffect(() => {
    store.setProfile({
      diameterMm: profile.diameterMm,
      unwrapWidthMm: circumferenceMm(profile.diameterMm),
      unwrapHeightMm: profile.engraveZoneHeightMm
    });
    store.setPlacement(toLegacyPlacement(initialPlacement));
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
    const previous = toLegacyPlacement(initialPlacement);
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

  const placeOnCanvas = (asset: AssetRef) => {
    setActiveAsset(asset);
    setPreviewSrc(asset.url);
    store.setAsset(asset.id);
  };

  const validateFile = (file: File) => {
    const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowed.has(file.type)) return "Please upload png, jpg, jpeg, or webp images.";
    if (file.size > 10 * 1024 * 1024) return "File is larger than 10MB. Please use a smaller image.";
    return null;
  };

  const uploadFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const validation = validateFile(file);
      if (validation) {
        pushToast("error", `${file.name}: ${validation}`);
        continue;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("designJobId", jobId);

      try {
        setUploadProgress(0);
        const asset = await uploadWithProgress(form, setUploadProgress);
        setAssets((current) => [asset, ...current]);
        placeOnCanvas(asset);
        pushToast("success", `${asset.filename} uploaded`);
      } catch {
        pushToast("error", `Failed to upload ${file.name}`);
      } finally {
        setUploadProgress(null);
      }
    }
  };

  const onRename = async (assetId: string, filename: string) => {
    const res = await fetch(`/api/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename })
    });
    if (!res.ok) {
      pushToast("error", "Rename failed");
      return;
    }
    const json = await res.json();
    const updated = json.data as AssetRef;
    setAssets((current) => current.map((asset) => asset.id === assetId ? updated : asset));
    if (activeAsset?.id === assetId) setActiveAsset(updated);
    pushToast("success", "Asset renamed");
  };

  const onDelete = async (assetId: string) => {
    const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("error", "Delete failed");
      return;
    }

    const nextAssets = assets.filter((asset) => asset.id !== assetId);
    setAssets(nextAssets);
    if (activeAsset?.id === assetId) {
      const next = nextAssets[0] ?? null;
      setActiveAsset(next);
      setPreviewSrc(next?.url ?? null);
      store.setAsset(next?.id ?? null);
    }
    pushToast("success", "Asset deleted");
  };

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return assets
      .filter((asset) => asset.filename.toLowerCase().includes(normalizedSearch))
      .filter((asset) => imagesOnly ? asset.mime.startsWith("image/") : true)
      .sort((a, b) => {
        if (sortBy === "name") return a.filename.localeCompare(b.filename);
        if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [assets, imagesOnly, search, sortBy]);

  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  const mmScale = 3;
  const rect = clampEnabled ? derived.clampedRect : derived.resolvedRect;

  return (
    <main className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[420px_1fr_360px]">
      <section className="space-y-3 rounded border bg-white p-3">
        <h2 className="font-semibold">Artwork Assets</h2>

        <div
          className="rounded border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void uploadFiles(e.dataTransfer.files);
          }}
        >
          <p className="text-sm text-slate-700">Drag and drop artwork images here</p>
          <p className="mt-1 text-xs text-slate-500">PNG / JPG / JPEG / WEBP, up to 10MB each.</p>
          <button className="mt-3 rounded bg-slate-900 px-3 py-1 text-xs text-white" onClick={() => fileInputRef.current?.click()}>Upload</button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".png,.jpg,.jpeg,.webp"
            onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
          />
          {uploadProgress !== null ? (
            <div className="mt-3 h-2 overflow-hidden rounded bg-slate-200">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_180px]">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search filename"
                className="w-full rounded border px-2 py-1 text-xs"
              />
              <select className="rounded border px-2 py-1 text-xs" value={sortBy} onChange={(e) => setSortBy(e.target.value as "recent" | "oldest" | "name")}>
                <option value="recent">Recent uploads</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
              </select>
            </div>
            <label className="mb-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={imagesOnly} onChange={() => setImagesOnly((v) => !v)} /> Images only</label>
            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-auto pr-1">
              {filteredAssets.map((asset) => (
                <article key={asset.id} className="rounded border p-2 text-xs">
                  <Image
                    src={asset.url}
                    alt={asset.filename}
                    width={320}
                    height={80}
                    unoptimized
                    className="mb-2 h-20 w-full rounded object-cover"
                  />
                  <input
                    defaultValue={asset.filename}
                    className="mb-1 w-full rounded border px-1 py-0.5"
                    onBlur={(e) => e.target.value !== asset.filename && void onRename(asset.id, e.target.value)}
                  />
                  <p className="text-[11px] text-slate-600">{asset.widthPx ?? "?"}×{asset.heightPx ?? "?"} px · {formatBytes(asset.bytes)}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <button className="rounded border px-1 py-0.5" onClick={() => placeOnCanvas(asset)}>Add</button>
                    <button
                      className="rounded border px-1 py-0.5"
                      onClick={async () => {
                        await navigator.clipboard.writeText(`${window.location.origin}${asset.url}`);
                        pushToast("success", "Asset URL copied");
                      }}
                    >
                      Copy URL
                    </button>
                    <button className="col-span-2 rounded border border-red-200 px-1 py-0.5 text-red-600" onClick={() => void onDelete(asset.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded border bg-slate-50 p-2 text-xs">
            <p className="mb-1 font-medium">Selected preview</p>
            {activeAsset ? (
              <>
                <Image
                  src={activeAsset.url}
                  alt={activeAsset.filename}
                  width={320}
                  height={112}
                  unoptimized
                  className="mb-2 h-28 w-full rounded object-contain"
                />
                <p className="break-all font-medium">{activeAsset.filename}</p>
                <p className="text-slate-600">{activeAsset.widthPx ?? "?"} × {activeAsset.heightPx ?? "?"} px</p>
                <p className="text-slate-600">{formatBytes(activeAsset.bytes)}</p>
                <p className="text-slate-600">{new Date(activeAsset.createdAt).toLocaleString()}</p>
              </>
            ) : <p className="text-slate-500">No asset selected.</p>}
          </aside>
        </div>

        <h2 className="font-semibold">Controls</h2>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Width (mm)" value={store.placement.widthMm} onChange={(value) => store.patchPlacement({ widthMm: value })} />
          <NumberField label="Height (mm)" value={store.placement.heightMm} onChange={(value) => store.patchPlacement({ heightMm: value })} />
          <NumberField label="Offset X (mm)" value={store.placement.offsetXMm} onChange={(value) => store.patchPlacement({ offsetXMm: value })} />
          <NumberField label="Offset Y (mm)" value={store.placement.offsetYMm} onChange={(value) => store.patchPlacement({ offsetYMm: value })} />
          <NumberField label="Rotation (deg)" value={store.placement.rotationDeg} onChange={(value) => store.patchPlacement({ rotationDeg: value })} />
        </div>
        <select
          value={store.placement.anchor}
          onChange={(e) =>
            store.patchPlacement({
              anchor: e.target.value as "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right"
            })
          }
          className="w-full rounded border px-2 py-1 text-sm"
        >
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
          onRotationDegChange={(value) => store.patchPlacement({ rotationDeg: value })}
          offsetYMm={store.placement.offsetYMm}
          engraveZoneHeightMm={profile.engraveZoneHeightMm}
        />
        <p className="mt-2 text-xs text-slate-600">Asset: {activeAsset?.id ?? "none"}</p>
      </section>

      <div className="pointer-events-none fixed right-3 top-3 z-50 space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded px-3 py-2 text-xs text-white shadow ${toast.kind === "success" ? "bg-emerald-600" : "bg-rose-600"}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}
