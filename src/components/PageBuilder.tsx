"use client";

import { useState } from "react";
import { ChevronDown, Plus, Settings, Grid3x3, Home } from "lucide-react";

type Section = {
  id: string;
  name: string;
  type: "hero" | "featured" | "collection" | "text" | "gallery" | "custom";
  backgroundColor?: string;
  backgroundImage?: string;
  textColor?: string;
  padding?: string;
};

type Page = {
  name: string;
  sections: Section[];
};

export default function PageBuilder() {
  const [page, setPage] = useState<Page>({
    name: "Home page",
    sections: [
      {
        id: "hero-1",
        name: "Hero section",
        type: "hero",
        backgroundColor: "#1a1a2e",
        textColor: "#ffffff",
        padding: "py-16"
      }
    ]
  });

  const [selectedId, setSelectedId] = useState<string | null>("hero-1");
  const [showColorPicker, setShowColorPicker] = useState(false);

  const selected = page.sections.find((s) => s.id === selectedId);

  const addSection = () => {
    const newSection: Section = {
      id: `section-${Date.now()}`,
      name: "New section",
      type: "custom",
      backgroundColor: "#ffffff",
      textColor: "#000000",
      padding: "py-8"
    };
    setPage({ ...page, sections: [...page.sections, newSection] });
    setSelectedId(newSection.id);
  };

  const removeSection = (id: string) => {
    setPage({ ...page, sections: page.sections.filter((s) => s.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const updateSection = (id: string, updates: Partial<Section>) => {
    setPage({
      ...page,
      sections: page.sections.map((s) => (s.id === id ? { ...s, ...updates } : s))
    });
  };

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Left Sidebar - Structure */}
      <div className="w-80 bg-white border-r border-slate-200 overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <Home size={20} className="text-blue-600" />
            <h1 className="text-lg font-semibold">{page.name}</h1>
          </div>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-200">
            <Settings size={16} />
            Page settings
          </button>
        </div>

        <div className="p-4 space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Sections</h2>
          {page.sections.map((section) => (
            <div key={section.id}>
              <button
                onClick={() => setSelectedId(section.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition ${
                  selectedId === section.id
                    ? "bg-blue-100 text-blue-900 border border-blue-300"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Grid3x3 size={16} />
                <span className="flex-1 text-left">{section.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSection(section.id);
                  }}
                  className="text-slate-400 hover:text-red-600 px-1"
                >
                  ×
                </button>
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200">
          <button
            onClick={addSection}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded border border-dashed border-blue-300 text-sm font-medium"
          >
            <Plus size={16} />
            Add section
          </button>
        </div>
      </div>

      {/* Center - Live Preview */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {page.sections.map((section) => (
            <div
              key={section.id}
              onClick={() => setSelectedId(section.id)}
              className={`min-h-96 cursor-pointer transition border-2 ${
                selectedId === section.id ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent hover:border-slate-300"
              }`}
              style={{
                backgroundColor: section.backgroundColor,
                backgroundImage: section.backgroundImage ? `url(${section.backgroundImage})` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            >
              <div className={`${section.padding} px-6 h-full flex items-center justify-center`}>
                <div style={{ color: section.textColor }} className="text-center">
                  <h2 className="text-3xl font-bold mb-2">{section.name}</h2>
                  <p className="opacity-75">Click to edit • {section.type}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Sidebar - Settings */}
      <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto">
        {selected ? (
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Section name</h3>
              <input
                type="text"
                value={selected.name}
                onChange={(e) => updateSection(selected.id, { name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Section type</h3>
              <select
                value={selected.type}
                onChange={(e) => updateSection(selected.id, { type: e.target.value as Section["type"] })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="hero">Hero</option>
                <option value="featured">Featured</option>
                <option value="collection">Collection</option>
                <option value="text">Text</option>
                <option value="gallery">Gallery</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Colors</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Background color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={selected.backgroundColor || "#ffffff"}
                      onChange={(e) => updateSection(selected.id, { backgroundColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={selected.backgroundColor || "#ffffff"}
                      onChange={(e) => updateSection(selected.id, { backgroundColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Text color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={selected.textColor || "#000000"}
                      onChange={(e) => updateSection(selected.id, { textColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={selected.textColor || "#000000"}
                      onChange={(e) => updateSection(selected.id, { textColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Background image</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Image URL"
                  value={selected.backgroundImage || ""}
                  onChange={(e) => updateSection(selected.id, { backgroundImage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="w-full px-3 py-2 border border-slate-300 rounded text-sm hover:bg-slate-50">
                  Upload image
                </button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Spacing</h3>
              <select
                value={selected.padding}
                onChange={(e) => updateSection(selected.id, { padding: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="py-4">Small</option>
                <option value="py-8">Medium</option>
                <option value="py-12">Large</option>
                <option value="py-16">Extra Large</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-slate-500 text-sm">
            <p>Select a section to edit</p>
          </div>
        )}
      </div>
    </div>
  );
}
