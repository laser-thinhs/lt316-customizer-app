"use client";

import { AdminAssetRecord, AdminAssetType } from "@/core/v2/types";
import { useEffect, useMemo, useState } from "react";

const types: Array<"all" | AdminAssetType> = ["all", "lightburn-system", "hatch-library", "other"];

export default function AdminAssetsClient() {
  const [assets, setAssets] = useState<AdminAssetRecord[]>([]);
  const [filter, setFilter] = useState<"all" | AdminAssetType>("all");

  async function load() {
    const query = filter === "all" ? "" : `?type=${encodeURIComponent(filter)}`;
    const res = await fetch(`/api/admin/assets${query}`);
    const payload = await res.json();
    setAssets(payload.data ?? []);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    await fetch("/api/admin/assets", { method: "POST", body: formData });
    await load();
  }

  const grouped = useMemo(() => assets.reduce<Record<string, AdminAssetRecord[]>>((acc, item) => {
    acc[item.type] = acc[item.type] ?? [];
    acc[item.type].push(item);
    return acc;
  }, {}), [assets]);

  return <div className="space-y-4 p-6">
    <h1 className="text-2xl font-semibold">Admin Assets</h1>
    <div
      className="rounded border border-dashed p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void upload(e.dataTransfer.files);
      }}
    >
      <p className="mb-2 text-sm text-slate-600">Drop files here or use picker.</p>
      <input type="file" multiple onChange={(e) => void upload(e.target.files)} className="text-sm" />
    </div>
    <div>
      <select className="rounded border px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as "all" | AdminAssetType)}>
        {types.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
    </div>
    {Object.entries(grouped).map(([type, rows]) => <section key={type} className="space-y-2">
      <h2 className="text-lg font-medium">{type}</h2>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600"><tr><th className="px-3 py-2">Filename</th><th className="px-3 py-2">Created</th><th className="px-3 py-2">Path</th></tr></thead>
          <tbody>
            {rows.map((item) => <tr key={item.id} className="border-t">
              <td className="px-3 py-2">{item.originalFilename}</td>
              <td className="px-3 py-2">{new Date(item.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2"><button className="rounded border px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(item.storedPath)}>Copy path</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>)}
  </div>;
}
