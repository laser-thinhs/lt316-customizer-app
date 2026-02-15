"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PlacementDocument,
  PlacementObject,
  TextObject,
  createDefaultPlacementDocument,
  placementDocumentSchema
} from "@/schemas/placement";
import { clampTextPlacementToZone, validateTextPlacement } from "@/lib/geometry/textLayout";

type Props = {
  designJobId: string;
  placement: PlacementDocument;
  onUpdated: (placement: PlacementDocument) => void;
};

const curatedFonts = ["Inter", "Roboto Mono"];

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isTextObject(object: PlacementObject | null): object is TextObject {
  return Boolean(object && (object.kind === "text_line" || object.kind === "text_block" || object.kind === "text_arc"));
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

export default function PlacementEditor({ designJobId, placement, onUpdated }: Props) {
  const [doc, setDoc] = useState<PlacementDocument>(placementDocumentSchema.parse(placement));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(doc.objects[0]?.id ?? null);
  const [undoStack, setUndoStack] = useState<PlacementDocument[]>([]);
  const [redoStack, setRedoStack] = useState<PlacementDocument[]>([]);

  const selected = useMemo(
    () => doc.objects.find((entry) => entry.id === selectedObjectId) ?? null,
    [doc.objects, selectedObjectId]
  );

  const selectedWarnings = useMemo(() => {
    if (!isTextObject(selected)) return [];
    return validateTextPlacement({
      object: selected,
      zone: doc.canvas,
      strokeWidthWarningThresholdMm: doc.machine.strokeWidthWarningThresholdMm
    });
  }, [selected, doc.canvas, doc.machine.strokeWidthWarningThresholdMm]);

  const commitDoc = (next: PlacementDocument) => {
    setUndoStack((prev) => [...prev.slice(-29), doc]);
    setRedoStack([]);
    setDoc(next);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/design-jobs/${designJobId}/placement`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placementJson: doc })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || "Failed to save placement");
        onUpdated(json.data.placementJson as PlacementDocument);
        setStatusMessage("Autosaved");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setSaving(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [designJobId, doc, onUpdated]);

  const addText = (kind: TextObject["kind"]) => {
    const obj = createTextObject(kind);
    const clamped = clampTextPlacementToZone(obj, doc.canvas);
    commitDoc({ ...doc, objects: [...doc.objects, clamped] });
    setSelectedObjectId(clamped.id);
  };

  const updateSelectedText = (updater: (object: TextObject) => TextObject) => {
    if (!isTextObject(selected)) return;
    const next = updater(selected);
    commitDoc({ ...doc, objects: doc.objects.map((entry) => (entry.id === selected.id ? next : entry)) });
  };

  const onConvertToOutline = async () => {
    if (!selected) return;
    const res = await fetch("/api/text/outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placement: doc, objectId: selected.id, toleranceMm: 0.05 })
    });
    const json = await res.json();
    if (!res.ok) {
      setStatusMessage(json?.error?.message || "Outline conversion failed");
      return;
    }

    commitDoc({ ...doc, objects: [...doc.objects, json.data.derivedVectorObject as PlacementObject] });
    setStatusMessage(["Outline generated", ...(json.data.warnings as string[])].join(" | "));
  };

  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{/* UI unchanged */}
      <h2 className="text-base font-semibold">Placement & Text Tools (mm)</h2>
      <p className="text-xs text-slate-600">Source of truth is the unwrapped 2D document.</p>
      <div className="flex flex-wrap gap-2">
        <button className="rounded border px-2 py-1 text-sm" onClick={() => addText("text_line")}>Add Text Line</button>
        <button className="rounded border px-2 py-1 text-sm" onClick={() => addText("text_block")}>Add Text Block</button>
        <button className="rounded border px-2 py-1 text-sm" onClick={() => addText("text_arc")}>Add Curved Text</button>
        <button className="rounded border px-2 py-1 text-sm disabled:opacity-50" disabled={undoStack.length === 0} onClick={() => {
          const prev = undoStack[undoStack.length - 1]; if (!prev) return; setRedoStack((stack) => [doc, ...stack]); setUndoStack((stack) => stack.slice(0, -1)); setDoc(prev);
        }}>Undo</button>
        <button className="rounded border px-2 py-1 text-sm disabled:opacity-50" disabled={redoStack.length === 0} onClick={() => {
          const next = redoStack[0]; if (!next) return; setUndoStack((stack) => [...stack, doc]); setRedoStack((stack) => stack.slice(1)); setDoc(next);
        }}>Redo</button>
      </div>
      <label className="block text-sm"><span>Selected Object</span><select value={selectedObjectId ?? ""} onChange={(event) => setSelectedObjectId(event.target.value || null)} className="w-full rounded border px-2 py-1"><option value="">None</option>{doc.objects.map((entry) => (<option key={entry.id} value={entry.id}>{entry.kind}:{entry.id.slice(0, 8)}</option>))}</select></label>
      {isTextObject(selected) ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-sm">Content<textarea value={selected.content} onChange={(event) => updateSelectedText((obj) => ({ ...obj, content: event.target.value }))} className="w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Font<select value={selected.fontFamily} onChange={(event) => updateSelectedText((obj) => ({ ...obj, fontFamily: event.target.value }))} className="w-full rounded border px-2 py-1">{curatedFonts.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
          <label className="text-sm">Font Size (mm)<input type="number" step="0.1" value={selected.fontSizeMm} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontSizeMm: Number(e.target.value) }))} className="w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Letter Spacing (mm)<input type="number" step="0.1" value={selected.letterSpacingMm} onChange={(e) => updateSelectedText((obj) => ({ ...obj, letterSpacingMm: Number(e.target.value) }))} className="w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Line Height<input type="number" step="0.1" value={selected.lineHeight} onChange={(e) => updateSelectedText((obj) => ({ ...obj, lineHeight: Number(e.target.value) }))} className="w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Box Width (mm)<input type="number" step="0.1" value={selected.boxWidthMm} onChange={(e) => updateSelectedText((obj) => ({ ...obj, boxWidthMm: Number(e.target.value) }))} className="w-full rounded border px-2 py-1" /></label>
          <div className="flex items-center gap-2 text-sm"><label><input type="checkbox" checked={selected.fontWeight >= 700} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontWeight: e.target.checked ? 700 : 400 }))} /> Bold</label><label><input type="checkbox" checked={selected.fontStyle === "italic"} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontStyle: e.target.checked ? "italic" : "normal" }))} /> Italic</label><label><input type="checkbox" checked={selected.allCaps} onChange={(e) => updateSelectedText((obj) => ({ ...obj, allCaps: e.target.checked }))} /> All caps</label><label><input type="checkbox" checked={selected.mirrorX} onChange={(e) => updateSelectedText((obj) => ({ ...obj, mirrorX: e.target.checked }))} /> Mirror X</label><label><input type="checkbox" checked={selected.mirrorY} onChange={(e) => updateSelectedText((obj) => ({ ...obj, mirrorY: e.target.checked }))} /> Mirror Y</label></div>
          {selected.kind === "text_arc" && <><label className="text-sm">Arc Radius (mm)<input type="number" step="0.1" value={selected.arc.radiusMm} onChange={(e) => updateSelectedText((obj) => obj.kind === "text_arc" ? { ...obj, arc: { ...obj.arc, radiusMm: Number(e.target.value) } } : obj)} className="w-full rounded border px-2 py-1" /></label><label className="text-sm">Arc Start Angle<input type="number" step="0.1" value={selected.arc.startAngleDeg} onChange={(e) => updateSelectedText((obj) => obj.kind === "text_arc" ? { ...obj, arc: { ...obj.arc, startAngleDeg: Number(e.target.value) } } : obj)} className="w-full rounded border px-2 py-1" /></label></>}
          <button onClick={onConvertToOutline} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Convert to Outline</button>
        </div> : null}
      {selectedWarnings.length > 0 ? <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">{selectedWarnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul> : null}
      <pre className="max-h-72 overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(doc ?? createDefaultPlacementDocument(), null, 2)}</pre>
      <p className="text-xs text-slate-700">{isSaving ? "Saving..." : statusMessage}</p>
    </section>;
}
