import { z } from "zod";

export const policyModeSchema = z.enum(["STRICT", "CLAMP", "SCALE_TO_FIT"]);

export const createBatchSchema = z.object({
  templateId: z.string().min(1),
  productProfileId: z.string().min(1),
  mapping: z.record(z.string(), z.string()),
  csvContent: z.string().min(1),
  sourceCsvPath: z.string().default("uploaded.csv"),
  policyMode: policyModeSchema.default("CLAMP")
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
