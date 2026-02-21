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
      <label htmlFor="productProfile" className="block text-sm font-medium text-slate-200">
        Product Profile
      </label>
      <select
        id="productProfile"
        className="
          w-full rounded-md border border-sky-300/35 bg-slate-900/70
          px-3 py-2 text-sm text-slate-100 outline-none transition-colors
          focus:border-sky-400 focus:bg-slate-900
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
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      {isEmpty ? (
        <p className="text-xs text-sky-300">Seed product profiles before creating a design job.</p>
      ) : null}
    </div>
  );
}
