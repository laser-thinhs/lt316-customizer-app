"use client";

import { useEffect, useMemo, useState } from "react";
import ProductSelector from "@/components/ProductSelector";
import JobSummaryCard from "@/components/JobSummaryCard";
import PlacementEditor from "@/components/PlacementEditor";
import { useUIStore } from "@/store/ui.store";
import {
  designJobResponseSchema,
  ProductProfile,
  productProfilesResponseSchema,
  type DesignJob
} from "@/schemas/api";
import { createDefaultPlacementDocument } from "@/schemas/placement";

const machine = {
  id: "fiber-galvo-300-lens-default",
  name: "Fiber Galvo 300 Lens",
  lens: "300mm"
};

export default function HomePageClient() {
  const [products, setProducts] = useState<ProductProfile[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [job, setJob] = useState<DesignJob | null>(null);
  const [isLoadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDbUnavailable, setDbUnavailable] = useState(false);

  const { isCreatingJob, setCreatingJob } = useUIStore();

  const resolvedSelectedProductId = useMemo(() => {
    if (products.length === 0) return "";
    return products.some((p) => p.id === selectedProductId)
      ? selectedProductId
      : products[0].id;
  }, [products, selectedProductId]);

  const isDbFallbackMode = useMemo(
    () => resolvedSelectedProductId.startsWith("dev-"),
    [resolvedSelectedProductId]
  );
  const isDbOfflineMode = isDbFallbackMode || isDbUnavailable;

  useEffect(() => {
    (async () => {
      setLoadingProducts(true);
      setProductsError(null);

      try {
        const res = await fetch("/api/product-profiles");
        const json: unknown = await res.json();

        if (!res.ok) {
          throw new Error("Could not fetch product profiles.");
        }

        const parsed = productProfilesResponseSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error("Unexpected product profile response shape.");
        }

        const items = parsed.data.data;
        setProducts(items);

        setSelectedProductId((prev) =>
          items.some((p) => p.id === prev) ? prev : (items[0]?.id ?? "")
        );
      } catch (fetchError) {
        setProductsError(fetchError instanceof Error ? fetchError.message : "Unknown error");
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  const createJob = async () => {
    const productProfileId = resolvedSelectedProductId;

    if (!productProfileId || !machine?.id) {
      setError("No valid product profile selected.");
      return;
    }

    if (isDbOfflineMode) {
      setError("Database is offline. Start PostgreSQL (docker compose up -d db) to create jobs.");
      return;
    }

    setError(null);
    setCreatingJob(true);

    try {
      const res = await fetch("/api/design-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productProfileId,
          machineProfileId: machine.id,
          placementJson: createDefaultPlacementDocument()
        })
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const apiError = (json as { error?: { message?: string; code?: string } })?.error;
        if (res.status === 503 || apiError?.code === "DATABASE_UNAVAILABLE") {
          setDbUnavailable(true);
          throw new Error("Database is offline. Start PostgreSQL (docker compose up -d db) to create jobs.");
        }
        throw new Error(
          apiError?.message || "Failed to create job"
        );
      }

      const parsed = designJobResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error("Unexpected job payload returned from API.");
      }

      setJob(parsed.data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreatingJob(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_55%_20%,rgba(59,130,246,0.28)_0%,rgba(8,47,73,0.42)_26%,rgba(2,6,23,0.94)_62%),linear-gradient(180deg,#030712_0%,#020617_100%)] px-4 py-6 text-slate-100 sm:py-10">
      <div className="mx-auto w-full max-w-screen-2xl space-y-8">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-300/80">Laser Things 316</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Precision Jigs & Laser-Ready Templates</h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-300">
            Layer 2.1 foundation: text objects, typography controls, and deterministic mm placement.
          </p>
        </header>

        <section className="mx-auto grid w-full max-w-5xl gap-6 rounded-2xl border border-sky-400/25 bg-slate-950/55 p-4 shadow-[0_0_0_1px_rgba(56,189,248,0.18),0_22px_70px_rgba(2,6,23,0.72)] backdrop-blur-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">Start a new job</h2>
            <ProductSelector
              products={products}
              value={resolvedSelectedProductId}
              onChange={setSelectedProductId}
              isLoading={isLoadingProducts}
              error={productsError}
            />

            <button
              onClick={createJob}
              disabled={
                isCreatingJob ||
                !resolvedSelectedProductId ||
                isLoadingProducts ||
                Boolean(productsError) ||
                isDbOfflineMode
              }
              className="
                w-full rounded-md border border-fuchsia-300/45 bg-fuchsia-600/70 px-4 py-2
                text-sm font-semibold text-white transition-colors hover:bg-fuchsia-500/80
                disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              {isDbOfflineMode
                ? "Database Offline - Start DB"
                : isCreatingJob
                  ? "Creating Job..."
                  : "New Job"}
            </button>

            {error && <p className="text-sm text-rose-300">{error}</p>}
            {isDbOfflineMode && !error ? (
              <p className="text-sm text-amber-300">Start PostgreSQL to enable job creation.</p>
            ) : null}
          </div>

          <aside className="space-y-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-950/25 p-4 text-sm text-fuchsia-100">
            {job ? (
              <>
                <h3 className="font-semibold text-fuchsia-50">Current job</h3>
                <JobSummaryCard job={job} />
                <p className="rounded-md border border-fuchsia-300/30 bg-fuchsia-950/35 px-3 py-2 text-xs text-fuchsia-200">
                  Continue editing in the workspace below. Create a new job at any time from the left panel.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-fuchsia-50">Workflow</h3>
                <ol className="list-decimal space-y-1 pl-5 text-fuchsia-100/90">
                  <li>Select a product profile.</li>
                  <li>Create a job with the default machine.</li>
                  <li>Adjust text, artwork, and placement.</li>
                  <li>Run preflight before export.</li>
                </ol>
                <p className="rounded-md border border-fuchsia-300/30 bg-fuchsia-950/35 px-3 py-2 text-xs text-fuchsia-200">
                  EXPERIMENTAL: Dimensions may need adjustment. Verify before engraving.
                </p>
              </>
            )}
          </aside>
        </section>

        {job && (
          <PlacementEditor
            designJobId={job.id}
            placement={job.placementJson}
            modelImageUrl={job.previewImagePath ?? undefined}
            modelMaskUrl={job.previewMaskImagePath ?? job.productProfile.toolOutlineSvgPath ?? undefined}
            onUpdated={(placementJson) => setJob((prev) => (prev ? { ...prev, placementJson } : prev))}
          />
        )}
      </div>
    </main>
  );
}
