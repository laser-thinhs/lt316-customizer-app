import { z } from "zod";

export const preflightStatusSchema = z.enum(["pass", "warn", "fail"]);
export const preflightSeveritySchema = z.enum(["error", "warning", "info"]);

export const preflightIssueCodeSchema = z.enum([
  "CANVAS_EXCEEDS_ENGRAVE_ZONE",
  "OBJECT_OUT_OF_CANVAS",
  "OBJECT_OUT_OF_ENGRAVE_ZONE",
  "STROKE_TOO_THIN",
  "OBJECT_OVERLAP_RISK",
  "SEAM_RISK",
  "MISSING_ASSET_REFERENCE",
  "INVALID_OBJECT_DATA",
  "INVALID_PLACEMENT"
]);

export const preflightIssueSchema = z.object({
  code: preflightIssueCodeSchema,
  severity: preflightSeveritySchema,
  message: z.string(),
  objectId: z.string().optional(),
  suggestedFix: z.string().optional()
});

export const preflightResultSchema = z.object({
  status: preflightStatusSchema,
  issues: z.array(preflightIssueSchema)
});

export const exportManifestSchema = z.object({
  version: z.literal("1.0"),
  designJobId: z.string(),
  machineProfileId: z.string(),
  placementVersion: z.number(),
  createdAt: z.string(),
  productProfile: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    engraveZoneWidthMm: z.number(),
    engraveZoneHeightMm: z.number(),
    diameterMm: z.number(),
    heightMm: z.number()
  }),
  objects: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      zIndex: z.number().int(),
      source: z.object({
        anchor: z.string(),
        offsetXMm: z.number(),
        offsetYMm: z.number(),
        boxWidthMm: z.number(),
        boxHeightMm: z.number(),
        rotationDeg: z.number(),
        mirrorX: z.boolean(),
        mirrorY: z.boolean()
      }),
      absoluteBoundsMm: z.object({
        xMm: z.number(),
        yMm: z.number(),
        widthMm: z.number(),
        heightMm: z.number()
      })
    })
  ),
  preflight: z.object({
    status: preflightStatusSchema,
    issueCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative()
  })
});

export const exportPayloadSchema = z.object({
  manifest: exportManifestSchema,
  svg: z.string(),
  metadata: z.object({
    preflightStatus: preflightStatusSchema,
    issueCount: z.number().int().nonnegative()
  })
});

export const batchExportRequestSchema = z.object({
  designJobIds: z.array(z.string().min(1)).min(1)
});

export const batchExportResultSchema = z.object({
  designJobId: z.string(),
  success: z.boolean(),
  reason: z.string().optional(),
  artifacts: exportPayloadSchema.optional(),
  issues: z.array(preflightIssueSchema).optional()
});

export const batchExportResponseSchema = z.object({
  results: z.array(batchExportResultSchema)
});

export type PreflightResult = z.infer<typeof preflightResultSchema>;
export type PreflightIssue = z.infer<typeof preflightIssueSchema>;
export type ExportManifest = z.infer<typeof exportManifestSchema>;
export type ExportPayload = z.infer<typeof exportPayloadSchema>;
