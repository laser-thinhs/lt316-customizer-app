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

  const { isCreatingJob, setCreatingJob } = useUIStore();

  const resolvedSelectedProductId = useMemo(() => {
    if (products.length === 0) return "";
    return products.some((p) => p.id === selectedProductId)
      ? selectedProductId
      : products[0].id;
  }, [products, selectedProductId]);

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
        throw new Error(
          (json as { error?: { message?: string } })?.error?.message || "Failed to create job"
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
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">LT316 Proof Builder</h1>
          <p className="text-sm text-slate-600">
            Layer 2.1 foundation: text objects, typography controls, and deterministic mm placement.
          </p>
        </header>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
              Boolean(productsError)
            }
            className="
              w-full rounded-md bg-slate-900 px-4 py-2
              text-sm font-medium text-white
              disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            {isCreatingJob ? "Creating Job..." : "New Job"}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>

        {job && (
          <>
            <JobSummaryCard job={job} />
            <PlacementEditor
              designJobId={job.id}
              placement={job.placementJson}
              onUpdated={(placementJson) => setJob((prev) => (prev ? { ...prev, placementJson } : prev))}
            />
          </>
        )}
      </div>
    </main>
  );
}
