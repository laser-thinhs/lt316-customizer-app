-- CreateEnum
CREATE TYPE "BatchRunStatus" AS ENUM ('queued', 'processing', 'completed', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "BatchItemStatus" AS ENUM ('success', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "DesignJob"
  ADD COLUMN "proofImagePath" TEXT,
  ADD COLUMN "placementHash" TEXT,
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "batchRunItemId" TEXT;

-- CreateTable
CREATE TABLE "Template" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "productProfileId" TEXT,
  "placementDocument" JSONB NOT NULL,
  "previewImagePath" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "templateHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemplateTokenDefinition" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "defaultValue" TEXT,
  "validatorRegex" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TemplateTokenDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BatchRun" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "productProfileId" TEXT NOT NULL,
  "sourceCsvPath" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0,
  "status" "BatchRunStatus" NOT NULL DEFAULT 'queued',
  "policyMode" TEXT NOT NULL DEFAULT 'STRICT',
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "summaryJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BatchRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BatchRunItem" (
  "id" TEXT NOT NULL,
  "batchRunId" TEXT NOT NULL,
  "rowIndex" INTEGER NOT NULL,
  "rowDataJson" JSONB NOT NULL,
  "resolvedTokensJson" JSONB,
  "status" "BatchItemStatus" NOT NULL DEFAULT 'skipped',
  "warningsJson" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BatchRunItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "correlationId" TEXT,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Template_slug_key" ON "Template"("slug");
CREATE UNIQUE INDEX "TemplateTokenDefinition_templateId_key_key" ON "TemplateTokenDefinition"("templateId", "key");
CREATE UNIQUE INDEX "BatchRunItem_batchRunId_rowIndex_key" ON "BatchRunItem"("batchRunId", "rowIndex");
CREATE UNIQUE INDEX "DesignJob_batchRunItemId_key" ON "DesignJob"("batchRunItemId");

CREATE INDEX "Template_productProfileId_idx" ON "Template"("productProfileId");
CREATE INDEX "Template_isActive_idx" ON "Template"("isActive");
CREATE INDEX "BatchRun_templateId_idx" ON "BatchRun"("templateId");
CREATE INDEX "BatchRun_status_idx" ON "BatchRun"("status");
CREATE INDEX "BatchRunItem_batchRunId_status_idx" ON "BatchRunItem"("batchRunId", "status");
CREATE INDEX "DesignJob_templateId_idx" ON "DesignJob"("templateId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

ALTER TABLE "Template" ADD CONSTRAINT "Template_productProfileId_fkey"
  FOREIGN KEY ("productProfileId") REFERENCES "ProductProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TemplateTokenDefinition" ADD CONSTRAINT "TemplateTokenDefinition_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatchRun" ADD CONSTRAINT "BatchRun_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchRun" ADD CONSTRAINT "BatchRun_productProfileId_fkey"
  FOREIGN KEY ("productProfileId") REFERENCES "ProductProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchRunItem" ADD CONSTRAINT "BatchRunItem_batchRunId_fkey"
  FOREIGN KEY ("batchRunId") REFERENCES "BatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_batchRunItemId_fkey"
  FOREIGN KEY ("batchRunItemId") REFERENCES "BatchRunItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
