import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PY_API_URL = process.env.PY_API_URL;

function safeSlug(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
}

export async function POST(request: Request): Promise<Response> {
  if (!PY_API_URL) {
    return NextResponse.json(
      { error: 'PY_API_URL is not configured on the app service.' },
      { status: 500 },
    );
  }

  const inbound = await request.formData();
  const file = inbound.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing multipart file field: file' }, { status: 400 });
  }

  const outbound = new FormData();
  outbound.append('file', file, file.name || 'upload');

  const mode = inbound.get('mode');
  if (typeof mode === 'string' && mode.length > 0) {
    outbound.append('mode', mode);
  }

  const simplify = inbound.get('simplify');
  if (typeof simplify === 'string' && simplify.length > 0) {
    outbound.append('simplify', simplify);
  }

  const pyResponse = await fetch(new URL('/trace', PY_API_URL), {
    method: 'POST',
    body: outbound,
  });

  const responseBody = await pyResponse.text();
  const contentType = pyResponse.headers.get('content-type') ?? 'image/svg+xml';

  const url = new URL(request.url);
  const shouldSave = url.searchParams.get('save') === '1';
  const slug = url.searchParams.get('slug');

  if (shouldSave && slug && pyResponse.ok && contentType.includes('image/svg+xml')) {
    const cleanSlug = safeSlug(slug);
    if (cleanSlug.length > 0) {
      const targetDir = path.join(process.cwd(), 'storage', 'traces', cleanSlug);
      const filename = `${Date.now()}.svg`;
      const targetPath = path.join(targetDir, filename);

      try {
        await mkdir(targetDir, { recursive: true });
        await writeFile(targetPath, responseBody, 'utf8');
      } catch (error) {
        console.warn('Unable to persist traced SVG:', error);
      }
    }
  }

  return new Response(responseBody, {
    status: pyResponse.status,
    headers: {
      'content-type': contentType,
    },
  });
}
