import { z } from 'zod';

export const productTemplateSchema = z.object({
  name: z.string().min(2),
  diameterMm: z.number().positive(),
  heightMm: z.number().positive(),
  engravingAreaWidthMm: z.number().positive(),
  engravingAreaHeightMm: z.number().positive(),
  lightburnDefaults: z.object({
    speedMmPerSec: z.number().positive(),
    powerPercent: z.number().min(0).max(100),
    passes: z.number().int().min(1)
  })
});

export const jobSubmissionSchema = z.object({
  productTemplateId: z.string().cuid(),
  assetId: z.string().cuid(),
  transform: z.object({
    scale: z.number().positive(),
    xMm: z.number(),
    yMm: z.number(),
    rotateDeg: z.number()
  })
});

export const magicLinkRequestSchema = z.object({
  email: z.string().email()
});
