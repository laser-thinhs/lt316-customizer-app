"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createDefaultLayout, parseLayoutFromUnknown } from "@/lib/page-layout/schemas";
import { PageLayout, SectionType } from "@/lib/page-layout/types";
import { PageLayoutRenderer } from "@/sections/PageLayoutRenderer";
import { listSectionDefinitions, sectionRegistry } from "@/sections/registry";
import { SettingsFieldDefinition } from "@/sections/types";

type Props = {
  slug: string;
};

type ButtonRowInput = {
  label: string;
  href: string;
};

function createSectionId(type: SectionType) {
  return `${type}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const cloned = [...items];
  const [moved] = cloned.splice(fromIndex, 1);
  cloned.splice(toIndex, 0, moved);
  return cloned;
}

function parseButtonsInput(value: string): ButtonRowInput[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, href] = line.split("|").map((part) => part.trim());
      return { label: label ?? "", href: href ?? "" };
    })
    .filter((button) => button.label);
}

function formatButtonsInput(value: unknown): string {
  if (!Array.isArray(value)) return "";

  return value
    .map((button) => {
      if (!button || typeof button !== "object") return null;
      const label = typeof (button as { label?: unknown }).label === "string" ? (button as { label: string }).label : "";
      const href = typeof (button as { href?: unknown }).href === "string" ? (button as { href: string }).href : "";
      return `${label}|${href}`;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export default function PageEditorClient({ slug }: Props) {
  const [layout, setLayout] = useState<PageLayout>(() => createDefaultLayout(slug));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Loading...");
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const selectedSection = useMemo(() => layout.sections.find((item) => item.id === selectedId) ?? null, [layout.sections, selectedId]);

  const loadLayout = useCallback(async () => {
    setStatus("Loading...");
    setError(null);

    try {
      const response = await fetch(`/api/page-layout/${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load layout");
      }
      const payload = await response.json();
      const parsed = parseLayoutFromUnknown(payload.layout, slug);
      setLayout(parsed.layout);
      setSelectedId(parsed.layout.sections[0]?.id ?? null);
      setError(parsed.error ?? payload.error ?? null);
      setStatus("Loaded");
    } catch {
      const fallback = createDefaultLayout(slug);
      setLayout(fallback);
      setSelectedId(fallback.sections[0]?.id ?? null);
      setError("Could not load layout");
      setStatus("Loaded default");
    }
  }, [slug]);

  useEffect(() => {
    void loadLayout();
  }, [loadLayout]);

  function updateSelectedSetting(field: SettingsFieldDefinition, rawValue: string | number | boolean) {
    if (!selectedSection) return;

    const value =
      field.key === "buttons" && typeof rawValue === "string"
        ? parseButtonsInput(rawValue)
        : field.kind === "number" && typeof rawValue === "string"
          ? (rawValue ? Number(rawValue) : 0)
          : rawValue;

    setLayout((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === selectedSection.id
          ? {
              ...section,
              settings: {
                ...(section.settings as Record<string, unknown>),
                [field.key]: value
              }
            }
          : section
      )
    }));
  }

  function addSection(type: SectionType) {
    const definition = sectionRegistry[type];
    const id = createSectionId(type);

    setLayout((current) => ({
      ...current,
      sections: [...current.sections, { id, type, settings: definition.defaultSettings, hidden: false }]
    }));
    setSelectedId(id);
    setShowAdd(false);
  }

  function duplicateSection(id: string) {
    setLayout((current) => {
      const index = current.sections.findIndex((section) => section.id === id);
      if (index < 0) return current;
      const section = current.sections[index];
      const duplicated = {
        ...section,
        id: createSectionId(section.type)
      };

      const sections = [...current.sections];
      sections.splice(index + 1, 0, duplicated);

      return {
        ...current,
        sections
      };
    });
  }

  async function saveLayout() {
    setStatus("Saving...");
    setError(null);

    try {
      const response = await fetch(`/api/page-layout/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Save failed");
      }
      setLayout(payload.layout);
      setStatus("Saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
      setStatus("Save failed");
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-12 gap-4 bg-slate-100 p-4">
      <aside className="col-span-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Sections</h2>
          <button type="button" className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white" onClick={() => setShowAdd(true)}>
            Add section
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {layout.sections.map((section, index) => (
            <div
              key={section.id}
              draggable
              onDragStart={() => setDraggingId(section.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (!draggingId || draggingId === section.id) return;
                setLayout((current) => {
                  const from = current.sections.findIndex((entry) => entry.id === draggingId);
                  const to = current.sections.findIndex((entry) => entry.id === section.id);
                  if (from < 0 || to < 0) return current;
                  return { ...current, sections: moveItem(current.sections, from, to) };
                });
                setDraggingId(null);
              }}
              className={`rounded border p-2 text-xs ${selectedId === section.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}
            >
              <button type="button" className="w-full text-left" onClick={() => setSelectedId(section.id)}>
                <span className="mr-2 text-slate-400">⠿</span>
                {index + 1}. {sectionRegistry[section.type].label} {section.hidden ? "(Hidden)" : ""}
              </button>
              <div className="mt-2 flex gap-2">
                <button type="button" className="rounded border px-2 py-0.5" onClick={() => duplicateSection(section.id)}>Duplicate</button>
                <button
                  type="button"
                  className="rounded border px-2 py-0.5"
                  onClick={() =>
                    setLayout((current) => ({
                      ...current,
                      sections: current.sections.map((entry) =>
                        entry.id === section.id ? { ...entry, hidden: !entry.hidden } : entry
                      )
                    }))
                  }
                >
                  {section.hidden ? "Show" : "Hide"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className="rounded border px-3 py-1 text-xs" onClick={() => void loadLayout()}>Revert</button>
          <button type="button" className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white" onClick={() => void saveLayout()}>
            Save
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">{status}</p>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </aside>

      <main className="col-span-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Live preview /p/{slug}</h2>
        <PageLayoutRenderer layout={layout} selectedId={selectedId} onSelectSection={setSelectedId} editable />
      </main>

      <aside className="col-span-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Settings</h2>
        {!selectedSection ? (
          <p className="mt-2 text-xs text-slate-600">Select a section to edit settings.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {sectionRegistry[selectedSection.type].fields.map((field) => {
              const value = (selectedSection.settings as Record<string, unknown>)[field.key];

              if (field.kind === "textarea") {
                return (
                  <label key={field.key} className="block text-xs">
                    <span className="mb-1 block font-medium text-slate-700">{field.label}</span>
                    <textarea
                      value={field.key === "buttons" ? formatButtonsInput(value) : typeof value === "string" ? value : ""}
                      onChange={(event) => updateSelectedSetting(field, event.target.value)}
                      className="w-full rounded border border-slate-300 p-2"
                      rows={field.key === "buttons" ? 5 : 4}
                    />
                  </label>
                );
              }

              if (field.kind === "checkbox") {
                return (
                  <label key={field.key} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) => updateSelectedSetting(field, event.target.checked)}
                    />
                    {field.label}
                  </label>
                );
              }

              if (field.kind === "select") {
                return (
                  <label key={field.key} className="block text-xs">
                    <span className="mb-1 block font-medium text-slate-700">{field.label}</span>
                    <select
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) => updateSelectedSetting(field, event.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1"
                    >
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              return (
                <label key={field.key} className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-700">{field.label}</span>
                  <input
                    type={field.kind === "number" ? "number" : field.kind === "url" ? "url" : "text"}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={typeof value === "number" ? String(value) : typeof value === "string" ? value : ""}
                    onChange={(event) => updateSelectedSetting(field, event.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1"
                  />
                </label>
              );
            })}
          </div>
        )}
      </aside>

      {showAdd ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4">
            <h3 className="text-base font-semibold text-slate-900">Add section</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {listSectionDefinitions().map((definition) => (
                <button
                  type="button"
                  key={definition.type}
                  className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => addSection(definition.type)}
                >
                  {definition.label}
                </button>
              ))}
            </div>
            <button type="button" className="mt-4 text-xs text-slate-700 underline" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
