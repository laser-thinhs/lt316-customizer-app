type Job = {
  id: string;
  status: string;
  productProfile: { name: string; sku: string };
  machineProfile: { name: string; lens: string };
  createdAt: string;
};

export default function JobSummaryCard({ job }: { job: Job }) {
  return (
    <div className="rounded-lg border border-sky-300/35 bg-slate-900/55 p-3">
      <h2 className="text-sm font-semibold text-slate-100">Job Created</h2>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-100/90">
        <div className="rounded border border-sky-900/60 bg-slate-950/50 px-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-sky-200/70">Job ID</dt>
          <dd className="mt-1 break-all font-medium text-slate-100">{job.id}</dd>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-sky-900/60 bg-slate-950/50 px-2 py-1.5">
            <dt className="text-[10px] uppercase tracking-wide text-sky-200/70">Status</dt>
            <dd className="mt-1 font-medium text-slate-100">{job.status}</dd>
          </div>
          <div className="rounded border border-sky-900/60 bg-slate-950/50 px-2 py-1.5">
            <dt className="text-[10px] uppercase tracking-wide text-sky-200/70">Created</dt>
            <dd className="mt-1 font-medium text-slate-100">{new Date(job.createdAt).toLocaleString()}</dd>
          </div>
        </div>
        <div className="rounded border border-sky-900/60 bg-slate-950/50 px-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-sky-200/70">Product</dt>
          <dd className="mt-1 font-medium text-slate-100">
            {job.productProfile.name} ({job.productProfile.sku})
          </dd>
        </div>
        <div className="rounded border border-sky-900/60 bg-slate-950/50 px-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-sky-200/70">Machine</dt>
          <dd className="mt-1 font-medium text-slate-100">
            {job.machineProfile.name} / {job.machineProfile.lens}
          </dd>
        </div>
      </dl>
    </div>
  );
}
