'use client';

import { useEffect, useState } from 'react';

const initialForm = {
  name: '',
  diameterMm: 0,
  heightMm: 0,
  engravingAreaWidthMm: 0,
  engravingAreaHeightMm: 0,
  speedMmPerSec: 250,
  powerPercent: 50,
  passes: 1
};

export default function AdminPage() {
  const [form, setForm] = useState(initialForm);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [status, setStatus] = useState('');

  async function loadTemplates() {
    const res = await fetch('/api/templates');
    const data = await res.json();
    setTemplates(data.templates);
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function submitTemplate(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      name: form.name,
      diameterMm: form.diameterMm,
      heightMm: form.heightMm,
      engravingAreaWidthMm: form.engravingAreaWidthMm,
      engravingAreaHeightMm: form.engravingAreaHeightMm,
      lightburnDefaults: {
        speedMmPerSec: form.speedMmPerSec,
        powerPercent: form.powerPercent,
        passes: form.passes
      }
    };

    const res = await fetch('/api/admin/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setStatus('Template created');
      setForm(initialForm);
      await loadTemplates();
    } else {
      setStatus('Failed to create template');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Template Manager</h1>
      <form className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4" onSubmit={submitTemplate}>
        {Object.entries(form).map(([key, value]) => (
          <label key={key} className="space-y-1 text-sm capitalize">
            <span>{key}</span>
            <input
              className="w-full rounded bg-slate-800 p-2"
              type={typeof value === 'number' ? 'number' : 'text'}
              step={typeof value === 'number' ? '0.1' : undefined}
              value={value}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  [key]: typeof value === 'number' ? Number(event.target.value) : event.target.value
                }))
              }
              required
            />
          </label>
        ))}
        <button className="rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950" type="submit">
          Create template
        </button>
      </form>

      <section>
        <h2 className="mb-2 font-semibold">Existing templates</h2>
        <ul className="space-y-1 text-sm text-slate-300">
          {templates.map((template) => (
            <li key={template.id}>{template.name}</li>
          ))}
        </ul>
      </section>

      <p className="text-cyan-300">{status}</p>
    </div>
  );
}
