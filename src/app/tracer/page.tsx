"use client";

import { FormEvent, useMemo, useState } from "react";

type JobStatus = "idle" | "queued" | "processing" | "done" | "failed";
type Mode = "sync" | "background";

type TraceResult = {
  svgAssetId: string;
  svgUrl: string;
  svgText?: string;
};

const BACKOFF_MS = [750, 1000, 1250, 1500, 2000];

export default function TracerPage() {
  const [assetId, setAssetId] = useState("");
  const [settingsText, setSettingsText] = useState("{}");
  const [mode, setMode] = useState<Mode>("background");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [error, setError] = useState<{ code?: string | null; message?: string | null } | null>(null);
  const [pending, setPending] = useState(false);

  const settingsPreview = useMemo(() => {
    try {
      return JSON.parse(settingsText);
    } catch {
      return null;
    }
  }, [settingsText]);

  async function pollJob(jobIdToPoll: string) {
    for (const delay of BACKOFF_MS) {
      const res = await fetch(`/api/tracer/jobs/${jobIdToPoll}`, { cache: "no-store" });
      const json = await res.json();

      if (!json.ok) {
        setStatus("failed");
        setError(json.error ?? { code: "UNKNOWN", message: "Unknown polling error" });
        return;
      }

      const payload = json.result;
      setStatus(payload.status);
      setProgress(payload.progress ?? 0);

      if (payload.status === "done") {
        setResult(payload.result ?? null);
        return;
      }

      if (payload.status === "failed") {
        setError(payload.error ?? { code: "TRACE_FAILED", message: "Tracing failed." });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    setTimeout(() => {
      void pollJob(jobIdToPoll);
    }, BACKOFF_MS[BACKOFF_MS.length - 1]);
  }

  async function submitTrace(selectedMode: Mode) {
    setPending(true);
    setResult(null);
    setError(null);
    setProgress(0);

    try {
      if (!settingsPreview) {
        setStatus("failed");
        setError({ code: "INVALID_JSON", message: "Settings must be valid JSON." });
        return;
      }

      if (selectedMode === "background") {
        const res = await fetch("/api/tracer/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId, settings: settingsPreview })
        });
        const json = await res.json();

        if (!json.ok) {
          setStatus("failed");
          setError(json.error);
          return;
        }

        const createdJobId = json.result.jobId as string;
        setJobId(createdJobId);
        setStatus("queued");
        void pollJob(createdJobId);
        return;
      }

      const res = await fetch("/api/tracer/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, settings: settingsPreview, mode: "sync" })
      });
      const json = await res.json();

      if (!json.ok) {
        setStatus("failed");
        setError(json.error);
        return;
      }

      const payload = json.result;
      if (payload.status === "done") {
        setStatus("done");
        setProgress(100);
        setResult(payload.result);
      } else {
        setJobId(payload.jobId);
        setStatus("processing");
        void pollJob(payload.jobId);
      }
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitTrace(mode);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Tracer</h1>
      <form className="flex flex-col gap-4 rounded border p-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-2 text-sm">
          Asset ID
          <input className="rounded border px-3 py-2" value={assetId} onChange={(event) => setAssetId(event.target.value)} placeholder="asset_xxx" required />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          Trace settings (JSON)
          <textarea className="min-h-28 rounded border px-3 py-2 font-mono text-xs" value={settingsText} onChange={(event) => setSettingsText(event.target.value)} />
        </label>

        <fieldset className="rounded border p-3">
          <legend className="px-1 text-sm font-medium">Mode</legend>
          <label className="mr-4 text-sm">
            <input type="radio" name="mode" value="sync" checked={mode === "sync"} onChange={() => setMode("sync")} className="mr-2" />
            Fast (sync)
          </label>
          <label className="text-sm">
            <input type="radio" name="mode" value="background" checked={mode === "background"} onChange={() => setMode("background")} className="mr-2" />
            Background (recommended)
          </label>
        </fieldset>

        <button type="submit" disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {pending ? "Submitting…" : "Trace Now"}
        </button>
      </form>

      {status !== "idle" && (
        <section className="rounded border p-4">
          <p className="text-sm font-medium">Status: {status}</p>
          <div className="mt-2 h-3 w-full rounded bg-gray-200">
            <div className="h-3 rounded bg-green-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-600">{progress}%</p>
          {jobId && <p className="mt-1 text-xs text-gray-500">Job ID: {jobId}</p>}
        </section>
      )}

      {error && (
        <section className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p>{error.code}: {error.message}</p>
          <button type="button" className="mt-2 rounded border border-red-700 px-3 py-1" onClick={() => void submitTrace("background")}>
            Retry
          </button>
        </section>
      )}

      {result && (
        <section className="rounded border p-4">
          <h2 className="mb-3 font-medium">SVG preview</h2>
          <img src={result.svgUrl} alt="Traced SVG output" className="max-h-[320px] rounded border" />
          <div className="mt-3">
            <a href={result.svgUrl} download className="rounded border px-3 py-1 text-sm">
              Download SVG
            </a>
          </div>
        </section>
      )}
    </main>
  );
}
