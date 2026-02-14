"use client";

type ProductProfile = {
  id: string;
  name: string;
  sku: string;
};

type Props = {
  products: ProductProfile[];
  value: string;
  onChange: (id: string) => void;
};

export default function ProductSelector({ products, value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label htmlFor="productProfile" className="block text-sm font-medium text-slate-700">
        Product Profile
      </label>
      <select
        id="productProfile"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select a profile
        </option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.sku})
          </option>
        ))}
      </select>
    </div>
  );
}
