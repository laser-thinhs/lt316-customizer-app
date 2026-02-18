import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createBatchSchema } from "@/schemas/batch";
import { parseCsv, toErrorCsv } from "@/lib/csv";
import { enforcePolicy } from "@/lib/placement-policy";
import type { TokenDefinition } from "@/lib/vdp";
import { resolveTokensForObject, validateTokenValues } from "@/lib/vdp";
import { renderProofImage } from "./proof-renderer.service";
import { fingerprint } from "@/lib/canonical";
import { logAudit } from "./audit.service";

const MAX_ROWS = Number(process.env.BATCH_MAX_ROWS ?? "500");
const MAX_CSV_BYTES = Number(process.env.CSV_MAX_SIZE_BYTES ?? "1048576");

export async function createBatchRun(rawInput: unknown) {
  const input = createBatchSchema.parse(rawInput);
  const template = await prisma.template.findUnique({ where: { id: input.templateId }, include: { tokenDefinitions: true } });
  if (!template) throw new AppError("Template not found", 404, "NOT_FOUND");

  if (Buffer.byteLength(input.csvContent, "utf8") > MAX_CSV_BYTES) {
    throw new AppError(`CSV exceeds size limit (${MAX_CSV_BYTES} bytes)`, 400, "CSV_TOO_LARGE");
  }

  const parsed = parseCsv(input.csvContent);
  if (parsed.rows.length > MAX_ROWS) throw new AppError(`CSV exceeds max rows (${MAX_ROWS})`, 400, "ROW_LIMIT_EXCEEDED");

  const batch = await prisma.batchRun.create({
    data: {
      templateId: input.templateId,
      productProfileId: input.productProfileId,
      sourceCsvPath: input.sourceCsvPath,
      totalRows: parsed.rows.length,
      status: "processing",
      policyMode: input.policyMode,
      startedAt: new Date()
    }
  });

  const results = [] as Array<{ rowIndex: number; status: "success" | "failed"; error?: string }>;
  const zone = await prisma.productProfile.findUnique({ where: { id: input.productProfileId } });
  if (!zone) throw new AppError("Invalid product profile", 400, "INVALID_PRODUCT_PROFILE");
  const tokenDefinitions: TokenDefinition[] = template.tokenDefinitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    required: definition.required,
    defaultValue: definition.defaultValue,
    validatorRegex: definition.validatorRegex
  }));

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const row = parsed.rows[i];
    const mapped = Object.entries(input.mapping).reduce<Record<string, string>>((acc, [tokenKey, header]) => {
      acc[tokenKey] = row[header];
      return acc;
    }, {});

    const validationErrors = validateTokenValues(tokenDefinitions, mapped);
    if (validationErrors.length > 0) {
      await prisma.batchRunItem.create({
        data: {
          batchRunId: batch.id,
          rowIndex: i + 1,
          rowDataJson: row,
          resolvedTokensJson: mapped,
          status: "failed",
          errorMessage: validationErrors.join("; ")
        }
      });
      results.push({ rowIndex: i + 1, status: "failed", error: validationErrors.join("; ") });
      continue;
    }

    const resolvedDoc = resolveTokensForObject(template.placementDocument, mapped);
    const policyResult = enforcePolicy(
      resolvedDoc,
      { widthMm: Number(zone.engraveZoneWidthMm), heightMm: Number(zone.engraveZoneHeightMm) },
      input.policyMode
    );

    if (!policyResult.ok) {
      await prisma.batchRunItem.create({
        data: {
          batchRunId: batch.id,
          rowIndex: i + 1,
          rowDataJson: row,
          resolvedTokensJson: mapped,
          status: "failed",
          warningsJson: policyResult.warnings,
          errorMessage: policyResult.warnings.join("; ")
        }
      });
      results.push({ rowIndex: i + 1, status: "failed", error: policyResult.warnings.join("; ") });
      continue;
    }

    const item = await prisma.batchRunItem.create({
      data: {
        batchRunId: batch.id,
        rowIndex: i + 1,
        rowDataJson: row,
        resolvedTokensJson: mapped,
        status: "success",
        warningsJson: policyResult.warnings
      }
    });

    const rendered = await renderProofImage({ placementDocument: policyResult.document, productProfileId: zone.id, rowIndex: i + 1 });
    await prisma.designJob.create({
      data: {
        orderRef: mapped.order_number,
        productProfileId: input.productProfileId,
        machineProfileId: "fiber-galvo-300-lens-default",
        status: "draft",
        placementJson: policyResult.document,
        proofImagePath: rendered.imagePath,
        placementHash: fingerprint(policyResult.document),
        templateId: template.id,
        batchRunItemId: item.id
      }
    });

    results.push({ rowIndex: i + 1, status: "success" });
  }

  const validRows = results.filter((r) => r.status === "success").length;
  const invalidRows = results.length - validRows;

  const final = await prisma.batchRun.update({
    where: { id: batch.id },
    data: {
      validRows,
      invalidRows,
      status: invalidRows > 0 && validRows > 0 ? "partial" : invalidRows > 0 ? "failed" : "completed",
      finishedAt: new Date(),
      summaryJson: { results }
    }
  });

  await logAudit("batch.start", "BatchRun", { entityId: final.id, correlationId: final.id });
  await logAudit("batch.finish", "BatchRun", { entityId: final.id, correlationId: final.id, payloadJson: final.summaryJson });
  return final;
}

export async function getBatchRun(id: string) {
  const run = await prisma.batchRun.findUnique({ where: { id } });
  if (!run) throw new AppError("Batch run not found", 404, "NOT_FOUND");
  return run;
}

export async function getBatchItems(id: string) {
  return prisma.batchRunItem.findMany({ where: { batchRunId: id }, orderBy: { rowIndex: "asc" } });
}

export async function getBatchErrorsCsv(id: string) {
  const items = await prisma.batchRunItem.findMany({ where: { batchRunId: id, status: "failed" }, orderBy: { rowIndex: "asc" } });
  return toErrorCsv(items.map((item) => ({ rowIndex: String(item.rowIndex), error: item.errorMessage ?? "unknown" })));
}

export async function retryFailed(id: string) {
  const batch = await getBatchRun(id);
  await logAudit("batch.retry", "BatchRun", { entityId: id, correlationId: id });
  return batch;
}
