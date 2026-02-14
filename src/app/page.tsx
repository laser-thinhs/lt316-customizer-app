"use client";

import { useEffect, useState } from "react";
import ProductSelector from "@/components/ProductSelector";
import JobSummaryCard from "@/components/JobSummaryCard";
import { useUIStore } from "@/store/ui.store";

type ProductProfile = { id: string; name: string; sku: string };
type MachineProfile = { id: string; name: string; lens: string };

export default function HomePage() {
  const [products, setProducts] = useState<ProductProfile[]>([]);
  const [machine, setMachine] = useState<MachineProfile | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { isCreatingJob, setCreatingJob } = useUIStore();

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/product-profiles");
      const json = await res.json();
      const items = json.data as ProductProfile[];
      setProducts(items);
      if (items[0]) setSelectedProductId(items[0].id);

      // Layer 1 shortcut: known seeded machine id.
      setMachine({
        id: "fiber-galvo-300-lens-default",
        name: "Fiber Galvo 300 Lens",
        lens: "300mm"
      });
    })();
  }, []);

  const createJob = async () => {
    if (!selectedProductId || !machine?.id) return;
    setError(null);
    setCreatingJob(true);

    try {
      const res = await fetch("/api/design-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productProfileId: selectedProductId,
          machineProfileId: machine.id,
          placementJson: {
            widthMm: 50,
            heightMm: 50,
            offsetXMm: 0,
            offsetYMm: 0,
            rotationDeg: 0,
            anchor: "center"
          }
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to create job");
      setJob(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreatingJob(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">LT316 Proof Builder</h1>
          <p className="text-sm text-slate-600">
            Layer 1 foundation: profile selection + draft design job creation.
          </p>
        </header>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <ProductSelector
            products={products}
            value={selectedProductId}
            onChange={setSelectedProductId}
          />

          <button
            onClick={createJob}
            disabled={isCreatingJob || !selectedProductId}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingJob ? "Creating Job..." : "New Job"}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>

        {job && <JobSummaryCard job={job} />}
      </div>
    </main>
  );
}
