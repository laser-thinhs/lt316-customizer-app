"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ImagePlacementObject,
  PlacementDocument,
  PlacementObject,
  TextObject,
  createDefaultPlacementDocument,
  placementDocumentSchema
} from "@/schemas/placement";
import { clampTextPlacementToZone, validateTextPlacement } from "@/lib/geometry/textLayout";
import type { ExportPayload, PreflightResult } from "@/schemas/preflight-export";
import { buildDefaultImagePlacement } from "@/lib/placement/image-insertion";
import { useAutosavePlacement } from "@/hooks/useAutosavePlacement";
import { arePlacementsEqual } from "@/lib/placement/stableCompare";
import InspectorPanel from "@/components/editor/InspectorPanel";

type Props = {
  designJobId: string;
  placement: PlacementDocument;
  onUpdated: (placement: PlacementDocument) => void;
};

type ApiAsset = {
  id: string;
  designJobId: string;
  kind: string;
  originalName: string | null;
  mimeType: string;
  byteSize: number | null;
  widthPx: number | null;
  heightPx: number | null;
  url: string;
  path: string;
  createdAt: string;
};

const curatedFonts = ["Inter", "Roboto Mono"];

type TransformField = "xMm" | "yMm" | "widthMm" | "heightMm" | "rotationDeg";
type TransformValues = Record<TransformField, string>;

const defaultTransformValues: TransformValues = { xMm: "", yMm: "", widthMm: "", heightMm: "", rotationDeg: "" };

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isTextObject(object: PlacementObject | null): object is TextObject {
  return Boolean(object && (object.kind === "text_line" || object.kind === "text_block" || object.kind === "text_arc"));
}

function isImageObject(object: PlacementObject | null): object is ImagePlacementObject {
  return Boolean(object && object.kind === "image");
}

function createTextObject(kind: TextObject["kind"]): TextObject {
  const base = {
    id: `text-${randomId()}`,
    content: "Sample text",
    fontFamily: curatedFonts[0],
    fontWeight: 400,
    fontStyle: "normal" as const,
    fontSizeMm: 4,
    lineHeight: 1.2,
    letterSpacingMm: 0,
    horizontalAlign: "left" as const,
    verticalAlign: "top" as const,
    rotationDeg: 0,
    anchor: "center" as const,
    offsetXMm: 5,
    offsetYMm: 5,
    boxWidthMm: 40,
    boxHeightMm: 10,
    fillMode: "fill" as const,
    strokeWidthMm: 0,
    allCaps: false,
    mirrorX: false,
    mirrorY: false,
    zIndex: 10
  };

  if (kind === "text_arc") {
    return {
      ...base,
      kind,
      arc: {
        radiusMm: 25,
        startAngleDeg: -45,
        endAngleDeg: 45,
        direction: "cw",
        baselineMode: "center",
        seamWrapMode: "disallow"
      }
    };
  }

  return { ...base, kind };
}

const roundToHundredth = (value: number) => Math.round(value * 100) / 100;

