"use client";

import { ChangeEvent, DragEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ImagePlacementObject,
  PlacementDocument,
  PlacementObject,
  TextObject,
  createDefaultPlacementDocument,
  placementDocumentSchema
} from "@/schemas/placement";
import { clampTextPlacementToZone, validateTextPlacement } from "@/lib/geometry/textLayout";
import type { JobAssetExportResponse, PreflightResult } from "@/schemas/preflight-export";
import { buildDefaultImagePlacement } from "@/lib/placement/image-insertion";
import { useAutosavePlacement } from "@/hooks/useAutosavePlacement";
import { arePlacementsEqual } from "@/lib/placement/stableCompare";
import InspectorPanel from "@/components/editor/InspectorPanel";
import WrapCanvas, { WrapCanvasObject } from "@/components/editor/WrapCanvas";

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

const TumblerPreview3D = dynamic(() => import("@/components/editor/TumblerPreview3D"), {
  ssr: false
});

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
    content: "Edit text here...",
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
    visible: true,
    locked: false,
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
const FIXED_CANVAS_MM = 300;

function withFixedCanvasSize(document: PlacementDocument): PlacementDocument {
  return {
    ...document,
    canvas: {
      ...document.canvas,
      widthMm: FIXED_CANVAS_MM,
      heightMm: FIXED_CANVAS_MM
    }
  };
}

function normalizeObjectOrder(objects: PlacementObject[]): PlacementObject[] {
  return objects.map((object, index) => ({ ...object, zIndex: index }));
}

function objectIcon(kind: PlacementObject["kind"]) {
  if (kind === "image") return "≡ƒû╝∩╕Å";
  if (kind === "vector") return "Γ¼í";
  return "T";
}

function defaultLayerName(object: PlacementObject, index: number) {
  return object.layerName ?? `${object.kind.replace("_", " ")} ${index + 1}`;
}

