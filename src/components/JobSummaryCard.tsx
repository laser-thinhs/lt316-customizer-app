type Job = {
  id: string;
  status: string;
  productProfile: { name: string; sku: string };
  machineProfile: { name: string; lens: string };
  createdAt: string;
};

export default function JobSummaryCard({ job }: { job: Job }) {
  return (
    <div className="rounded-xl border border-sky-400/25 bg-slate-950/50 p-4 shadow-[0_0_0_1px_rgba(56,189,248,0.16)]">
      <h2 className="text-base font-semibold text-slate-100">Job Created</h2>
      <dl className="mt-3 space-y-1 text-sm text-slate-100/85">
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Job ID</dt>
          <dd className="truncate">{job.id}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Status</dt>
          <dd>{job.status}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Product</dt>
          <dd>
            {job.productProfile.name} ({job.productProfile.sku})
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Machine</dt>
          <dd>
            {job.machineProfile.name} / {job.machineProfile.lens}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Created</dt>
          <dd>{new Date(job.createdAt).toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  );
}
