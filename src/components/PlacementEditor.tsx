"use client";

import { useMemo, useState } from "react";
import { placementSchema } from "@/schemas/placement";

type Placement = {
  widthMm: number;
  heightMm: number;
  offsetXMm: number;
  offsetYMm: number;
  rotationDeg: number;
  anchor: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

type Props = {
  designJobId: string;
  placement: Placement;
  onUpdated: (placement: Placement) => void;
};

const fields: Array<{ key: keyof Placement; label: string; step?: string }> = [
  { key: "widthMm", label: "Width (mm)", step: "0.1" },
  { key: "heightMm", label: "Height (mm)", step: "0.1" },
  { key: "offsetXMm", label: "Offset X (mm)", step: "0.1" },
  { key: "offsetYMm", label: "Offset Y (mm)", step: "0.1" },
  { key: "rotationDeg", label: "Rotation (deg)", step: "0.1" }
];

export default function PlacementEditor({ designJobId, placement, onUpdated }: Props) {
  const [form, setForm] = useState<Placement>(placement);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  const validation = useMemo(() => placementSchema.safeParse(form), [form]);

  const onSave = async () => {
    const parsed = placementSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
        const path = issue.path[0];
        if (typeof path === "string") {
          acc[path] = issue.message;
        }
        return acc;
      }, {});
      setErrors(nextErrors);
      setStatusMessage("Fix validation issues before saving.");
      return;
    }

    setErrors({});
    setStatusMessage(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/design-jobs/${designJobId}/placement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placementJson: parsed.data })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to save placement");
      }
      onUpdated(json.data.placementJson as Placement);
      setStatusMessage("Placement saved.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">Placement (mm)</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="space-y-1 text-sm">
            <span className="text-slate-700">{field.label}</span>
            <input
              type="number"
              step={field.step}
              value={form[field.key] as number}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, [field.key]: Number(event.target.value) }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
            {errors[field.key] ? <span className="text-xs text-red-600">{errors[field.key]}</span> : null}
          </label>
        ))}
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Anchor</span>
          <select
            value={form.anchor}
            onChange={(event) => setForm((prev) => ({ ...prev, anchor: event.target.value as Placement["anchor"] }))}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="center">center</option>
            <option value="top-left">top-left</option>
            <option value="top-right">top-right</option>
            <option value="bottom-left">bottom-left</option>
            <option value="bottom-right">bottom-right</option>
          </select>
          {errors.anchor ? <span className="text-xs text-red-600">{errors.anchor}</span> : null}
        </label>
      </div>

      {!validation.success ? (
        <p className="text-xs text-amber-700">Values are currently invalid and cannot be saved.</p>
      ) : null}

      <button
        onClick={onSave}
        disabled={isSaving}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Save Placement"}
      </button>

      {statusMessage ? <p className="text-xs text-slate-700">{statusMessage}</p> : null}
    </section>
  );
}
