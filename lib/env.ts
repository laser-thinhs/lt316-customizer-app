import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_UPLOAD_DIR: z.string().default('public/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:3000')
});

export const env = envSchema.parse(process.env);
