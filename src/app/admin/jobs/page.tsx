"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type JobListItem = { id: string; status: string; updatedAt: string };

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);

  useEffect(() => {
    fetch("/api/admin/design-jobs?status=submitted")
      .then((res) => res.json())
      .then((payload) => setJobs(payload.data ?? []));
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Submitted Jobs</h1>
      <ul className="space-y-2">
        {jobs.map((job) => (
          <li key={job.id} className="rounded border p-2">
            <Link className="text-blue-700 underline" href={`/admin/jobs/${job.id}`}>{job.id}</Link> · {job.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
