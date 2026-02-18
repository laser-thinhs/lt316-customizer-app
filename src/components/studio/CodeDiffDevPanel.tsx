"use client";

import { useMemo, useState } from "react";

type ProposeResponse = {
  proposal_id: string;
  patch: string;
  summary: string;
  warnings: string[];
  files: string[];
};

export default function CodeDiffDevPanel() {
  const [instruction, setInstruction] = useState(
    "Create a new block called Cylinder3DBlock and register it in the block registry"
  );
  const [ack, setAck] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [actorRole, setActorRole] = useState("admin");
  const [proposal, setProposal] = useState<ProposeResponse | null>(null);
  const [validation, setValidation] = useState<string>("");
  const [saveResult, setSaveResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const headers = useMemo(
    () => ({
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey, "x-actor-role": actorRole } : {}),
    }),
    [apiKey, actorRole]
  );

  async function onPropose() {
    if (!ack) {
      setError("You must confirm manual review intent before proposing.");
      return;
    }

    setBusy(true);
    setError("");
    setValidation("");
    setSaveResult("");

    try {
      const res = await fetch("/api/studio/ai/code-propose", {
        method: "POST",
        headers,
        body: JSON.stringify({ instruction }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Propose request failed");
      }
      setProposal(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function onValidate() {
    if (!proposal) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/studio/ai/code-validate", {
        method: "POST",
        headers,
        body: JSON.stringify({ patch: proposal.patch }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Validation failed");
      }
      setValidation(JSON.stringify(payload.data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!proposal) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/studio/patches/save", {
        method: "POST",
        headers,
        body: JSON.stringify({ proposal_id: proposal.proposal_id, patch: proposal.patch }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Save failed");
      }
      setSaveResult(payload.data.saved_path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    if (!proposal) return;
    await navigator.clipboard.writeText(proposal.patch);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        Dev-only code generation. Proposals are validated and must be applied manually.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="x-api-key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={actorRole}
          onChange={(e) => setActorRole(e.target.value)}
        >
          <option value="admin">admin</option>
          <option value="operator">operator</option>
        </select>
      </div>

      <textarea
        className="min-h-28 w-full rounded border border-slate-300 p-3 font-mono text-sm"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
      />

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>I understand this will not auto-apply. I will review and apply manually.</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          onClick={onPropose}
          disabled={busy}
        >
          Propose diff
        </button>
        <button
          className="rounded border border-slate-400 px-4 py-2 text-sm disabled:opacity-60"
          onClick={onValidate}
          disabled={busy || !proposal}
        >
          Validate Patch
        </button>
        <button
          className="rounded border border-slate-400 px-4 py-2 text-sm disabled:opacity-60"
          onClick={onSave}
          disabled={busy || !proposal}
        >
          Save Patch
        </button>
        <button
          className="rounded border border-slate-400 px-4 py-2 text-sm disabled:opacity-60"
          onClick={onCopy}
          disabled={!proposal}
        >
          Copy Patch
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {proposal ? (
        <section className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm">
            <strong>Proposal:</strong> {proposal.proposal_id}
          </p>
          <p className="text-sm">{proposal.summary}</p>
          <div className="text-sm">
            <strong>Files:</strong> {proposal.files.join(", ")}
          </div>
          {proposal.warnings.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-amber-700">
              {proposal.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <pre className="max-h-[420px] overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
            {proposal.patch}
          </pre>
        </section>
      ) : null}

      {validation ? (
        <section>
          <h3 className="mb-1 text-sm font-medium">Validation report</h3>
          <pre className="rounded border border-slate-200 p-3 text-xs">{validation}</pre>
        </section>
      ) : null}

      {saveResult ? <p className="text-sm text-emerald-700">Saved to: {saveResult}</p> : null}
    </div>
  );
}
