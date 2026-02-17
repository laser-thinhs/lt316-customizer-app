"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  type ProofComposition,
  type ProofCompositionItem,
  type ProofTemplateId,
  createSingleItemComposition,
  proofTemplatePresets
} from "@/schemas/proof";

const DEFAULT_TEMPLATE: ProofTemplateId = "40oz_tumbler_wrap";

function createTextItem(): ProofCompositionItem {
  return {
    id: crypto.randomUUID(),
    name: "Text",
    type: "text",
    text: "Sample",
    transformMm: { x: 140, y: 55, scale: 1, rotation: 0, flipH: false, flipV: false },
    opacity: 1,
    locked: false,
    hidden: false,
    blendMode: "normal"
  };
}

export default function ProofPage() {
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [jobId] = useState<string>(searchParams.get("jobId") ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [composition, setComposition] = useState<ProofComposition>(() => {
    const svgAssetId = searchParams.get("svgAssetId");
    if (svgAssetId) return createSingleItemComposition({ svgAssetId, templateId: DEFAULT_TEMPLATE });
    return { templateId: DEFAULT_TEMPLATE, dpi: 300, items: [], order: [], groups: [] };
  });
  const [status, setStatus] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const selected = composition.items.find((item) => item.id === selectedIds[0]);

  useEffect(() => {
    if (!jobId) return;
    void (async () => {
      const res = await fetch(`/api/proof/jobs/${jobId}/placement`);
      if (!res.ok) return;
      const json = await res.json();
      setComposition(json.data);
    })();
  }, [jobId]);

  const persist = async (next: ProofComposition) => {
    if (!jobId) return;
    await fetch(`/api/proof/jobs/${jobId}/placement`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ composition: next })
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const template = proofTemplatePresets[composition.templateId];
    const previewWidth = 900;
    const previewHeight = Math.round((template.heightMm / template.widthMm) * previewWidth);
    const pxPerMm = previewWidth / template.widthMm;
    canvas.width = previewWidth;
    canvas.height = previewHeight;

    ctx.clearRect(0, 0, previewWidth, previewHeight);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    composition.order.forEach((id) => {
      const item = composition.items.find((entry) => entry.id === id);
      if (!item || item.hidden) return;
      const x = item.transformMm.x * pxPerMm;
      const y = item.transformMm.y * pxPerMm;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((item.transformMm.rotation * Math.PI) / 180);
      const sx = item.transformMm.scale * (item.transformMm.flipH ? -1 : 1);
      const sy = item.transformMm.scale * (item.transformMm.flipV ? -1 : 1);
      ctx.scale(sx, sy);
      ctx.globalAlpha = item.opacity;
      ctx.strokeStyle = "#0f172a";
      ctx.fillStyle = "#334155";
      if (item.type === "text") {
        ctx.font = "24px Inter, Arial";
        ctx.fillText(item.text, -60, 0);
        ctx.strokeRect(-66, -20, Math.max(120, item.text.length * 12), 32);
      } else {
        ctx.strokeRect(-80, -40, 160, 80);
        ctx.fillText(item.type.toUpperCase(), -30, 4);
      }
      if (selectedIds.includes(item.id)) {
        ctx.strokeStyle = "#2563eb";
        ctx.strokeRect(-84, -44, 168, 88);
      }
      ctx.restore();
    });
  }, [composition, selectedIds]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!selected || selected.locked) return;
      const step = event.shiftKey ? 5 : 1;
      const updates: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]
      };
      const delta = updates[event.key];
      if (!delta) return;
      event.preventDefault();
      const next = {
        ...composition,
        items: composition.items.map((item) => item.id === selected.id ? { ...item, transformMm: { ...item.transformMm, x: item.transformMm.x + delta[0], y: item.transformMm.y + delta[1] } } : item)
      };
      setComposition(next);
      void persist(next);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [composition, selected]);

  const addSvgById = () => {
    const assetId = prompt("SVG asset id");
    if (!assetId) return;
    const item: ProofCompositionItem = { id: crypto.randomUUID(), name: `SVG ${composition.items.length + 1}`, type: "svg", assetId, transformMm: { x: 140, y: 55, scale: 1, rotation: 0, flipH: false, flipV: false }, opacity: 1, locked: false, hidden: false, blendMode: "normal" };
    const next = { ...composition, items: [...composition.items, item], order: [...composition.order, item.id] };
    setComposition(next);
    setSelectedIds([item.id]);
    void persist(next);
  };

  const addImage = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/proof/jobs", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) return;
      const item: ProofCompositionItem = { id: crypto.randomUUID(), name: file.name, type: "image", assetId: json.data.id, transformMm: { x: 140, y: 55, scale: 1, rotation: 0, flipH: false, flipV: false }, opacity: 1, locked: false, hidden: false, blendMode: "normal" };
      const next = { ...composition, items: [...composition.items, item], order: [...composition.order, item.id] };
      setComposition(next);
      setSelectedIds([item.id]);
      void persist(next);
    };
    input.click();
  };

  const addText = () => {
    const item = createTextItem();
    const next = { ...composition, items: [...composition.items, item], order: [...composition.order, item.id] };
    setComposition(next);
    setSelectedIds([item.id]);
    void persist(next);
  };

  const generateProof = async () => {
    setStatus("Rendering proof...");
    const res = await fetch("/api/proof/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ composition }) });
    const json = await res.json();
    if (!res.ok) return setStatus(json?.error?.message ?? "failed");
    setProofUrl(json.data.proofUrl);
    setStatus("Proof rendered");
  };

  const exportPackage = async () => {
    if (!jobId) return setStatus("Missing jobId");
    setStatus("Exporting...");
    const res = await fetch("/api/proof/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) });
    const json = await res.json();
    if (!res.ok) return setStatus(json?.error?.message ?? "failed");
    setZipUrl(json.data.exportUrl);
    setProofUrl(json.data.proofUrl);
    setStatus("Exported");
  };

  const selectedGroup = useMemo(() => composition.groups?.find((g) => selectedIds.every((id) => g.itemIds.includes(id))), [composition.groups, selectedIds]);

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Proof Composer</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <section className="rounded border p-4">
          <canvas ref={canvasRef} className="h-auto w-full rounded border" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded border px-3 py-1" onClick={addSvgById}>Add SVG</button>
            <button className="rounded border px-3 py-1" onClick={addImage}>Add Image</button>
            <button className="rounded border px-3 py-1" onClick={addText}>Add Text</button>
            <button className="rounded border px-3 py-1" onClick={generateProof}>Generate Proof</button>
            <button className="rounded border px-3 py-1" onClick={exportPackage}>Export ZIP</button>
            <Link className="rounded border px-3 py-1" href="/tracer">Back</Link>
          </div>
          {proofUrl ? <a className="mt-2 block text-sm text-blue-700 underline" href={proofUrl}>Download proof</a> : null}
          {zipUrl ? <a className="mt-2 block text-sm text-blue-700 underline" href={zipUrl}>Download package</a> : null}
          {status ? <p className="mt-2 text-sm">{status}</p> : null}
        </section>

        <aside className="rounded border p-3">
          <h2 className="mb-2 font-medium">Layers</h2>
          <ul className="space-y-2">
            {composition.order.map((id) => {
              const item = composition.items.find((entry) => entry.id === id);
              if (!item) return null;
              return (
                <li key={id} draggable onDragStart={() => setDragId(id)} onDragOver={(e) => e.preventDefault()} onDrop={() => {
                  if (!dragId || dragId === id) return;
                  const nextOrder = composition.order.filter((entry) => entry !== dragId);
                  nextOrder.splice(nextOrder.indexOf(id), 0, dragId);
                  const next = { ...composition, order: nextOrder };
                  setComposition(next);
                  void persist(next);
                }} className={`rounded border p-2 text-sm ${selectedIds.includes(id) ? "border-blue-600" : ""}`}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSelectedIds([id])}>{item.name}</button>
                    <button onClick={() => { const next = { ...composition, items: composition.items.map((i) => i.id === id ? { ...i, hidden: !i.hidden } : i) }; setComposition(next); void persist(next); }}>{item.hidden ? "🙈" : "👁"}</button>
                    <button onClick={() => { const next = { ...composition, items: composition.items.map((i) => i.id === id ? { ...i, locked: !i.locked } : i) }; setComposition(next); void persist(next); }}>{item.locked ? "🔒" : "🔓"}</button>
                  </div>
                </li>
              );
            })}
          </ul>

          {selected ? <div className="mt-3 space-y-2 border-t pt-3 text-sm">
            <div className="font-medium">Selected</div>
            <input className="w-full rounded border p-1" value={selected.name} onChange={(e) => {
              const next = { ...composition, items: composition.items.map((item) => item.id === selected.id ? { ...item, name: e.target.value } : item) };
              setComposition(next);
            }} onBlur={() => void persist(composition)} />
            {selected.type === "text" ? <input className="w-full rounded border p-1" value={selected.text} onChange={(e) => setComposition((prev) => ({ ...prev, items: prev.items.map((item) => item.id === selected.id && item.type === "text" ? { ...item, text: e.target.value } : item) }))} onBlur={() => void persist(composition)} /> : null}
            <label>X mm<input className="w-full rounded border p-1" type="number" value={selected.transformMm.x} onChange={(e) => setComposition((prev) => ({ ...prev, items: prev.items.map((item) => item.id === selected.id ? { ...item, transformMm: { ...item.transformMm, x: Number(e.target.value) } } : item) }))} onBlur={() => void persist(composition)} /></label>
            <label>Y mm<input className="w-full rounded border p-1" type="number" value={selected.transformMm.y} onChange={(e) => setComposition((prev) => ({ ...prev, items: prev.items.map((item) => item.id === selected.id ? { ...item, transformMm: { ...item.transformMm, y: Number(e.target.value) } } : item) }))} onBlur={() => void persist(composition)} /></label>
            <label>Scale<input className="w-full rounded border p-1" type="number" step="0.1" value={selected.transformMm.scale} onChange={(e) => setComposition((prev) => ({ ...prev, items: prev.items.map((item) => item.id === selected.id ? { ...item, transformMm: { ...item.transformMm, scale: Number(e.target.value) } } : item) }))} onBlur={() => void persist(composition)} /></label>
            <label>Rotation<input className="w-full rounded border p-1" type="number" value={selected.transformMm.rotation} onChange={(e) => setComposition((prev) => ({ ...prev, items: prev.items.map((item) => item.id === selected.id ? { ...item, transformMm: { ...item.transformMm, rotation: Number(e.target.value) } } : item) }))} onBlur={() => void persist(composition)} /></label>
            <div className="flex gap-2">
              <button className="rounded border px-2" onClick={() => {
                const clone = { ...selected, id: crypto.randomUUID(), name: `${selected.name} copy` };
                const next = { ...composition, items: [...composition.items, clone], order: [...composition.order, clone.id] };
                setComposition(next); void persist(next);
              }}>Duplicate</button>
              <button className="rounded border px-2" onClick={() => {
                const next = { ...composition, items: composition.items.filter((item) => item.id !== selected.id), order: composition.order.filter((id) => id !== selected.id) };
                setSelectedIds([]); setComposition(next); void persist(next);
              }}>Delete</button>
            </div>
            <div className="flex gap-2">
              <button className="rounded border px-2" onClick={() => {
                if (selectedIds.length < 2) return;
                const group = { id: crypto.randomUUID(), name: `Group ${composition.groups?.length ?? 0 + 1}`, itemIds: selectedIds };
                const next = { ...composition, groups: [...(composition.groups ?? []), group] };
                setComposition(next); void persist(next);
              }}>Group</button>
              <button className="rounded border px-2" disabled={!selectedGroup} onClick={() => {
                const next = { ...composition, groups: (composition.groups ?? []).filter((g) => g.id !== selectedGroup?.id) };
                setComposition(next); void persist(next);
              }}>Ungroup</button>
            </div>
          </div> : null}
        </aside>
      </div>
    </main>
  );
}
