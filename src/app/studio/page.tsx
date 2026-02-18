"use client";

import { useMemo, useState } from "react";
import { BlockRenderer } from "@/studio/BlockRenderer";
import { studioBlockRegistry } from "@/studio/registry";
import { StudioBlock, StudioBlockType, StudioLayout, StudioProposalResponse, studioLayoutSchema } from "@/studio/types";

type SessionState = { authorized: boolean; csrfToken: string };

type ProposalView = {
  summary: string;
  warnings: string[];
  patch: Array<{ op: string; path: string; value?: unknown }>;
  nextLayout: StudioLayout;
};

const defaultLayout: StudioLayout = { id: "default", name: "default", blocks: [] };

function asPatch(current: StudioLayout, next: StudioLayout) {
  return [{ op: "replace", path: "/blocks", value: next.blocks, fromCount: current.blocks.length, toCount: next.blocks.length }];
}

export default function StudioPage() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [password, setPassword] = useState("");
  const [layoutId, setLayoutId] = useState("default");
  const [layout, setLayout] = useState<StudioLayout>(defaultLayout);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [proposal, setProposal] = useState<ProposalView | null>(null);
  const [status, setStatus] = useState<string>("");

  const selectedBlock = layout.blocks.find((block) => block.id === selectedId) ?? null;

  async function login() {
    setStatus("");
    const res = await fetch("/api/studio/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(json?.error?.message || "Login failed");
      return;
    }
    setSession({ authorized: true, csrfToken: json.data.csrfToken });
    setStatus("Authorized");
    await loadLayout(layoutId);
  }

  async function loadLayout(id = layoutId) {
    setStatus("");
    const res = await fetch(`/api/studio/layouts/${encodeURIComponent(id)}`);
    const json = await res.json();
    if (!res.ok) {
      setStatus(json?.error?.message || "Could not load layout");
      return;
    }
    setLayout(json.data);
    setSelectedId(json.data.blocks[0]?.id ?? null);
    setLayoutId(id);
  }

  function addBlock(type: StudioBlockType) {
    const block: StudioBlock = {
      id: `${type}-${crypto.randomUUID().slice(0, 8)}`,
      type,
      props: studioBlockRegistry[type].defaultProps as never
    };
    setLayout((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedId(block.id);
  }

  function reorderBlocks(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setLayout((prev) => {
      const sourceIndex = prev.blocks.findIndex((b) => b.id === sourceId);
      const targetIndex = prev.blocks.findIndex((b) => b.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev.blocks];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, blocks: next };
    });
  }

  function updateSelectedProp(key: string, value: string) {
    if (!selectedBlock) return;

    const nextBlocks = layout.blocks.map((block) => {
      if (block.id !== selectedBlock.id) return block;
      return {
        ...block,
        props: {
          ...block.props,
          [key]: key.includes("Mm") ? Number(value) : value
        }
      };
    });

    const next = { ...layout, blocks: nextBlocks };
    const parsed = studioLayoutSchema.safeParse(next);
    if (!parsed.success) {
      setInspectorError(parsed.error.issues[0]?.message ?? "Invalid value");
      return;
    }

    setInspectorError(null);
    setLayout(parsed.data);
  }

  async function saveLayout() {
    if (!session?.csrfToken) return;
    const parsed = studioLayoutSchema.safeParse(layout);
    if (!parsed.success) {
      setStatus(parsed.error.issues[0]?.message || "Layout invalid");
      return;
    }

    const res = await fetch(`/api/studio/layouts/${encodeURIComponent(layout.id)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-studio-csrf": session.csrfToken
      },
      body: JSON.stringify(parsed.data)
    });

    const json = await res.json();
    setStatus(res.ok ? "Saved" : json?.error?.message || "Save failed");
  }

  async function proposeChanges() {
    if (!session?.csrfToken) return;
    const res = await fetch("/api/studio/ai/propose", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-studio-csrf": session.csrfToken
      },
      body: JSON.stringify({ instruction: aiInstruction, layout })
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(json?.error?.message || "Proposal failed");
      return;
    }

    const data = json.data as StudioProposalResponse;
    setProposal({ summary: data.summary, warnings: data.warnings, patch: data.json_patch ?? asPatch(layout, data.next_layout), nextLayout: data.next_layout });
  }

  const inspectorEntries = useMemo(() => {
    if (!selectedBlock) return [];
    return Object.entries(selectedBlock.props).map(([key, value]) => [key, String(value)] as const);
  }, [selectedBlock]);

  if (!session?.authorized) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-semibold">Studio (Dev)</h1>
        <p className="mt-2 text-sm text-slate-600">Enter Studio password.</p>
        <input type="password" className="mt-4 w-full rounded border p-2" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" className="mt-3 rounded bg-slate-900 px-4 py-2 text-white" onClick={login}>
          Unlock Studio
        </button>
        {status ? <p className="mt-2 text-sm text-red-600">{status}</p> : null}
      </main>
    );
  }

  return (
    <main className="grid min-h-screen grid-cols-12 gap-4 bg-slate-50 p-4">
      <section className="col-span-2 rounded bg-white p-3 shadow-sm">
        <h2 className="text-sm font-semibold">Blocks</h2>
        <div className="mt-2 space-y-2">
          {Object.entries(studioBlockRegistry).map(([type, item]) => (
            <button key={type} type="button" className="w-full rounded border border-slate-200 px-3 py-2 text-left text-sm" onClick={() => addBlock(type as StudioBlockType)}>
              + {item.label}
            </button>
          ))}
        </div>
        <hr className="my-3" />
        <input className="w-full rounded border p-2 text-sm" value={layoutId} onChange={(e) => setLayoutId(e.target.value)} />
        <button type="button" className="mt-2 w-full rounded bg-slate-200 p-2 text-sm" onClick={() => loadLayout(layoutId)}>
          Load Layout
        </button>
        <button type="button" className="mt-2 w-full rounded bg-blue-600 p-2 text-sm text-white disabled:bg-blue-300" disabled={!!inspectorError} onClick={saveLayout}>
          Save Layout
        </button>
      </section>

      <section className="col-span-7 rounded bg-white p-3 shadow-sm">
        <h2 className="text-sm font-semibold">Canvas (drag to reorder)</h2>
        <div className="mt-3 space-y-2">
          {layout.blocks.map((block) => (
            <div
              key={block.id}
              draggable
              onDragStart={() => setDragId(block.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) reorderBlocks(dragId, block.id);
                setDragId(null);
              }}
            >
              <BlockRenderer block={block} selected={selectedId === block.id} onClick={() => setSelectedId(block.id)} />
            </div>
          ))}
        </div>
      </section>

      <section className="col-span-3 space-y-4">
        <div className="rounded bg-white p-3 shadow-sm">
          <h2 className="text-sm font-semibold">Inspector</h2>
          {selectedBlock ? (
            <div className="mt-2 space-y-2">
              {inspectorEntries.map(([key, value]) => (
                <label key={key} className="block text-xs">
                  <span className="mb-1 block text-slate-500">{key}</span>
                  <input value={value} onChange={(e) => updateSelectedProp(key, e.target.value)} className="w-full rounded border p-2 text-sm" />
                </label>
              ))}
              {inspectorError ? <p className="text-xs text-red-600">{inspectorError}</p> : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Select a block.</p>
          )}
        </div>

        <div className="rounded bg-white p-3 shadow-sm">
          <h2 className="text-sm font-semibold">AI Proposal</h2>
          <textarea value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} className="mt-2 h-24 w-full rounded border p-2 text-sm" placeholder="e.g. add 3d model and change text" />
          <button type="button" className="mt-2 w-full rounded bg-slate-900 p-2 text-sm text-white" onClick={proposeChanges}>
            Propose changes
          </button>
          {proposal ? (
            <div className="mt-3 space-y-2 text-xs">
              <p className="font-medium">{proposal.summary}</p>
              {proposal.warnings.map((warning) => (
                <p key={warning} className="text-amber-700">⚠ {warning}</p>
              ))}
              <pre className="max-h-40 overflow-auto rounded bg-slate-100 p-2">{JSON.stringify(proposal.patch, null, 2)}</pre>
              <div className="flex gap-2">
                <button type="button" className="rounded bg-green-600 px-3 py-1 text-white" onClick={() => { setLayout(proposal.nextLayout); setProposal(null); }}>
                  Apply proposal
                </button>
                <button type="button" className="rounded bg-slate-200 px-3 py-1" onClick={() => setProposal(null)}>
                  Reject
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {status ? <p className="rounded bg-white p-2 text-xs text-slate-700 shadow-sm">{status}</p> : null}
      </section>
    </main>
  );
}
