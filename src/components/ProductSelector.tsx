"use client";

import type { ProductProfile } from "@/schemas/api";

type Props = {
  products: ProductProfile[];
  value: string;
  onChange: (id: string) => void;
  isLoading?: boolean;
  error?: string | null;
};

export default function ProductSelector({ products, value, onChange, isLoading, error }: Props) {
  const isEmpty = !isLoading && !error && products.length === 0;

  return (
    <div className="space-y-2">
      <label htmlFor="productProfile" className="block text-sm font-medium text-slate-700">
        Product Profile
      </label>
      <select
        id="productProfile"
        className="
          w-full rounded-md border border-slate-300 bg-white
          px-3 py-2 text-sm outline-none focus:border-slate-500
        "
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={Boolean(isLoading || error || isEmpty)}
      >
        <option value="" disabled>
          {isLoading
            ? "Loading profiles..."
            : error
              ? "Unable to load profiles"
              : isEmpty
                ? "No profiles found"
                : "Select a profile"}
        </option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.sku})
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {isEmpty ? (
        <p className="text-xs text-amber-700">Seed product profiles before creating a design job.</p>
      ) : null}
    </div>
  );
}
