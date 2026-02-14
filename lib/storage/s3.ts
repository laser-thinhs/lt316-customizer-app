import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { env } from '@/lib/env';
import type { StorageProvider, UploadResult } from '@/lib/storage/types';

export class S3StorageProvider implements StorageProvider {
  private client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? ''
    }
  });

  async upload(params: {
    filename: string;
    contentType: string;
    buffer: Buffer;
  }): Promise<UploadResult> {
    if (!env.S3_BUCKET) {
      throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
    }

    const ext = path.extname(params.filename) || '';
    const key = `uploads/${randomUUID()}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType
      })
    );

    const base = env.S3_ENDPOINT?.replace(/\/$/, '') ?? `https://s3.${env.S3_REGION}.amazonaws.com`;

    return {
      key,
      url: `${base}/${env.S3_BUCKET}/${key}`,
      sizeBytes: params.buffer.byteLength,
      mimeType: params.contentType,
      originalName: params.filename
    };
  }
}
