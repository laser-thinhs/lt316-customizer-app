"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DesignJob, JobStatus } from "@/core/v2/types";

const statuses: JobStatus[] = ["draft", "submitted", "in_review", "production_ready", "completed"];

const statusClass: Record<JobStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  production_ready: "bg-emerald-100 text-emerald-700",
  completed: "bg-indigo-100 text-indigo-700"
};

export default function AdminJobsDashboardClient() {
  const [active, setActive] = useState<DesignJob[]>([]);
  const [archive, setArchive] = useState<DesignJob[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all");

  async function load() {
    const res = await fetch("/api/admin/design-jobs/overview");
    const payload = await res.json();
    setActive(payload.data?.active ?? []);
    setArchive(payload.data?.archive ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function updateStatus(jobId: string, status: JobStatus) {
    await fetch(`/api/admin/design-jobs/${jobId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    await load();
  }

  const filterRows = (rows: DesignJob[]) => rows.filter((job) => {
    const searchBlob = `${job.id} ${job.objectDefinitionId} ${job.colorId ?? ""}`.toLowerCase();
    const queryMatches = searchBlob.includes(query.toLowerCase());
    const statusMatches = statusFilter === "all" || job.status === statusFilter;
    return queryMatches && statusMatches;
  });

  const filteredActive = useMemo(() => filterRows(active), [active, query, statusFilter]);
  const filteredArchive = useMemo(() => filterRows(archive), [archive, query, statusFilter]);

  const table = (rows: DesignJob[]) => <div className="overflow-x-auto rounded border">
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
        <tr>
          <th className="px-3 py-2">Job ID</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Object/Color</th><th className="px-3 py-2">Updated</th><th className="px-3 py-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((job) => <tr key={job.id} className="border-t">
          <td className="px-3 py-2"><Link className="text-blue-700 underline" href={`/admin/jobs/${job.id}`}>{job.id}</Link></td>
          <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${statusClass[job.status]}`}>{job.status}</span></td>
          <td className="px-3 py-2">{job.objectDefinitionId} {job.colorId ? `• ${job.colorId}` : ""}</td>
          <td className="px-3 py-2">{new Date(job.updatedAt).toLocaleString()}</td>
          <td className="px-3 py-2">
            <div className="flex flex-wrap gap-1">
              <button className="rounded border px-2 py-1 text-xs" onClick={() => void updateStatus(job.id, "in_review")}>Mark In Review</button>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => void updateStatus(job.id, "production_ready")}>Mark Production Ready</button>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => void updateStatus(job.id, "completed")}>Mark Completed</button>
            </div>
          </td>
        </tr>)}
      </tbody>
    </table>
  </div>;

  return <div className="space-y-4 p-6">
    <h1 className="text-2xl font-semibold">Admin Jobs Dashboard</h1>
    <div className="flex flex-wrap gap-2">
      <input className="rounded border px-3 py-2 text-sm" placeholder="Search job ID, object, color" value={query} onChange={(e) => setQuery(e.target.value)} />
      <select className="rounded border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | JobStatus)}>
        <option value="all">All statuses</option>
        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <Link href="/admin/bed" className="rounded border px-3 py-2 text-sm">Bed presets</Link>
      <Link href="/admin/assets" className="rounded border px-3 py-2 text-sm">Admin assets</Link>
    </div>
    <section className="space-y-2">
      <h2 className="text-lg font-medium">Active Jobs</h2>
      {table(filteredActive)}
    </section>
    <section className="space-y-2">
      <h2 className="text-lg font-medium">Archive</h2>
      {table(filteredArchive)}
    </section>
  </div>;
}
