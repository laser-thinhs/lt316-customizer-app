import { z } from "zod";

export const tracerJobCreateSchema = z.object({
  assetId: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).default({})
});

export const tracerTraceSchema = tracerJobCreateSchema.extend({
  mode: z.enum(["sync", "background"]).optional().default("sync"),
  waitMs: z.number().int().min(500).max(5_000).optional().default(3_500)
});
