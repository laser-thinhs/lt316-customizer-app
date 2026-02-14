import { env } from '@/lib/env';
import { LocalStorageProvider } from '@/lib/storage/local';
import { S3StorageProvider } from '@/lib/storage/s3';
import type { StorageProvider } from '@/lib/storage/types';

let provider: StorageProvider;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    provider = env.STORAGE_DRIVER === 's3' ? new S3StorageProvider() : new LocalStorageProvider();
  }

  return provider;
}