export default function PlacementEditor({ designJobId, placement, onUpdated }: Props) {
  const [doc, setDoc] = useState<PlacementDocument>(placementDocumentSchema.parse(placement));
  const [assets, setAssets] = useState<ApiAsset[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [serverDoc, setServerDoc] = useState<PlacementDocument>(placementDocumentSchema.parse(placement));
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(doc.objects[0]?.id ?? null);
  const [undoStack, setUndoStack] = useState<PlacementDocument[]>([]);
  const [redoStack, setRedoStack] = useState<PlacementDocument[]>([]);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [exportPayload, setExportPayload] = useState<ExportPayload | null>(null);
  const [batchIds, setBatchIds] = useState("");
  const [isRunningPreflight, setRunningPreflight] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const [transformValues, setTransformValues] = useState<TransformValues>(defaultTransformValues);
  const [transformErrors, setTransformErrors] = useState<{ field: TransformField; message: string }[]>([]);
  const [hiddenObjectIds, setHiddenObjectIds] = useState<Set<string>>(new Set());
  const [lockedObjectIds, setLockedObjectIds] = useState<Set<string>>(new Set());
  const [blendModeByObjectId, setBlendModeByObjectId] = useState<Record<string, string>>({});

  const selected = useMemo(
    () => doc.objects.find((entry) => entry.id === selectedObjectId) ?? null,
    [doc.objects, selectedObjectId]
  );

  const selectedWarnings = useMemo(() => {
    if (!isTextObject(selected)) return [];
    return validateTextPlacement({ object: selected, zone: doc.canvas, strokeWidthWarningThresholdMm: doc.machine.strokeWidthWarningThresholdMm });
  }, [selected, doc.canvas, doc.machine.strokeWidthWarningThresholdMm]);

  useEffect(() => {
    if (!selected) {
      setTransformValues(defaultTransformValues);
      setTransformErrors([]);
      return;
    }
    if (isImageObject(selected)) {
      setTransformValues({ xMm: `${selected.xMm}`, yMm: `${selected.yMm}`, widthMm: `${selected.widthMm}`, heightMm: `${selected.heightMm}`, rotationDeg: `${selected.rotationDeg}` });
    }
    if (isTextObject(selected)) {
      setTransformValues({ xMm: `${selected.offsetXMm}`, yMm: `${selected.offsetYMm}`, widthMm: `${selected.boxWidthMm}`, heightMm: `${selected.boxHeightMm}`, rotationDeg: `${selected.rotationDeg}` });
    }
    setTransformErrors([]);
  }, [selected]);

  const groupedIssues = useMemo(() => {
    const issues = preflight?.issues ?? [];
    return { error: issues.filter((i) => i.severity === "error"), warning: issues.filter((i) => i.severity === "warning"), info: issues.filter((i) => i.severity === "info") };
  }, [preflight]);

  const commitDoc = (next: PlacementDocument) => {
    setUndoStack((prev) => [...prev.slice(-29), doc]);
    setRedoStack([]);
    setDoc(next);
  };

  const refreshAssets = async () => {
    try {
      const res = await fetch(`/api/design-jobs/${designJobId}/assets`);
      if (!res || typeof res.json !== "function") return setAssets([]);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load assets");
      setAssets(Array.isArray(json.data) ? (json.data as ApiAsset[]) : []);
    } catch {
      setAssets([]);
    }
  };

  useEffect(() => {
    void refreshAssets();
  }, [designJobId]);

  const handleRecoveredPlacement = useCallback((localDraft: PlacementDocument) => setDoc(localDraft), []);
  const handleSavedPlacement = useCallback((savedDoc: PlacementDocument) => {
    if (!arePlacementsEqual(doc, savedDoc)) setDoc(savedDoc);
    setServerDoc(savedDoc);
    onUpdated(savedDoc);
  }, [doc, onUpdated]);

  const autosave = useAutosavePlacement({ designJobId, placement: doc, serverPlacement: serverDoc, onPlacementRecovered: handleRecoveredPlacement, onPlacementSaved: handleSavedPlacement });

  const addText = (kind: TextObject["kind"]) => {
    const clamped = clampTextPlacementToZone(createTextObject(kind), doc.canvas);
    commitDoc({ ...doc, objects: [...doc.objects, clamped] });
    setSelectedObjectId(clamped.id);
  };

  const updateSelectedText = (updater: (object: TextObject) => TextObject) => {
    if (!isTextObject(selected) || lockedObjectIds.has(selected.id)) return;
    const next = updater(selected);
    commitDoc({ ...doc, objects: doc.objects.map((entry) => (entry.id === selected.id ? next : entry)) });
  };

  const updateSelectedImage = (patch: Partial<ImagePlacementObject>) => {
    if (!isImageObject(selected) || lockedObjectIds.has(selected.id)) return;
    const next: ImagePlacementObject = {
      ...selected,
      ...patch,
      widthMm: Math.max(0.01, roundToHundredth(Number(patch.widthMm ?? selected.widthMm))),
      heightMm: Math.max(0.01, roundToHundredth(Number(patch.heightMm ?? selected.heightMm))),
      xMm: roundToHundredth(Number(patch.xMm ?? selected.xMm)),
      yMm: roundToHundredth(Number(patch.yMm ?? selected.yMm)),
      rotationDeg: roundToHundredth(Number(patch.rotationDeg ?? selected.rotationDeg)),
      opacity: Math.min(1, Math.max(0, Number(patch.opacity ?? selected.opacity)))
    };
    if (![next.xMm, next.yMm, next.widthMm, next.heightMm].every(Number.isFinite)) return setStatusMessage("Image placement values must be finite numbers.");
    commitDoc({ ...doc, objects: doc.objects.map((entry) => (entry.id === selected.id ? next : entry)) });
  };

  const parseTransformValue = (field: TransformField): { ok: true; value: number } | { ok: false; message: string } => {
    const value = Number(transformValues[field]);
    if (!Number.isFinite(value)) return { ok: false, message: "Value must be a finite number." };
    if ((field === "widthMm" || field === "heightMm") && value <= 0) return { ok: false, message: "Value must be greater than 0." };
    return { ok: true, value };
  };

  const onTransformChange = (field: TransformField, value: string) => setTransformValues((prev) => ({ ...prev, [field]: value }));

  const onBlurTransformField = (field: TransformField) => {
    if (!selected || lockedObjectIds.has(selected.id)) return;
    const parsed = parseTransformValue(field);
    if (!parsed.ok) {
      setTransformErrors((prev) => [...prev.filter((entry) => entry.field !== field), { field, message: parsed.message }]);
      return;
    }
    setTransformErrors((prev) => prev.filter((entry) => entry.field !== field));

    if (isImageObject(selected)) {
      if (field === "widthMm" && selected.lockAspectRatio) {
        const ratio = selected.heightMm / selected.widthMm;
        updateSelectedImage({ widthMm: parsed.value, heightMm: parsed.value * ratio });
        return;
      }
      if (field === "heightMm" && selected.lockAspectRatio) {
        const ratio = selected.widthMm / selected.heightMm;
        updateSelectedImage({ heightMm: parsed.value, widthMm: parsed.value * ratio });
        return;
      }
      updateSelectedImage({ [field]: parsed.value } as Partial<ImagePlacementObject>);
      return;
    }

    if (isTextObject(selected)) {
      updateSelectedText((obj) => ({
        ...obj,
        offsetXMm: field === "xMm" ? parsed.value : obj.offsetXMm,
        offsetYMm: field === "yMm" ? parsed.value : obj.offsetYMm,
        boxWidthMm: field === "widthMm" ? parsed.value : obj.boxWidthMm,
        boxHeightMm: field === "heightMm" ? parsed.value : obj.boxHeightMm,
        rotationDeg: field === "rotationDeg" ? parsed.value : obj.rotationDeg
      }));
    }
  };

  const onToggleAspectRatio = () => isImageObject(selected) && updateSelectedImage({ lockAspectRatio: !selected.lockAspectRatio });
  const onResetRotation = () => (isImageObject(selected) ? updateSelectedImage({ rotationDeg: 0 }) : isTextObject(selected) ? updateSelectedText((o) => ({ ...o, rotationDeg: 0 })) : undefined);
  const onCenterOnCanvas = () => {
    if (!selected || lockedObjectIds.has(selected.id)) return;
    if (isImageObject(selected)) updateSelectedImage({ xMm: roundToHundredth((doc.canvas.widthMm - selected.widthMm) / 2), yMm: roundToHundredth((doc.canvas.heightMm - selected.heightMm) / 2) });
    if (isTextObject(selected)) updateSelectedText((o) => ({ ...o, offsetXMm: roundToHundredth(doc.canvas.widthMm / 2), offsetYMm: roundToHundredth(doc.canvas.heightMm / 2) }));
  };

  const onDuplicate = () => {
    if (!selected) return;
    const duplicated = { ...selected, id: `${selected.kind}-${randomId()}` } as PlacementObject;
    if (isImageObject(duplicated)) {
      duplicated.xMm += 2;
      duplicated.yMm += 2;
    }
    if (isTextObject(duplicated)) {
      duplicated.offsetXMm += 2;
      duplicated.offsetYMm += 2;
    }
    commitDoc({ ...doc, objects: [...doc.objects, duplicated] });
    setSelectedObjectId(duplicated.id);
  };

  const onDelete = () => {
    if (!selected) return;
    commitDoc({ ...doc, objects: doc.objects.filter((entry) => entry.id !== selected.id) });
    setSelectedObjectId(null);
  };

  const onBringForward = () => {
    if (!selected || !("zIndex" in selected)) return;
    const maxZ = Math.max(...doc.objects.map((o) => ("zIndex" in o ? o.zIndex : 0)), 0);
    commitDoc({ ...doc, objects: doc.objects.map((entry) => (entry.id === selected.id ? ({ ...entry, zIndex: maxZ + 1 } as PlacementObject) : entry)) });
  };

  const onSendBackward = () => {
    if (!selected || !("zIndex" in selected)) return;
    const minZ = Math.min(...doc.objects.map((o) => ("zIndex" in o ? o.zIndex : 0)), 0);
    commitDoc({ ...doc, objects: doc.objects.map((entry) => (entry.id === selected.id ? ({ ...entry, zIndex: minZ - 1 } as PlacementObject) : entry)) });
  };

  const onUploadArtwork = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const form = new FormData();
      form.append("designJobId", designJobId);
      form.append("file", file);
      const res = await fetch("/api/assets", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Upload failed");
      setStatusMessage(`Uploaded ${json.data.originalName ?? file.name}`);
      await refreshAssets();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      event.target.value = "";
    }
  };

  const onAddAssetToCanvas = (asset: ApiAsset) => {
    try {
      const imageObj = buildDefaultImagePlacement({ assetId: asset.id, widthPx: asset.widthPx, heightPx: asset.heightPx, canvas: doc.canvas });
      commitDoc({ ...doc, objects: [...doc.objects, imageObj] });
      setSelectedObjectId(imageObj.id);
      setStatusMessage(`Added ${asset.originalName ?? asset.id} to canvas`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not add image");
    }
  };

  const onConvertToOutline = async () => {
    if (!selected) return;
    const res = await fetch("/api/text/outline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placement: doc, objectId: selected.id, toleranceMm: 0.05 }) });
    const json = await res.json();
    if (!res.ok) return setStatusMessage(json?.error?.message || "Outline conversion failed");
    commitDoc({ ...doc, objects: [...doc.objects, json.data.derivedVectorObject as PlacementObject] });
    setStatusMessage(["Outline generated", ...((json.data?.warnings as string[] | undefined) ?? [])].join(" | "));
  };

  const runPreflight = async () => { setRunningPreflight(true); setStatusMessage(null); try { const res = await fetch(`/api/design-jobs/${designJobId}/preflight`, { method: "POST" }); const json = await res.json(); if (!res.ok) throw new Error(json?.error?.message || "Preflight failed"); setPreflight(json.data as PreflightResult); setStatusMessage("Preflight completed."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Unknown preflight error"); } finally { setRunningPreflight(false); } };
  const exportJob = async () => { setExporting(true); try { const res = await fetch(`/api/design-jobs/${designJobId}/export`, { method: "POST" }); const json = await res.json(); if (!res.ok) throw new Error(json?.error?.message || "Export failed"); setExportPayload(json.data as ExportPayload); setStatusMessage("Export package generated."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Unknown export error"); } finally { setExporting(false); } };
  const exportBatch = async () => { setExporting(true); try { const jobIds = batchIds.split(",").map((e) => e.trim()).filter(Boolean); const res = await fetch("/api/design-jobs/export-batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designJobIds: jobIds }) }); const json = await res.json(); if (!res.ok) throw new Error(json?.error?.message || "Batch export failed"); setStatusMessage(`Batch exported ${json.data.count} jobs.`); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Unknown batch export error"); } finally { setExporting(false); } };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">Placement & Text Tools (mm)</h2>
      <p className="min-h-5 text-xs text-slate-600" aria-live="polite">{autosave.statusMessage}</p>
      <p className="text-xs text-slate-600">Source of truth is the unwrapped 2D document.</p>
      {autosave.hasRecoveredDraft ? <div className="flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><span>Recovered unsaved local edits.</span><button className="rounded border border-amber-400 px-2 py-1" onClick={autosave.useLocalDraft}>Use Local Draft</button><button className="rounded border border-amber-400 px-2 py-1" onClick={autosave.useServerVersion}>Use Server Version</button></div> : null}
      <div className="flex flex-wrap gap-2">
        <button className="rounded border px-2 py-1 text-sm" onClick={() => addText("text_line")}>Add Text Line</button>
        <button className="rounded border px-2 py-1 text-sm" onClick={() => addText("text_block")}>Add Text Block</button>
        <button className="rounded border px-2 py-1 text-sm" onClick={() => addText("text_arc")}>Add Curved Text</button>
        <button className="rounded border px-2 py-1 text-sm disabled:opacity-50" disabled={undoStack.length === 0} onClick={() => { const prev = undoStack[undoStack.length - 1]; if (!prev) return; setRedoStack((stack) => [doc, ...stack]); setUndoStack((stack) => stack.slice(0, -1)); setDoc(prev); }}>Undo</button>
        <button className="rounded border px-2 py-1 text-sm disabled:opacity-50" disabled={redoStack.length === 0} onClick={() => { const next = redoStack[0]; if (!next) return; setUndoStack((stack) => [...stack, doc]); setRedoStack((stack) => stack.slice(1)); setDoc(next); }}>Redo</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <section className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold">Artwork Assets</h3>
            <label className="block text-sm"><span>Upload Artwork</span><input type="file" accept=".svg,.png,.jpg,.jpeg,.webp" className="mt-1 block w-full text-xs" onChange={onUploadArtwork} /></label>
            <div className="max-h-44 space-y-2 overflow-auto">{assets.map((asset) => <div key={asset.id} className="flex items-center justify-between gap-2 rounded border bg-white p-2 text-xs"><div><p className="font-medium">{asset.originalName ?? asset.id}</p><p className="text-slate-600">{asset.widthPx ?? "?"}×{asset.heightPx ?? "?"} px</p></div><button className="rounded border px-2 py-1" onClick={() => onAddAssetToCanvas(asset)}>Add to Canvas</button></div>)}{assets.length === 0 ? <p className="text-xs text-slate-600">No artwork uploaded for this job yet.</p> : null}</div>
          </section>

          {isTextObject(selected) ? (
            <section className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">Content<textarea value={selected.content} onChange={(e) => updateSelectedText((obj) => ({ ...obj, content: e.target.value }))} className="w-full rounded border px-2 py-1" rows={3} /></label>
              <label className="text-sm">Font<select value={selected.fontFamily} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontFamily: e.target.value }))} className="w-full rounded border px-2 py-1">{curatedFonts.map((font) => <option key={font}>{font}</option>)}</select></label>
              <label className="text-sm">Font Size (mm)<input type="number" step="0.1" value={selected.fontSizeMm} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontSizeMm: Number(e.target.value) }))} className="w-full rounded border px-2 py-1" /></label>
              <label className="text-sm">Letter Spacing (mm)<input type="number" step="0.1" value={selected.letterSpacingMm} onChange={(e) => updateSelectedText((obj) => ({ ...obj, letterSpacingMm: Number(e.target.value) }))} className="w-full rounded border px-2 py-1" /></label>
              <label className="text-sm">Line Height<input type="number" step="0.1" value={selected.lineHeight} onChange={(e) => updateSelectedText((obj) => ({ ...obj, lineHeight: Number(e.target.value) }))} className="w-full rounded border px-2 py-1" /></label>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2 text-sm"><label><input type="checkbox" checked={selected.fontWeight >= 700} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontWeight: e.target.checked ? 700 : 400 }))} /> Bold</label><label><input type="checkbox" checked={selected.fontStyle === "italic"} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontStyle: e.target.checked ? "italic" : "normal" }))} /> Italic</label><label><input type="checkbox" checked={selected.allCaps} onChange={(e) => updateSelectedText((obj) => ({ ...obj, allCaps: e.target.checked }))} /> All caps</label><label><input type="checkbox" checked={selected.mirrorX} onChange={(e) => updateSelectedText((obj) => ({ ...obj, mirrorX: e.target.checked }))} /> Mirror X</label><label><input type="checkbox" checked={selected.mirrorY} onChange={(e) => updateSelectedText((obj) => ({ ...obj, mirrorY: e.target.checked }))} /> Mirror Y</label></div>
              {selected.kind === "text_arc" ? <><label className="text-sm">Arc Radius (mm)<input type="number" step="0.1" value={selected.arc.radiusMm} onChange={(e) => updateSelectedText((obj) => obj.kind === "text_arc" ? { ...obj, arc: { ...obj.arc, radiusMm: Number(e.target.value) } } : obj)} className="w-full rounded border px-2 py-1" /></label><label className="text-sm">Arc Start Angle (deg)<input type="number" step="0.1" value={selected.arc.startAngleDeg} onChange={(e) => updateSelectedText((obj) => obj.kind === "text_arc" ? { ...obj, arc: { ...obj.arc, startAngleDeg: Number(e.target.value) } } : obj)} className="w-full rounded border px-2 py-1" /></label></> : null}
              <button onClick={onConvertToOutline} className="rounded bg-slate-900 px-3 py-2 text-sm text-white sm:col-span-2">Convert to Outline</button>
            </section>
          ) : null}

          {selectedWarnings.length > 0 ? <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">{selectedWarnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul> : null}

          <section className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">Export Pack</h3><span className={`rounded-full px-2 py-0.5 text-xs ${preflight?.status === "pass" ? "bg-emerald-100 text-emerald-700" : preflight?.status === "warn" ? "bg-amber-100 text-amber-700" : preflight?.status === "fail" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-700"}`}>{preflight?.status ?? "not-run"}</span></div>
            <div className="flex flex-wrap gap-2"><button className="rounded border px-2 py-1 text-xs" onClick={() => void runPreflight()} disabled={isRunningPreflight}>{isRunningPreflight ? "Running..." : "Run Preflight"}</button><button className="rounded bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => void exportJob()} disabled={isExporting}>{isExporting ? "Exporting..." : "Export Job"}</button></div>
            <label className="block text-xs">Batch Job IDs (comma separated)<input value={batchIds} onChange={(event) => setBatchIds(event.target.value)} placeholder="job_a,job_b" className="mt-1 w-full rounded border px-2 py-1" /></label>
            <button className="rounded border px-2 py-1 text-xs" onClick={() => void exportBatch()} disabled={isExporting}>Export Selected Jobs</button>
            {(groupedIssues.error.length + groupedIssues.warning.length + groupedIssues.info.length) > 0 ? <div className="space-y-2 text-xs">{["error", "warning", "info"].map((severity) => <div key={severity}><p className="font-medium uppercase">{severity}</p><ul className="list-disc pl-4">{groupedIssues[severity as keyof typeof groupedIssues].map((issue) => <li key={`${issue.code}-${issue.objectId ?? issue.message}`}>{issue.message}{issue.objectId ? ` (${issue.objectId})` : ""}</li>)}</ul></div>)}</div> : null}
            {exportPayload ? <div className="space-y-2"><label className="block text-xs">Manifest JSON<textarea readOnly value={JSON.stringify(exportPayload.manifest, null, 2)} className="mt-1 h-28 w-full rounded border px-2 py-1 font-mono" /></label><label className="block text-xs">SVG<textarea readOnly value={exportPayload.svg} className="mt-1 h-24 w-full rounded border px-2 py-1 font-mono" /></label><div className="flex gap-2"><button className="rounded border px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(JSON.stringify(exportPayload.manifest, null, 2))}>Copy Manifest</button><button className="rounded border px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(exportPayload.svg)}>Copy SVG</button></div></div> : null}
          </section>
          <pre className="max-h-72 overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(doc ?? createDefaultPlacementDocument(), null, 2)}</pre>
        </div>

        <InspectorPanel
          doc={doc}
          selected={selected}
          selectedObjectId={selectedObjectId}
          transformValues={transformValues}
          validationErrors={transformErrors}
          onSelectedObjectChange={setSelectedObjectId}
          onTransformChange={onTransformChange}
          onBlurTransformField={onBlurTransformField}
          onToggleAspectRatio={onToggleAspectRatio}
          onResetRotation={onResetRotation}
          onCenterOnCanvas={onCenterOnCanvas}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onBringForward={onBringForward}
          onSendBackward={onSendBackward}
          onUpdateOpacity={(opacity) => isImageObject(selected) ? updateSelectedImage({ opacity }) : undefined}
          onToggleLock={() => selected ? setLockedObjectIds((prev) => { const next = new Set(prev); next.has(selected.id) ? next.delete(selected.id) : next.add(selected.id); return next; }) : undefined}
          onToggleHide={() => selected ? setHiddenObjectIds((prev) => { const next = new Set(prev); next.has(selected.id) ? next.delete(selected.id) : next.add(selected.id); return next; }) : undefined}
          onUpdateBlendMode={(blendMode) => selected ? setBlendModeByObjectId((prev) => ({ ...prev, [selected.id]: blendMode })) : undefined}
          hiddenObjectIds={hiddenObjectIds}
          lockedObjectIds={lockedObjectIds}
          blendModeByObjectId={blendModeByObjectId}
        />
      </div>
      <p className="min-h-5 text-xs text-slate-700">{statusMessage}</p>
    </section>
  );
}
