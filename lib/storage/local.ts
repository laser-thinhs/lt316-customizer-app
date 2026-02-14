import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '@/lib/env';
import type { StorageProvider, UploadResult } from '@/lib/storage/types';

export class LocalStorageProvider implements StorageProvider {
  async upload(params: {
    filename: string;
    contentType: string;
    buffer: Buffer;
  }): Promise<UploadResult> {
    const ext = path.extname(params.filename) || '';
    const key = `${randomUUID()}${ext}`;
    const uploadDir = path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, key), params.buffer);

    return {
      key,
      url: `/uploads/${key}`,
      sizeBytes: params.buffer.byteLength,
      mimeType: params.contentType,
      originalName: params.filename
    };
  }
}
