"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TracerSettings = {
  mode: "auto" | "bw" | "color";
  threshold: number;
  smoothing: number;
  despeckle: number;
  simplify: number;
  invert: boolean;
  removeBackground: boolean;
  bgTolerance: number;
  output: "fill" | "stroke";
  strokeWidth?: number;
  outlineMode: boolean;
};

const DEFAULT_SETTINGS: TracerSettings = {
  mode: "auto",
  threshold: 165,
  smoothing: 2,
  despeckle: 3,
  simplify: 2,
  invert: false,
  removeBackground: true,
  bgTolerance: 18,
  output: "fill",
  strokeWidth: 1,
  outlineMode: false
};

const PRESETS: Record<string, Partial<TracerSettings>> = {
  "Laser Engrave": {
    output: "fill",
    removeBackground: true,
    simplify: 2,
    threshold: 165,
    outlineMode: false
  },
  "Laser Cut": {
    output: "stroke",
    strokeWidth: 1,
    simplify: 3,
    threshold: 175,
    outlineMode: true
  },
  "Photo Logo": {
    smoothing: 5,
    despeckle: 5,
    threshold: 160,
    output: "fill"
  }
};

export default function TracerPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<TracerSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<"idle" | "uploading" | "tracing" | "done" | "failed">("idle");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [outputSvgAssetId, setOutputSvgAssetId] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("tracer:last-settings");
    if (raw) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch {
        localStorage.removeItem("tracer:last-settings");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("tracer:last-settings", JSON.stringify(settings));
  }, [settings]);

  const banner = useMemo(() => {
    if (status === "uploading") return "Uploading...";
    if (status === "tracing") return "Tracing...";
    if (status === "done") return "Done";
    if (status === "failed") return "Failed";
    return "";
  }, [status]);

  async function onTrace() {
    if (!file) {
      setError("Please choose a PNG or JPEG file.");
      return;
    }

    setError(null);
    setStatus("uploading");

    const form = new FormData();
    form.append("file", file);
    form.append("settings", JSON.stringify(settings));

    setStatus("tracing");
    const res = await fetch("/api/tracer", { method: "POST", body: form });
    const payload = await res.json();

    if (!payload.ok) {
      setStatus("failed");
      setError(payload.error?.message ?? "Tracing failed");
      return;
    }

    setSvg(payload.result.svg);
    setOutputSvgAssetId(payload.result.outputSvgAssetId ?? null);
    setStatus("done");
  }

  async function sendToProof() {
    if (!outputSvgAssetId) return;
    const res = await fetch("/api/proof/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svgAssetId: outputSvgAssetId })
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error?.message ?? "Could not create proof job");
      return;
    }
    router.push(`/proof?jobId=${payload.data.id}&svgAssetId=${outputSvgAssetId}`);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">AI Image Tracer</h1>
      {banner ? <div className="rounded border p-2">Status: {banner}</div> : null}
      {error ? <div className="rounded border border-red-500 p-2 text-red-600">{error}</div> : null}

      <input type="file" accept="image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

      <div className="grid grid-cols-2 gap-3">
        <label>
          Presets
          <select
            className="ml-2 border"
            onChange={(e) => {
              const preset = PRESETS[e.target.value];
              if (preset) setSettings((prev) => ({ ...prev, ...preset }));
            }}
          >
            <option value="">Custom</option>
            {Object.keys(PRESETS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Outline mode
          <input
            className="ml-2"
            type="checkbox"
            checked={settings.outlineMode}
            onChange={(e) => setSettings((prev) => ({ ...prev, outlineMode: e.target.checked, output: e.target.checked ? "stroke" : prev.output }))}
          />
        </label>
      </div>

      <button className="rounded border px-4 py-2" onClick={onTrace}>
        Trace image
      </button>

      {svg ? (
        <section className="space-y-2">
          <div className="flex gap-2">
            <button
              className="rounded border px-3 py-1"
              onClick={() => {
                const blob = new Blob([svg], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "trace.svg";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download as .svg
            </button>
            <button
              className="rounded border px-3 py-1"
              onClick={async () => {
                if (!navigator.clipboard) return;
                await navigator.clipboard.writeText(svg);
              }}
            >
              Copy SVG
            </button>
            {outputSvgAssetId ? (
              <button className="rounded border px-3 py-1" onClick={sendToProof}>
                Send to Proof
              </button>
            ) : null}
          </div>
          <div className="rounded border p-3" dangerouslySetInnerHTML={{ __html: svg }} />
        </section>
      ) : null}
    </main>
  );
}
