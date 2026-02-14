'use client';

import { useEffect, useMemo, useState } from 'react';
import { CanvasPlacementTool } from '@/components/CanvasPlacementTool';

type ProductTemplate = {
  id: string;
  name: string;
  diameterMm: number;
  heightMm: number;
  engravingAreaWidthMm: number;
  engravingAreaHeightMm: number;
};

type UploadedAsset = {
  id: string;
  url: string;
  originalName: string;
};

export default function HomePage() {
  const [templates, setTemplates] = useState<ProductTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [asset, setAsset] = useState<UploadedAsset | null>(null);
  const [transform, setTransform] = useState({ scale: 1, xMm: 0, yMm: 0, rotateDeg: 0 });
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.templates);
        if (data.templates[0]) setSelectedTemplateId(data.templates[0].id);
      });
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [selectedTemplateId, templates]
  );

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.[0]) return;
    const formData = new FormData();
    formData.append('file', event.target.files[0]);

    const res = await fetch('/api/uploads', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || 'Upload failed');
      return;
    }

    setAsset(data.asset);
    setStatus(`Uploaded ${data.asset.originalName}`);
  }

  async function submitJob() {
    if (!selectedTemplate || !asset) {
      setStatus('Template and asset are required');
      return;
    }

    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productTemplateId: selectedTemplate.id,
        assetId: asset.id,
        transform
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus('Failed to submit job');
      return;
    }

    setStatus(`Job saved. Export endpoint: /api/jobs/${data.job.id}/export`);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Custom Product Designer</h1>
        <p className="text-slate-300">Upload artwork, place it in mm, and save a laser-ready job payload.</p>
      </header>

      <section className="grid gap-4 rounded-xl border border-slate-700 bg-slate-900 p-4 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-sm">Template</span>
          <select
            className="w-full rounded bg-slate-800 p-2"
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm">Artwork (SVG/PNG)</span>
          <input className="w-full rounded bg-slate-800 p-2" type="file" accept=".svg,.png,image/svg+xml,image/png" onChange={onUpload} />
        </label>

        <div className="flex items-end">
          <button className="w-full rounded bg-cyan-500 px-4 py-2 font-semibold text-slate-950" onClick={submitJob}>
            Save Job Submission
          </button>
        </div>
      </section>

      {selectedTemplate ? (
        <CanvasPlacementTool
          widthMm={selectedTemplate.engravingAreaWidthMm}
          heightMm={selectedTemplate.engravingAreaHeightMm}
          assetUrl={asset?.url}
          onTransformChange={setTransform}
        />
      ) : null}

      <p className="text-sm text-cyan-300">{status}</p>
    </div>
  );
}