export default function PlacementEditor({ designJobId, placement, onUpdated }: Props) {
  const initialDoc = withFixedCanvasSize(placementDocumentSchema.parse(placement));
  const [doc, setDoc] = useState<PlacementDocument>(initialDoc);
  const [assets, setAssets] = useState<ApiAsset[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [serverDoc, setServerDoc] = useState<PlacementDocument>(initialDoc);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(doc.objects[0]?.id ?? null);
  const [undoStack, setUndoStack] = useState<PlacementDocument[]>([]);
  const [redoStack, setRedoStack] = useState<PlacementDocument[]>([]);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [exportResult, setExportResult] = useState<JobAssetExportResponse | null>(null);
  const [batchIds, setBatchIds] = useState("");
  const [isRunningPreflight, setRunningPreflight] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const [isAssetPickerOpen, setAssetPickerOpen] = useState(false);
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [transformValues, setTransformValues] = useState<TransformValues>(defaultTransformValues);
  const [transformErrors, setTransformErrors] = useState<{ field: TransformField; message: string }[]>([]);
  const [hiddenObjectIds, setHiddenObjectIds] = useState<Set<string>>(new Set());
  const [lockedObjectIds, setLockedObjectIds] = useState<Set<string>>(new Set());
  const [blendModeByObjectId, setBlendModeByObjectId] = useState<Record<string, string>>({});
  const [canvasDpi, setCanvasDpi] = useState(96);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSpacingMm, setGridSpacingMm] = useState<5 | 10>(5);
  const [showCenterlines, setShowCenterlines] = useState(true);
  const [showSafeMargin, setShowSafeMargin] = useState(true);
  const [keepAspectResize, setKeepAspectResize] = useState(true);
  const [isArtworkDragging, setArtworkDragging] = useState(false);
  const [isUploadingArtwork, setUploadingArtwork] = useState(false);
  const [selectedArtworkFile, setSelectedArtworkFile] = useState<{ name: string; size: number } | null>(null);
  const [artworkUploadError, setArtworkUploadError] = useState<string | null>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);
  const textContentInputRef = useRef<HTMLTextAreaElement>(null);
  const shouldFocusTextInputRef = useRef(false);
  const canRender3DPreview = process.env.NODE_ENV !== "test";

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatAssetDate = (createdAt: string) => {
    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString();
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setStatusMessage(`${label} copied to clipboard.`);
    } catch {
      setStatusMessage(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

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

  const canvasObjects = useMemo<WrapCanvasObject[]>(() => {
    return doc.objects.map((entry) => {
      if (entry.kind === "image") {
        return {
          id: entry.id,
          kind: entry.kind,
          xMm: entry.xMm,
          yMm: entry.yMm,
          widthMm: entry.widthMm,
          heightMm: entry.heightMm,
          rotationDeg: entry.rotationDeg,
          assetHref: `/api/assets/${entry.assetId}`,
          label: "image"
        };
      }

      return {
        id: entry.id,
        kind: entry.kind,
        xMm: entry.offsetXMm,
        yMm: entry.offsetYMm,
        widthMm: entry.boxWidthMm,
        heightMm: entry.boxHeightMm,
        rotationDeg: entry.rotationDeg,
        label: entry.kind
      };
    });
  }, [doc.objects]);

  const previewDesignParams = useMemo(() => {
    const previewImage = isImageObject(selected)
      ? selected
      : doc.objects.find((entry): entry is ImagePlacementObject => entry.kind === "image");

    if (!previewImage) {
      return null;
    }

    return {
      assetUrl: `/api/assets/${previewImage.assetId}`,
      xMm: previewImage.xMm,
      yMm: previewImage.yMm,
      widthMm: previewImage.widthMm,
      heightMm: previewImage.heightMm,
      rotationDeg: previewImage.rotationDeg,
      opacity: previewImage.opacity,
      mmScale: 3
    };
  }, [doc.objects, selected]);

  const previewAssetUrl = previewDesignParams?.assetUrl ?? "";

  const commitDoc = (next: PlacementDocument) => {
    setUndoStack((prev) => [...prev.slice(-29), doc]);
    setRedoStack([]);
    const normalized = withFixedCanvasSize(next);
    setDoc({ ...normalized, objects: normalizeObjectOrder(normalized.objects) });
  };

  const refreshAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/design-jobs/${designJobId}/assets`);
      if (!res || typeof res.json !== "function") return setAssets([]);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load assets");
      setAssets(Array.isArray(json.data) ? (json.data as ApiAsset[]) : []);
    } catch {
      setAssets([]);
    }
  }, [designJobId]);

  useEffect(() => {
    void refreshAssets();
  }, [refreshAssets]);

  const handleRecoveredPlacement = useCallback((localDraft: PlacementDocument) => setDoc(withFixedCanvasSize(localDraft)), []);
  const handleSavedPlacement = useCallback((savedDoc: PlacementDocument) => {
    const normalizedSavedDoc = withFixedCanvasSize(savedDoc);
    if (!arePlacementsEqual(doc, normalizedSavedDoc)) setDoc(normalizedSavedDoc);
    setServerDoc(normalizedSavedDoc);
    onUpdated(normalizedSavedDoc);
  }, [doc, onUpdated]);

  const autosave = useAutosavePlacement({ designJobId, placement: doc, serverPlacement: serverDoc, onPlacementRecovered: handleRecoveredPlacement, onPlacementSaved: handleSavedPlacement });

  const addText = (kind: TextObject["kind"]) => {
    const obj = createTextObject(kind);
    const clamped = clampTextPlacementToZone({
      ...obj,
      layerName: `${kind.replace("_", " ")} ${doc.objects.length + 1}`,
      zIndex: doc.objects.length
    }, doc.canvas);
    commitDoc({ ...doc, objects: [...doc.objects, clamped] });
    shouldFocusTextInputRef.current = true;
    setSelectedObjectId(clamped.id);
  };

  useEffect(() => {
    if (!shouldFocusTextInputRef.current) return;
    if (!isTextObject(selected)) return;
    if (!textContentInputRef.current) return;
    textContentInputRef.current.focus();
    textContentInputRef.current.select();
    shouldFocusTextInputRef.current = false;
  }, [selected]);

  const updateSelectedText = (updater: (object: TextObject) => TextObject) => {
    if (!isTextObject(selected) || selected.locked) return;
    if (!isTextObject(selected) || lockedObjectIds.has(selected.id)) return;
    const next = updater(selected);
    commitDoc({ ...doc, objects: doc.objects.map((entry) => (entry.id === selected.id ? next : entry)) });
  };

  const updateSelectedImage = (patch: Partial<ImagePlacementObject>) => {
    if (!isImageObject(selected) || selected.locked) return;
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

  const parseTransformValue = (
    field: TransformField
  ): { ok: true; value: number } | { ok: false; message: string } => {
    const value = Number(transformValues[field]);
    if (!Number.isFinite(value)) {
      return { ok: false, message: "Value must be a finite number." };
    }
    if ((field === "widthMm" || field === "heightMm") && value <= 0) {
      return { ok: false, message: "Value must be greater than 0." };
    }
    return { ok: true, value };
  };

  const onTransformChange = (field: TransformField, value: string) => {
    setTransformValues((prev) => ({ ...prev, [field]: value }));
  };

  const onBlurTransformField = (field: TransformField) => {
    if (!selected || lockedObjectIds.has(selected.id)) return;
    const parsed = parseTransformValue(field);
    if (!parsed.ok) {
      setTransformErrors((prev) => [
        ...prev.filter((entry) => entry.field !== field),
        { field, message: parsed.message }
      ]);
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

  const updateObjectTransform = (id: string, patch: { xMm: number; yMm: number; widthMm: number; heightMm: number }) => {
    commitDoc({
      ...doc,
      objects: doc.objects.map((entry) => {
        if (entry.id !== id) return entry;
        if (entry.kind === "image") {
          return {
            ...entry,
            xMm: roundToHundredth(patch.xMm),
            yMm: roundToHundredth(patch.yMm),
            widthMm: Math.max(0.01, roundToHundredth(patch.widthMm)),
            heightMm: Math.max(0.01, roundToHundredth(patch.heightMm))
          };
        }

        return {
          ...entry,
          offsetXMm: roundToHundredth(patch.xMm),
          offsetYMm: roundToHundredth(patch.yMm),
          boxWidthMm: Math.max(0.01, roundToHundredth(patch.widthMm)),
          boxHeightMm: Math.max(0.01, roundToHundredth(patch.heightMm))
        };
      })
    });
  };

  const uploadArtworkFile = async (file: File) => {
    setArtworkUploadError(null);
    setSelectedArtworkFile({ name: file.name, size: file.size });
    setUploadingArtwork(true);
    try {
      const form = new FormData();
      form.append("designJobId", designJobId);
      form.append("file", file);
      const res = await fetch("/api/assets", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Upload failed");
      setStatusMessage(`Uploaded ${json.data.originalName ?? file.name}`);
      setSelectedArtworkFile(null);
      await refreshAssets();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setArtworkUploadError(message);
      setStatusMessage(message);
    }
  };

  const onUploadArtwork = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await uploadArtworkFile(file);
    } finally {
      setUploadingArtwork(false);
      event.target.value = "";
    }
  };

  const onArtworkDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setArtworkDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    try {
      await uploadArtworkFile(file);
    } finally {
      setUploadingArtwork(false);
    }
  };

  const onArtworkDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    artworkInputRef.current?.click();
  };

  const clearSelectedArtworkFile = () => {
    setSelectedArtworkFile(null);
    setArtworkUploadError(null);
    if (artworkInputRef.current) artworkInputRef.current.value = "";
  };

  const onAddAssetToCanvas = (asset: ApiAsset) => {
    try {
      const imageObj: ImagePlacementObject = {
        ...buildDefaultImagePlacement({
          assetId: asset.id,
          widthPx: asset.widthPx,
          heightPx: asset.heightPx,
          canvas: doc.canvas
        }),
        visible: true,
        locked: false,
        zIndex: doc.objects.length,
        layerName: asset.originalName ?? undefined
      };
      commitDoc({ ...doc, objects: [...doc.objects, imageObj] });
      setSelectedObjectId(imageObj.id);
      setStatusMessage(`Added ${asset.originalName ?? asset.id} to canvas`);
      setAssetPickerOpen(false);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not add image");
    }
  };

  const renderArtworkAssetsSection = () => (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-black">Artwork Assets</h3>
        <p className="text-xs text-black">Upload your artwork for this job. Supported: SVG, PNG, JPG.</p>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload artwork by choosing a file or dragging and dropping it here"
        className={`space-y-3 rounded-lg border border-dashed p-4 transition ${isArtworkDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400`}
        onKeyDown={onArtworkDropzoneKeyDown}
        onClick={() => artworkInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setArtworkDragging(true);
        }}
        onDragLeave={() => setArtworkDragging(false)}
        onDrop={onArtworkDrop}
      >
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 text-base">⇪</span>
          <div className="space-y-1 text-xs text-black">
            <p className="font-medium text-black">{selectedArtworkFile ? selectedArtworkFile.name : "No artwork uploaded yet."}</p>
            <p className="text-black">{selectedArtworkFile ? `${formatBytes(selectedArtworkFile.size)} selected` : "Drag & drop a file here, or choose a file."}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            onClick={(event) => {
              event.stopPropagation();
              artworkInputRef.current?.click();
            }}
          >
            Choose file
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!selectedArtworkFile || isUploadingArtwork}
            onClick={(event) => {
              event.stopPropagation();
              clearSelectedArtworkFile();
            }}
          >
            Clear
          </button>
          <p className="text-xs text-black">Size limits apply.</p>
        </div>
        <input
          ref={artworkInputRef}
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp"
          className="sr-only"
          onChange={onUploadArtwork}
        />
      </div>
      {isUploadingArtwork ? <p className="text-xs text-black">Uploading…</p> : null}
      {artworkUploadError ? <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">{artworkUploadError}</p> : null}
      <div className="max-h-52 space-y-2 overflow-auto pr-1">
        {assets.map((asset) => {
          const uploadedLabel = formatAssetDate(asset.createdAt);
          return (
            <div key={asset.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm">
              <div>
                <p className="font-medium text-black">{asset.originalName ?? asset.id}</p>
                <p className="text-black">{asset.widthPx ?? "?"}×{asset.heightPx ?? "?"} px</p>
                {uploadedLabel ? <p className="text-black">Uploaded {uploadedLabel}</p> : null}
              </div>
              <button className="rounded-md border border-slate-300 px-2 py-1 font-medium text-black transition hover:bg-slate-50" onClick={() => onAddAssetToCanvas(asset)}>Add to Canvas</button>
            </div>
          );
        })}
        {assets.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-black">
            <p className="font-medium text-black">No artwork uploaded yet.</p>
            <p className="mt-1">Drag & drop a file here, or choose a file.</p>
          </div>
        ) : null}
      </div>
    </section>
  );

  const patchLayer = (id: string, patch: Partial<PlacementObject>) => {
    commitDoc({
      ...doc,
      objects: doc.objects.map((entry) => (entry.id === id ? ({ ...entry, ...patch } as PlacementObject) : entry))
    });
  };

  const duplicateSelectedLayer = () => {
    if (!selected) return;
    const copy = {
      ...selected,
      id: `${selected.kind}-${randomId()}`,
      layerName: `${selected.layerName ?? selected.kind} copy`,
      zIndex: doc.objects.length
    };
    commitDoc({ ...doc, objects: [...doc.objects, copy] });
    setSelectedObjectId(copy.id);
  };

  const deleteSelectedLayer = () => {
    if (!selected) return;
    const remaining = doc.objects.filter((entry) => entry.id !== selected.id);
    commitDoc({ ...doc, objects: remaining });
    setSelectedObjectId(remaining[0]?.id ?? null);
  };

  const handleUndo = () => {
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    setRedoStack((stack) => [doc, ...stack]);
    setUndoStack((stack) => stack.slice(0, -1));
    setDoc(prev);
  };

  const handleRedo = () => {
    const next = redoStack[0];
    if (!next) return;
    setUndoStack((stack) => [...stack, doc]);
    setRedoStack((stack) => stack.slice(1));
    setDoc(next);
  };

  const exportJob = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/jobs/${designJobId}/export`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Export failed");
      setExportResult(json.data as JobAssetExportResponse);
      setStatusMessage("Export package generated and ready to download.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unknown export error");
    } finally {
      setExporting(false);
    }
  };

  const onLayerDragStart = (event: DragEvent<HTMLDivElement>, id: string) => {
    event.dataTransfer.effectAllowed = "move";
    setDraggingLayerId(id);
  };

  const onLayerDrop = (targetId: string) => {
    if (!draggingLayerId || draggingLayerId === targetId) return;
    const sourceIndex = doc.objects.findIndex((entry) => entry.id === draggingLayerId);
    const targetIndex = doc.objects.findIndex((entry) => entry.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const reordered = [...doc.objects];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    commitDoc({ ...doc, objects: reordered });
    setDraggingLayerId(null);
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
  const exportBatch = async () => { setExporting(true); try { const jobIds = batchIds.split(",").map((e) => e.trim()).filter(Boolean); const res = await fetch("/api/design-jobs/export-batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designJobIds: jobIds }) }); const json = await res.json(); if (!res.ok) throw new Error(json?.error?.message || "Batch export failed"); setStatusMessage(`Batch exported ${json.data.count} jobs.`); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Unknown batch export error"); } finally { setExporting(false); } };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-black">
      <h2 className="text-base font-semibold">Placement & Text Tools (mm)</h2>
      <p className="min-h-5 text-xs text-black" aria-live="polite">{autosave.statusMessage}</p>
      <p className="text-xs text-black">Source of truth is the unwrapped 2D document.</p>
      {autosave.hasRecoveredDraft ? (
        <div className="flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-black">
          <span>Recovered unsaved local edits.</span>
          <button
            className="rounded border border-amber-400 px-2 py-1 hover:bg-amber-100"
            onClick={autosave.useLocalDraft}
          >
            Use Local Draft
          </button>
          <button
            className="rounded border border-amber-400 px-2 py-1 hover:bg-amber-100"
            onClick={autosave.useServerVersion}
          >
            Use Server Version
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
          onClick={() => addText("text_line")}
        >
          Add Text Line
        </button>
        <button
          className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
          onClick={() => addText("text_block")}
        >
          Add Text Block
        </button>
        <button
          className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
          onClick={() => addText("text_arc")}
        >
          Add Curved Text
        </button>
        <button
          className="rounded border px-2 py-1 text-sm disabled:opacity-50 hover:bg-slate-50"
          disabled={undoStack.length === 0}
          onClick={handleUndo}
        >
          Undo
        </button>
        <button
          className="rounded border px-2 py-1 text-sm disabled:opacity-50 hover:bg-slate-50"
          disabled={redoStack.length === 0}
          onClick={handleRedo}
        >
          Redo
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
          onClick={() => setAssetPickerOpen((open) => !open)}
        >
          Add Image from Assets
        </button>
        <button
          className="rounded border px-2 py-1 text-sm disabled:opacity-50 hover:enabled:bg-slate-50"
          disabled={!selected}
          onClick={duplicateSelectedLayer}
        >
          Duplicate Layer
        </button>
        <button
          className="rounded border px-2 py-1 text-sm disabled:opacity-50 hover:enabled:bg-slate-50"
          disabled={!selected}
          onClick={deleteSelectedLayer}
        >
          Delete Layer
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {renderArtworkAssetsSection()}

          {isTextObject(selected) ? (
            <section className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">Content<textarea ref={textContentInputRef} value={selected.content} onChange={(e) => updateSelectedText((obj) => ({ ...obj, content: e.target.value }))} className="w-full rounded border px-2 py-1" rows={3} /></label>
              <label className="text-sm">Font<select value={selected.fontFamily} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontFamily: e.target.value }))} className="w-full rounded border px-2 py-1">{curatedFonts.map((font) => <option key={font}>{font}</option>)}</select></label>
              <label className="text-sm">Font Size (mm)<input type="number" step="0.1" value={selected.fontSizeMm} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontSizeMm: Number(e.target.value) }))} className="w-full rounded border px-2 py-1" /></label>
              <label className="text-sm">Letter Spacing (mm)<input type="number" step="0.1" value={selected.letterSpacingMm} onChange={(e) => updateSelectedText((obj) => ({ ...obj, letterSpacingMm: Number(e.target.value) }))} className="w-full rounded border px-2 py-1" /></label>
              <label className="text-sm">Line Height<input type="number" step="0.1" value={selected.lineHeight} onChange={(e) => updateSelectedText((obj) => ({ ...obj, lineHeight: Number(e.target.value) }))} className="w-full rounded border px-2 py-1" /></label>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2 text-sm"><label><input type="checkbox" checked={selected.fontWeight >= 700} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontWeight: e.target.checked ? 700 : 400 }))} /> Bold</label><label><input type="checkbox" checked={selected.fontStyle === "italic"} onChange={(e) => updateSelectedText((obj) => ({ ...obj, fontStyle: e.target.checked ? "italic" : "normal" }))} /> Italic</label><label><input type="checkbox" checked={selected.allCaps} onChange={(e) => updateSelectedText((obj) => ({ ...obj, allCaps: e.target.checked }))} /> All caps</label><label><input type="checkbox" checked={selected.mirrorX} onChange={(e) => updateSelectedText((obj) => ({ ...obj, mirrorX: e.target.checked }))} /> Mirror X</label><label><input type="checkbox" checked={selected.mirrorY} onChange={(e) => updateSelectedText((obj) => ({ ...obj, mirrorY: e.target.checked }))} /> Mirror Y</label></div>
              {selected.kind === "text_arc" ? <><label className="text-sm">Arc Radius (mm)<input type="number" step="0.1" value={selected.arc.radiusMm} onChange={(e) => updateSelectedText((obj) => obj.kind === "text_arc" ? { ...obj, arc: { ...obj.arc, radiusMm: Number(e.target.value) } } : obj)} className="w-full rounded border px-2 py-1" /></label><label className="text-sm">Arc Start Angle (deg)<input type="number" step="0.1" value={selected.arc.startAngleDeg} onChange={(e) => updateSelectedText((obj) => obj.kind === "text_arc" ? { ...obj, arc: { ...obj.arc, startAngleDeg: Number(e.target.value) } } : obj)} className="w-full rounded border px-2 py-1" /></label></> : null}
              <button onClick={onConvertToOutline} className="rounded bg-slate-900 px-3 py-2 text-sm text-white sm:col-span-2">Convert to Outline</button>
            </section>
          ) : null}

          {selectedWarnings.length > 0 ? <ul className="list-disc space-y-1 pl-4 text-xs text-black">{selectedWarnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul> : null}

          <pre className="max-h-72 overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(doc ?? createDefaultPlacementDocument(), null, 2)}</pre>
      <section className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold">Layers</h3>
        <div className="max-h-52 space-y-1 overflow-auto">
          {doc.objects.map((entry, index) => (
            <div
              key={entry.id}
              draggable
              onDragStart={(event) => onLayerDragStart(event, entry.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onLayerDrop(entry.id)}
              className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded border bg-white px-2 py-1 text-xs ${selectedObjectId === entry.id ? "border-blue-500" : "border-slate-200"}`}
            >
              <button className="w-6" onClick={() => setSelectedObjectId(entry.id)}>{objectIcon(entry.kind)}</button>
              <input
                value={defaultLayerName(entry, index)}
                onChange={(event) => patchLayer(entry.id, { layerName: event.target.value })}
                onFocus={() => setSelectedObjectId(entry.id)}
                className="rounded border px-1 py-0.5"
              />
              <button className="rounded border px-1" onClick={() => patchLayer(entry.id, { visible: !(entry.visible ?? true) })}>{entry.visible === false ? "≡ƒÖê" : "≡ƒæü"}</button>
              <button className="rounded border px-1" onClick={() => patchLayer(entry.id, { locked: !(entry.locked ?? false) })}>{entry.locked ? "≡ƒöÆ" : "≡ƒöô"}</button>
            </div>
          ))}
          {doc.objects.length === 0 ? <p className="text-xs text-slate-600">No layers yet.</p> : null}
        </div>
      </section>

      {isAssetPickerOpen ? (
        renderArtworkAssetsSection()
      ) : null}

      <label className="block text-sm"><span>Selected Object</span><select value={selectedObjectId ?? ""} onChange={(event) => setSelectedObjectId(event.target.value || null)} className="w-full rounded border px-2 py-1"><option value="">None</option>{doc.objects.map((entry, index) => (<option key={entry.id} value={entry.id}>{defaultLayerName(entry, index)}</option>))}</select></label>

      {isImageObject(selected) && selected.locked ? <p className="text-xs text-black">Selected layer is locked.</p> : null}
      {isTextObject(selected) && selected.locked ? <p className="text-xs text-black">Selected layer is locked.</p> : null}

      <section className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Canvas Preview</h3>
          <label className="text-xs">DPI
            <input type="number" min={72} step={1} value={canvasDpi} onChange={(event) => setCanvasDpi(Math.max(72, Number(event.target.value) || 96))} className="ml-2 w-20 rounded border px-2 py-1" />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1"><input type="checkbox" checked={gridEnabled} onChange={(event) => setGridEnabled(event.target.checked)} /> Grid</label>
          <label className="flex items-center gap-1">Spacing
            <select value={gridSpacingMm} onChange={(event) => setGridSpacingMm(Number(event.target.value) === 10 ? 10 : 5)} className="rounded border px-1 py-0.5">
              <option value={5}>5mm</option>
              <option value={10}>10mm</option>
            </select>
          </label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={showCenterlines} onChange={(event) => setShowCenterlines(event.target.checked)} /> Centerlines</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={showSafeMargin} onChange={(event) => setShowSafeMargin(event.target.checked)} /> Safe margin</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={keepAspectResize} onChange={(event) => setKeepAspectResize(event.target.checked)} /> Keep aspect resize</label>
        </div>
        <WrapCanvas
          template={{ widthMm: 300, heightMm: 300, safeMarginMm: 2 }}
          objects={canvasObjects}
          selectedId={selectedObjectId}
          dpi={canvasDpi}
          gridEnabled={gridEnabled}
          gridSpacingMm={gridSpacingMm}
          showCenterlines={showCenterlines}
          showSafeMargin={showSafeMargin}
          keepAspectRatio={keepAspectResize}
          onSelect={setSelectedObjectId}
          onUpdateTransform={updateObjectTransform}
        />
        <p className="text-xs text-slate-600">Drag to move. Shift-drag locks axis. Arrow keys nudge 1mm (Shift = 5mm).</p>
      </section>

      {canRender3DPreview ? (
        <section className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold">3D Preview</h3>
          <div className="h-[420px] overflow-hidden rounded border border-slate-200 bg-slate-900">
            <TumblerPreview3D
              diameterMm={doc.canvas.widthMm / Math.PI}
              heightMm={doc.canvas.heightMm}
              designParams={previewDesignParams}
              designSvgUrl={previewAssetUrl}
              rotationDeg={selected?.rotationDeg ?? 0}
              offsetYMm={isImageObject(selected) ? selected.yMm : isTextObject(selected) ? selected.offsetYMm : 0}
              engraveZoneHeightMm={doc.canvas.heightMm}
            />
          </div>
          <p className="text-xs text-slate-600">Uses selected artwork when available; otherwise first uploaded image.</p>
        </section>
      ) : null}

      {isImageObject(selected) ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-sm">X (mm)<input type="number" step="0.01" value={selected.xMm} onChange={(e) => updateSelectedImage({ xMm: Number(e.target.value) })} className="w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Y (mm)<input type="number" step="0.01" value={selected.yMm} onChange={(e) => updateSelectedImage({ yMm: Number(e.target.value) })} className="w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Width (mm)<input type="number" min="0.01" step="0.01" value={selected.widthMm} onChange={(e) => updateSelectedImage({ widthMm: Number(e.target.value) })} className="w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Height (mm)<input type="number" min="0.01" step="0.01" value={selected.heightMm} onChange={(e) => updateSelectedImage({ heightMm: Number(e.target.value) })} className="w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Rotation (deg)<input type="number" step="0.01" value={selected.rotationDeg} onChange={(e) => updateSelectedImage({ rotationDeg: Number(e.target.value) })} className="w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Opacity<input type="number" min="0" max="1" step="0.01" value={selected.opacity} onChange={(e) => updateSelectedImage({ opacity: Number(e.target.value) })} className="w-full rounded border px-2 py-1" /></label>
        </div>
      ) : null}

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
      {selectedWarnings.length > 0 ? <ul className="list-disc space-y-1 pl-4 text-xs text-black">{selectedWarnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul> : null}
      <section className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3 text-black">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Export Pack</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs ${preflight?.status === "pass" ? "bg-emerald-100 text-emerald-700" : preflight?.status === "warn" ? "bg-amber-100 text-amber-700" : preflight?.status === "fail" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-700"}`}>
            {preflight?.status ?? "not-run"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded border px-2 py-1 text-xs" onClick={() => void runPreflight()} disabled={isRunningPreflight}>{isRunningPreflight ? "Running..." : "Run Preflight"}</button>
          <button className="rounded bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => void exportJob()} disabled={isExporting}>{isExporting ? "Exporting..." : "Export Job"}</button>
          <a
            className={`rounded border px-2 py-1 text-xs ${exportResult?.svgUrl ? "" : "pointer-events-none opacity-40"}`}
            href={exportResult?.svgUrl ?? "#"}
            download={`job-${designJobId}.svg`}
          >
            Download SVG
          </a>
          <a
            className={`rounded border px-2 py-1 text-xs ${exportResult?.manifestUrl ? "" : "pointer-events-none opacity-40"}`}
            href={exportResult?.manifestUrl ?? "#"}
            download={`job-${designJobId}-manifest.json`}
          >
            Download Manifest JSON
          </a>
        </div>
        <label className="block text-xs">
          Batch Job IDs (comma separated)
          <input value={batchIds} onChange={(event) => setBatchIds(event.target.value)} placeholder="job_a,job_b" className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <button className="rounded border px-2 py-1 text-xs" onClick={() => void exportBatch()} disabled={isExporting}>Export Selected Jobs</button>
        <div className="rounded border bg-white p-2 text-xs">
          <p className="font-medium">Preflight Summary</p>
          <p className="mt-1 text-slate-700">{groupedIssues.error.length} errors ┬╖ {groupedIssues.warning.length} warnings ┬╖ {groupedIssues.info.length} info</p>
          {(groupedIssues.error.length + groupedIssues.warning.length + groupedIssues.info.length) > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-700">
              {[...groupedIssues.error, ...groupedIssues.warning, ...groupedIssues.info].map((issue) => (
                <li key={`${issue.code}-${issue.objectId ?? issue.message}`}>{issue.message}{issue.objectId ? ` (${issue.objectId})` : ""}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-slate-500">Run preflight to see validation messages.</p>
          )}
        </div>
        {exportResult ? (
          <div className="space-y-2 rounded border bg-white p-2 text-xs">
            <p><strong>Last export:</strong> {new Date(exportResult.exportedAt).toLocaleString()}</p>
            <p><strong>SVG size:</strong> {(exportResult.svgByteSize / 1024).toFixed(2)} KB ┬╖ <strong>Manifest size:</strong> {(exportResult.manifestByteSize / 1024).toFixed(2)} KB</p>
            {exportResult.warnings.length > 0 ? <ul className="list-disc pl-4 text-black">{exportResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
            {exportResult.errors.length > 0 ? <ul className="list-disc pl-4 text-black">{exportResult.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
            <details>
              <summary className="cursor-pointer font-medium">Advanced</summary>
              <div className="mt-2 space-y-2">
                <label className="block text-xs">Manifest JSON<textarea readOnly value={exportResult.manifest} className="mt-1 h-28 w-full rounded border px-2 py-1 font-mono" /></label>
                <label className="block text-xs">SVG<textarea readOnly value={exportResult.svg} className="mt-1 h-24 w-full rounded border px-2 py-1 font-mono" /></label>
                <div className="flex gap-2">
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => void copyText(exportResult.manifest, "Manifest JSON")}>Copy Manifest</button>
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => void copyText(exportResult.svg, "SVG")}>Copy SVG</button>
                </div>
              </div>
            </details>
          </div>
        ) : null}
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
          onToggleLock={() => {
            if (!selected) return;
            setLockedObjectIds((prev) => {
              const next = new Set(prev);
              if (next.has(selected.id)) {
                next.delete(selected.id);
              } else {
                next.add(selected.id);
              }
              return next;
            });
          }}
          onToggleHide={() => {
            if (!selected) return;
            setHiddenObjectIds((prev) => {
              const next = new Set(prev);
              if (next.has(selected.id)) {
                next.delete(selected.id);
              } else {
                next.add(selected.id);
              }
              return next;
            });
          }}
          onUpdateBlendMode={(blendMode) => selected ? setBlendModeByObjectId((prev) => ({ ...prev, [selected.id]: blendMode })) : undefined}
          hiddenObjectIds={hiddenObjectIds}
          lockedObjectIds={lockedObjectIds}
          blendModeByObjectId={blendModeByObjectId}
        />
      </div>
      <p className="min-h-5 text-xs text-black">{statusMessage}</p>
    </section>
  );
}
