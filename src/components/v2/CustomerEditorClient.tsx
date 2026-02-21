"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { objectPresets } from "@/core/v2/presets";
import { DesignAsset, DesignJob, Placement } from "@/core/v2/types";
import type { YetiTemplateManifest, YetiTemplateStyle } from "@/lib/yeti-templates";
import type { WrapUvTransform } from "@/lib/rendering/svgTexture";

type Props = { initialJobId?: string };

const saveDebounceMs = 350;
const TemplateMeshPreview3D = dynamic(() => import("@/components/v2/TemplateMeshPreview3D"), { ssr: false });
const CALIBRATION_KEY_PREFIX = "uv-calibration:";

function normalizeQuarterTurns(rotation: number) {
  const normalized = ((rotation % 360) + 360) % 360;
  return (Math.round(normalized / 90) * 90) % 360;
}

function getCalibrationStorageKey(templateMeshPath?: string) {
  return templateMeshPath ? `${CALIBRATION_KEY_PREFIX}${templateMeshPath}` : null;
}

function normalizeRotation(deg: number) {
  const normalized = ((deg + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
}

function snapTo90(deg: number) {
  return Math.round(deg / 90) * 90;
}

function buildTemplateObject(style: YetiTemplateStyle) {
  const width = Math.round(Math.PI * style.diameter_mm);
  const height = style.height_mm;
  return {
    id: `yeti:${style.id}`,
    name: style.label,
    type: "cylinder" as const,
    dimensions_mm: { diameter: style.diameter_mm, height: style.height_mm },
    safeArea_mm: { x: 5, y: 8, width: Math.max(width - 10, 40), height: Math.max(height - 16, 40) },
    defaultSeam_mm: 0
  };
}

export default function CustomerEditorClient({ initialJobId }: Props) {
  const [job, setJob] = useState<DesignJob | null>(null);
  const [asset, setAsset] = useState<DesignAsset | null>(null);
  const [templateManifest, setTemplateManifest] = useState<YetiTemplateManifest | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string>("");
  const [selectedColorId, setSelectedColorId] = useState<string>("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string>("");
  const [debugUv, setDebugUv] = useState(false);
  const [uvCalibration, setUvCalibration] = useState<WrapUvTransform>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch("/api/templates/yeti")
      .then((res) => res.json())
      .then((data) => setTemplateManifest(data.data))
      .catch(() => setTemplateManifest(null));
  }, []);

  useEffect(() => {
    if (!initialJobId) return;
    fetch(`/api/design-jobs/${initialJobId}`).then((res) => res.json()).then((data) => {
      const nextJob = data.data as DesignJob;
      setJob(nextJob);
      if (nextJob.productTemplateId) setSelectedStyleId(nextJob.productTemplateId.replace("yeti:", ""));
      if (nextJob.colorId) setSelectedColorId(nextJob.colorId);
    });
    fetch(`/api/design-jobs/${initialJobId}/assets`).then((res) => res.json()).then((data) => setAsset(data.data?.[0] ?? null));
  }, [initialJobId]);

  const selectedStyle = useMemo(
    () => templateManifest?.styles.find((style) => style.id === selectedStyleId) ?? null,
    [templateManifest, selectedStyleId]
  );
  const selectedColor = useMemo(
    () => selectedStyle?.colors.find((color) => color.id === selectedColorId) ?? selectedStyle?.colors[0] ?? null,
    [selectedStyle, selectedColorId]
  );

  useEffect(() => {
    const storageKey = getCalibrationStorageKey(selectedStyle?.meshPath);
    if (!storageKey || typeof window === "undefined") {
      setUvCalibration({});
      return;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setUvCalibration({});
      return;
    }

    try {
      setUvCalibration(JSON.parse(raw) as WrapUvTransform);
    } catch {
      setUvCalibration({});
    }
  }, [selectedStyle?.meshPath]);

  const effectiveUvTransform = useMemo<WrapUvTransform>(() => {
    const base = selectedStyle?.uvTransform ?? {};
    return {
      rotateDeg: normalizeQuarterTurns((base.rotateDeg ?? 0) + (uvCalibration.rotateDeg ?? 0)),
      flipU: Boolean(base.flipU) !== Boolean(uvCalibration.flipU),
      flipV: Boolean(base.flipV) !== Boolean(uvCalibration.flipV),
      uOffset: (base.uOffset ?? 0) + (uvCalibration.uOffset ?? 0),
      vOffset: (base.vOffset ?? 0) + (uvCalibration.vOffset ?? 0),
      invertSeamDirection: Boolean(base.invertSeamDirection) !== Boolean(uvCalibration.invertSeamDirection)
    };
  }, [selectedStyle?.uvTransform, uvCalibration]);

  function updateCalibration(updater: (prev: WrapUvTransform) => WrapUvTransform) {
    setUvCalibration((prev) => updater(prev));
  }

  function saveCalibrationAsDefault() {
    const storageKey = getCalibrationStorageKey(selectedStyle?.meshPath);
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(uvCalibration));
  }

  useEffect(() => {
    if (!selectedStyle && templateManifest?.styles.length) {
      const firstStyle = templateManifest.styles[0];
      setSelectedStyleId(firstStyle.id);
      setSelectedColorId(firstStyle.colors[0]?.id ?? "");
    }
  }, [templateManifest, selectedStyle]);

  const objectDef = useMemo(() => {
    if (selectedStyle) return buildTemplateObject(selectedStyle);
    return objectPresets.find((item) => item.id === job?.objectDefinitionId) ?? objectPresets[0];
  }, [job?.objectDefinitionId, selectedStyle]);

  const width = selectedStyle?.wrapWidthMm ?? (objectDef.type === "cylinder" ? Math.round(Math.PI * (objectDef.dimensions_mm.diameter ?? 1)) : objectDef.dimensions_mm.width ?? 200);
  const height = selectedStyle?.wrapHeightMm ?? objectDef.dimensions_mm.height;

  async function createJob() {
    const defaultDesign = selectedStyle?.designs[0];
    const res = await fetch("/api/design-jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        v2: true,
        objectDefinitionId: selectedStyle ? `yeti:${selectedStyle.id}` : objectDef.id,
        productTemplateId: selectedStyle ? `yeti:${selectedStyle.id}` : undefined,
        colorId: selectedColor?.id,
        templateDesignId: defaultDesign?.id ?? "default",
        templateGblPath: defaultDesign?.gblPath,
        templatePreviewSvgPath: defaultDesign?.previewSvgPath,
        templateMeshPath: selectedStyle?.meshPath
      })
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
        body: JSON.stringify({
          placement: nextPlacement,
          objectDefinitionId,
          productTemplateId: selectedStyle ? `yeti:${selectedStyle.id}` : job.productTemplateId,
          colorId: selectedColor?.id ?? job.colorId,
          templateDesignId: job.templateDesignId ?? "default",
          templateGblPath: job.templateGblPath,
          templatePreviewSvgPath: job.templatePreviewSvgPath,
          templateMeshPath: selectedStyle?.meshPath ?? job.templateMeshPath
        })
      });
      const payload = await res.json();
      setJob(payload.data);
    }, saveDebounceMs);
  }

  async function applyTemplateSelection(styleId: string, colorId: string) {
    if (!job) return;
    const styleRes = await fetch(`/api/templates/yeti/${styleId}`);
    const stylePayload = await styleRes.json();
    const style = stylePayload.data as YetiTemplateStyle;
    const design = style.designs[0];
    const nextPlacement = { ...job.placement, seamX_mm: 0 };
    const patchRes = await fetch(`/api/design-jobs/${job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        objectDefinitionId: `yeti:${style.id}`,
        placement: nextPlacement,
        productTemplateId: `yeti:${style.id}`,
        colorId,
        templateDesignId: design?.id ?? "default",
        templateGblPath: design?.gblPath,
        templatePreviewSvgPath: design?.previewSvgPath,
        templateMeshPath: style.meshPath
      })
    });
    const patchPayload = await patchRes.json();
    setJob(patchPayload.data);
  }

  function setLocalPlacement(nextPlacement: Placement) {
    setJob((prev) => (prev ? { ...prev, placement: nextPlacement } : prev));
  }

  function rotateByQuarter(step: -90 | 90) {
    if (!placement) return;
    const snapped = snapTo90(placement.rotation_deg);
    const next = { ...placement, rotation_deg: normalizeRotation(snapped + step) };
    setLocalPlacement(next);
    scheduleSave(next);
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
    setSubmitState("submitting");
    setSubmitMessage("");
    const response = await fetch(`/api/design-jobs/${job.id}/submit`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message ?? "Submit failed. Please try again.";
      setSubmitState("error");
      setSubmitMessage(message);
      return;
    }
    const refreshed = await fetch(`/api/design-jobs/${job.id}`).then((res) => res.json());
    setJob(refreshed.data);
    setSubmitState("submitted");
    setSubmitMessage("Job submitted successfully.");
  }

  const placement = job?.placement;
  const previewHref = asset?.originalSvgPublicUrl ?? job?.templatePreviewSvgPath;
  const previewWidth = asset ? asset.bbox.width * (placement?.scale ?? 1) : Math.max(objectDef.safeArea_mm.width * (placement?.scale ?? 1), 30);
  const previewHeight = asset ? asset.bbox.height * (placement?.scale ?? 1) : Math.max(objectDef.safeArea_mm.height * (placement?.scale ?? 1), 30);

  return (
    <div className="space-y-4 p-6">
      {!job ? (
        <div className="rounded border p-3">
          <div className="mb-2 text-sm font-medium">1) Select Yeti Style + Color</div>
          <div className="mb-3 flex flex-wrap gap-3">
            <label>Style
              <select
                className="ml-2 border"
                value={selectedStyleId}
                onChange={(e) => {
                  const styleId = e.target.value;
                  setSelectedStyleId(styleId);
                  const style = templateManifest?.styles.find((item) => item.id === styleId);
                  setSelectedColorId(style?.colors[0]?.id ?? "");
                }}
              >
                <option value="">Choose style</option>
                {templateManifest?.styles.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label>Color
              <select className="ml-2 border" value={selectedColorId} onChange={(e) => setSelectedColorId(e.target.value)} disabled={!selectedStyle}>
                {(selectedStyle?.colors ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <button className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50" onClick={createJob} disabled={!selectedStyleId}>Start New Job</button>
        </div>
      ) : null}

      {job && selectedStyle ? (
        <div className="flex flex-wrap gap-3 rounded border p-3 text-sm">
          <label>Style
            <select className="ml-2 border" value={selectedStyleId} onChange={async (e) => {
              const styleId = e.target.value;
              setSelectedStyleId(styleId);
              const nextColor = templateManifest?.styles.find((s) => s.id === styleId)?.colors[0]?.id ?? "";
              setSelectedColorId(nextColor);
              await applyTemplateSelection(styleId, nextColor);
            }}>
              {templateManifest?.styles.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label>Color
            <select className="ml-2 border" value={selectedColorId} onChange={async (e) => {
              const colorId = e.target.value;
              setSelectedColorId(colorId);
              await applyTemplateSelection(selectedStyleId, colorId);
            }}>
              {selectedStyle.colors.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <div className="text-slate-600">Template GBL: {job.templateGblPath ?? "none"}</div>
        </div>
      ) : null}

      {job ? (
        <>
          <div className="flex flex-wrap gap-3">
            <input type="file" accept=".svg,image/svg+xml" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button
              className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
              onClick={submit}
              disabled={submitState === "submitting" || !job.id.startsWith("v2_")}
            >
              {submitState === "submitting" ? "Submitting..." : "Submit Job"}
            </button>
            <div className="text-sm text-slate-600">Status: {job.status}</div>
          </div>
          {submitMessage ? (
            <div className={submitState === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>{submitMessage}</div>
          ) : null}
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
                  {previewHref ? (
                    <image
                      href={previewHref}
                      x={placement.x_mm}
                      y={placement.y_mm}
                      width={previewWidth}
                      height={previewHeight}
                      transform={`rotate(${placement.rotation_deg} ${placement.x_mm} ${placement.y_mm})`}
                      style={{ cursor: "move" }}
                      onPointerDown={(e) => {
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const base = { ...placement };
                        let latest = base;
                        const onMove = (ev: PointerEvent) => {
                          latest = { ...base, x_mm: base.x_mm + (ev.clientX - startX) * 0.5, y_mm: base.y_mm + (ev.clientY - startY) * 0.5 };
                          setLocalPlacement(latest);
                        };
                        const onUp = () => {
                          window.removeEventListener("pointermove", onMove);
                          window.removeEventListener("pointerup", onUp);
                          scheduleSave(latest);
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
                    setLocalPlacement(next);
                  }} onPointerUp={(e) => {
                    const next = { ...placement, scale: Number((e.target as HTMLInputElement).value) };
                    scheduleSave(next);
                  }} /></label>
                  <div className="space-y-1">
                    <label className="block">Rotate°
                      <input type="range" min={-180} max={180} step={1} value={placement.rotation_deg} onChange={(e) => {
                        const next = { ...placement, rotation_deg: Number(e.target.value) };
                        setLocalPlacement(next);
                      }} onPointerUp={(e) => {
                        const next = { ...placement, rotation_deg: Number((e.target as HTMLInputElement).value) };
                        scheduleSave(next);
                      }} />
                    </label>
                    <div className="flex items-center gap-2">
                      <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => rotateByQuarter(-90)} aria-label="Rotate left 90 degrees">
                        ↶ 90°
                      </button>
                      <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => rotateByQuarter(90)} aria-label="Rotate right 90 degrees">
                        ↷ 90°
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-0.5 text-xs"
                        onClick={() => {
                          const next = { ...placement, rotation_deg: normalizeRotation(snapTo90(placement.rotation_deg)) };
                          setLocalPlacement(next);
                          scheduleSave(next);
                        }}
                      >
                        Snap 90°
                      </button>
                      <span className="text-xs text-slate-500">Snaps to 90°</span>
                    </div>
                  </div>
                  <label>Wrap <input type="checkbox" checked={placement.wrapEnabled} onChange={(e) => {
                    const next = { ...placement, wrapEnabled: e.target.checked };
                    setLocalPlacement(next);
                    scheduleSave(next);
                  }} /></label>
                  <label>Seam X <input type="range" min={0} max={width} step={1} value={placement.seamX_mm} onChange={(e) => {
                    const next = { ...placement, seamX_mm: Number(e.target.value) };
                    setLocalPlacement(next);
                  }} onPointerUp={(e) => {
                    const next = { ...placement, seamX_mm: Number((e.target as HTMLInputElement).value) };
                    scheduleSave(next);
                  }} /></label>
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="mb-2 text-sm">3D Preview</div>
                <div className="flex h-[380px] items-center justify-center rounded bg-slate-900 text-slate-200">
                  {job.templateMeshPath ? (
                    <TemplateMeshPreview3D
                      meshPath={job.templateMeshPath}
                      overlaySvgPath={previewHref ?? undefined}
                      colorId={selectedColor?.id ?? job.colorId}
                      colorHex={selectedColor?.hex}
                      placement={placement}
                      wrapWidthMm={width}
                      uvTransform={effectiveUvTransform}
                      debugUv={debugUv}
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="text-center text-sm">No mesh selected.</div>
                  )}
                </div>
                <label className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={debugUv} onChange={(e) => setDebugUv(e.target.checked)} />
                  Debug UV
                </label>
                <div className="mt-3 rounded border border-slate-200 p-2 text-xs text-slate-700">
                  <div className="mb-2 font-medium">UV Calibration</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded border px-2 py-0.5"
                      onClick={() => updateCalibration((prev) => ({ ...prev, rotateDeg: normalizeQuarterTurns((prev.rotateDeg ?? 0) + 90) }))}
                    >
                      Rotate 90°
                    </button>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={Boolean(uvCalibration.flipU)} onChange={(e) => updateCalibration((prev) => ({ ...prev, flipU: e.target.checked }))} />
                      Flip U
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={Boolean(uvCalibration.flipV)} onChange={(e) => updateCalibration((prev) => ({ ...prev, flipV: e.target.checked }))} />
                      Flip V
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={Boolean(uvCalibration.invertSeamDirection)}
                        onChange={(e) => updateCalibration((prev) => ({ ...prev, invertSeamDirection: e.target.checked }))}
                      />
                      Invert Seam Direction
                    </label>
                    <button type="button" className="rounded bg-slate-800 px-2 py-0.5 text-white" onClick={saveCalibrationAsDefault}>
                      Save as Default for this template
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-center text-xs text-slate-600">Color: {selectedColor?.label ?? job.colorId ?? "n/a"} · Design: {job.templatePreviewSvgPath ?? "upload only"}</div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
