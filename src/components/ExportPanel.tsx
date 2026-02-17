"use client";

import { useState } from "react";
import { TRACING_PRESETS, PRESET_OPTIONS, type TracingPreset } from "@/lib/tracing-core/presets";

type ExportSettings = {
  threshold: number;
  smoothing: number;
  despeckle: number;
  simplify: number;
  outputMode: "fill" | "stroke";
  strokeWidth: number;
  bgTolerance: number;
  assumeWhiteBg: boolean;
};

type Props = {
  svgContent: string;
  onExport?: (svg: string, optimized: string, settings: ExportSettings) => void;
};

export default function ExportPanel({ svgContent, onExport }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<string>("logoClean");
  const [settings, setSettings] = useState<ExportSettings>(() => {
    const preset = TRACING_PRESETS.logoClean;
    return {
      threshold: preset.settings.threshold ?? 175,
      smoothing: preset.settings.smoothing ?? 2,
      despeckle: preset.settings.despeckle ?? 6,
      simplify: preset.settings.simplify ?? 4,
      outputMode: preset.settings.outputMode ?? "fill",
      strokeWidth: preset.settings.strokeWidth ?? 1,
      bgTolerance: preset.settings.bgTolerance ?? 10,
      assumeWhiteBg: preset.settings.assumeWhiteBg ?? true
    };
  });
  const [previewMode, setPreviewMode] = useState<"fill" | "stroke">("fill");
  const [showNodeInfo, setShowNodeInfo] = useState(true);

  const applyPreset = (presetId: string) => {
    const preset = TRACING_PRESETS[presetId];
    if (!preset) return;

    setSelectedPreset(presetId);
    setSettings({
      threshold: preset.settings.threshold ?? 175,
      smoothing: preset.settings.smoothing ?? 2,
      despeckle: preset.settings.despeckle ?? 6,
      simplify: preset.settings.simplify ?? 4,
      outputMode: preset.settings.outputMode ?? "fill",
      strokeWidth: preset.settings.strokeWidth ?? 1,
      bgTolerance: preset.settings.bgTolerance ?? 10,
      assumeWhiteBg: preset.settings.assumeWhiteBg ?? true
    });
  };

  const handleSettingChange = (key: keyof ExportSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const downloadSvg = (optimized: boolean = false) => {
    const filename = optimized ? "design-optimized.svg" : "design.svg";
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const countNodes = () => {
    return (svgContent.match(/[MLCQAZmlcqaz]/g) || []).length;
  };

  const countPaths = () => {
    const parser = new DOMParser();
    try {
      const doc = parser.parseFromString(svgContent, "image/svg+xml");
      return doc.querySelectorAll("path").length;
    } catch {
      return 0;
    }
  };

  return (
    <div className="space-y-6 rounded border bg-white p-4">
      <div>
        <h3 className="mb-3 font-semibold">Presets</h3>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => applyPreset(opt.value)}
              className={`rounded px-3 py-2 text-sm font-medium transition ${
                selectedPreset === opt.value
                  ? "bg-blue-600 text-white"
                  : "border bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title={opt.description}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Settings</h3>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Threshold</span>
          <input
            type="range"
            min="0"
            max="255"
            value={settings.threshold}
            onChange={(e) => handleSettingChange("threshold", Number(e.target.value))}
            className="w-full"
          />
          <span className="text-xs text-slate-600">{settings.threshold}</span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Smoothing</span>
          <input
            type="range"
            min="0"
            max="10"
            value={settings.smoothing}
            onChange={(e) => handleSettingChange("smoothing", Number(e.target.value))}
            className="w-full"
          />
          <span className="text-xs text-slate-600">{settings.smoothing}</span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Despeckle</span>
          <input
            type="range"
            min="0"
            max="10"
            value={settings.despeckle}
            onChange={(e) => handleSettingChange("despeckle", Number(e.target.value))}
            className="w-full"
          />
          <span className="text-xs text-slate-600">{settings.despeckle}</span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Simplify</span>
          <input
            type="range"
            min="0"
            max="10"
            value={settings.simplify}
            onChange={(e) => handleSettingChange("simplify", Number(e.target.value))}
            className="w-full"
          />
          <span className="text-xs text-slate-600">{settings.simplify}</span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">BG Tolerance</span>
          <input
            type="range"
            min="0"
            max="60"
            value={settings.bgTolerance}
            onChange={(e) => handleSettingChange("bgTolerance", Number(e.target.value))}
            className="w-full"
          />
          <span className="text-xs text-slate-600">{settings.bgTolerance}</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.assumeWhiteBg}
            onChange={(e) => handleSettingChange("assumeWhiteBg", e.target.checked)}
            className="rounded"
          />
          <span>Assume White Background</span>
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Output Mode</h3>
        <div className="flex gap-2">
          {(["fill", "stroke"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleSettingChange("outputMode", mode)}
              className={`flex-1 rounded px-3 py-2 text-sm font-medium transition ${
                settings.outputMode === mode
                  ? "bg-slate-900 text-white"
                  : "border bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        {settings.outputMode === "stroke" && (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Stroke Width</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={settings.strokeWidth}
              onChange={(e) => handleSettingChange("strokeWidth", Number(e.target.value))}
              className="w-full rounded border px-2 py-1"
            />
          </label>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Preview</h3>
        <button
          onClick={() => setPreviewMode(previewMode === "fill" ? "stroke" : "fill")}
          className="w-full rounded border px-3 py-2 text-sm"
        >
          Toggle {previewMode === "fill" ? "Stroke" : "Fill"} Preview
        </button>
        <button onClick={() => setShowNodeInfo(!showNodeInfo)} className="w-full rounded border px-3 py-2 text-sm">
          {showNodeInfo ? "Hide" : "Show"} Node Info
        </button>
      </div>

      {showNodeInfo && (
        <div className="rounded bg-slate-50 p-3 text-sm">
          <p className="text-xs text-slate-600">
            <strong>Paths:</strong> {countPaths()}
          </p>
          <p className="text-xs text-slate-600">
            <strong>Nodes:</strong> {countNodes()}
          </p>
          <p className="text-xs text-slate-600">
            <strong>Size:</strong> {(new Blob([svgContent]).size / 1024).toFixed(2)} KB
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => downloadSvg(false)} className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Download SVG
        </button>
        <button onClick={() => downloadSvg(true)} className="flex-1 rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
          Download Optimized
        </button>
      </div>

      <div className="space-y-1 text-xs text-slate-500">
        <p className="disabled cursor-not-allowed opacity-50">📄 PDF Export (coming soon)</p>
        <p className="disabled cursor-not-allowed opacity-50">🔷 DXF Export (coming soon)</p>
      </div>
    </div>
  );
}
