import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { fingerprint } from "@/lib/canonical";
import { applyTemplateSchema, createTemplateSchema, patchTemplateSchema } from "@/schemas/template";
import { logAudit } from "./audit.service";
import { remapDocumentToProfile } from "@/lib/placement-policy";

export async function createTemplate(rawInput: unknown) {
  const input = createTemplateSchema.parse(rawInput);
  const templateHash = fingerprint(input.placementDocument);

  const created = await prisma.template.create({
    data: {
      ...input,
      productProfileId: input.productProfileId ?? null,
      templateHash,
      tokenDefinitions: {
        create: input.tokenDefinitions
      }
    },
    include: { tokenDefinitions: true }
  });

  await logAudit("template.create", "Template", { entityId: created.id, payloadJson: { slug: created.slug } });
  return created;
}

export async function listTemplates(query?: { search?: string }) {
  return prisma.template.findMany({
    where: query?.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { tags: { has: query.search } }
          ]
        }
      : undefined,
    include: { tokenDefinitions: true },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getTemplateById(id: string) {
  const template = await prisma.template.findUnique({ where: { id }, include: { tokenDefinitions: true } });
  if (!template) throw new AppError("Template not found", 404, "NOT_FOUND");
  return template;
}

export async function updateTemplate(id: string, rawInput: unknown) {
  const input = patchTemplateSchema.parse(rawInput);
  const existing = await getTemplateById(id);

  const template = await prisma.template.update({
    where: { id },
    data: {
      ...input,
      tokenDefinitions: input.tokenDefinitions
        ? {
            deleteMany: {},
            create: input.tokenDefinitions
          }
        : undefined,
      templateHash: input.placementDocument ? fingerprint(input.placementDocument) : existing.templateHash,
      version: existing.version + (input.placementDocument ? 1 : 0)
    },
    include: { tokenDefinitions: true }
  });

  await logAudit("template.update", "Template", { entityId: id });
  return template;
}

export async function applyTemplate(id: string, rawInput: unknown) {
  const input = applyTemplateSchema.parse(rawInput);
  const template = await getTemplateById(id);
  const targetProfile = await prisma.productProfile.findUnique({ where: { id: input.targetProductProfileId } });
  if (!targetProfile) throw new AppError("Invalid product profile", 400, "INVALID_PRODUCT_PROFILE");

  let placementDocument: unknown = template.placementDocument;
  let warnings: string[] = [];

  if (template.productProfileId && template.productProfileId !== input.targetProductProfileId) {
    const sourceProfile = await prisma.productProfile.findUnique({ where: { id: template.productProfileId } });
    if (sourceProfile) {
      const remapped = remapDocumentToProfile(
        placementDocument,
        { widthMm: Number(sourceProfile.engraveZoneWidthMm), heightMm: Number(sourceProfile.engraveZoneHeightMm) },
        { widthMm: Number(targetProfile.engraveZoneWidthMm), heightMm: Number(targetProfile.engraveZoneHeightMm) }
      );
      placementDocument = remapped.document;
      warnings = remapped.warnings;
    }
  }

  if (!input.designJobId) {
    await logAudit("template.apply", "Template", { entityId: id, payloadJson: { warnings } });
    return { placementDocument, warnings };
  }

  const job = await prisma.designJob.update({
    where: { id: input.designJobId },
    data: {
      placementJson: placementDocument,
      templateId: id,
      placementHash: fingerprint(placementDocument)
    }
  });

  await logAudit("template.apply", "DesignJob", { entityId: job.id, payloadJson: { templateId: id, warnings } });
  return { designJob: job, warnings };
}
