-- CreateEnum
CREATE TYPE "DesignJobStatus" AS ENUM ('draft', 'approved', 'exported');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('original', 'normalized', 'preview');

-- CreateEnum
CREATE TYPE "BatchRunStatus" AS ENUM ('queued', 'processing', 'completed', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "BatchItemStatus" AS ENUM ('success', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "ProductProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "diameterMm" DECIMAL(10,3) NOT NULL,
    "heightMm" DECIMAL(10,3) NOT NULL,
    "engraveZoneWidthMm" DECIMAL(10,3) NOT NULL,
    "engraveZoneHeightMm" DECIMAL(10,3) NOT NULL,
    "seamReference" TEXT NOT NULL,
    "toolOutlineSvgPath" TEXT NOT NULL,
    "defaultSettingsProfile" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "laserType" TEXT NOT NULL,
    "lens" TEXT NOT NULL,
    "rotaryModeDefault" TEXT NOT NULL,
    "powerDefault" DECIMAL(10,3) NOT NULL,
    "speedDefault" DECIMAL(10,3) NOT NULL,
    "frequencyDefault" DECIMAL(10,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignJob" (
    "id" TEXT NOT NULL,
    "orderRef" TEXT,
    "productProfileId" TEXT NOT NULL,
    "machineProfileId" TEXT NOT NULL,
    "status" "DesignJobStatus" NOT NULL DEFAULT 'draft',
    "placementJson" JSONB NOT NULL,
    "previewImagePath" TEXT,
    "proofImagePath" TEXT,
    "placementHash" TEXT,
    "templateId" TEXT,
    "batchRunItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "designJobId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "ProductProfile_sku_key" ON "ProductProfile"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "DesignJob_batchRunItemId_key" ON "DesignJob"("batchRunItemId");

-- CreateIndex
CREATE INDEX "DesignJob_productProfileId_idx" ON "DesignJob"("productProfileId");

-- CreateIndex
CREATE INDEX "DesignJob_machineProfileId_idx" ON "DesignJob"("machineProfileId");

-- CreateIndex
CREATE INDEX "DesignJob_status_idx" ON "DesignJob"("status");

-- CreateIndex
CREATE INDEX "DesignJob_templateId_idx" ON "DesignJob"("templateId");

-- CreateIndex
CREATE INDEX "Asset_designJobId_idx" ON "Asset"("designJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_slug_key" ON "Template"("slug");

-- CreateIndex
CREATE INDEX "Template_productProfileId_idx" ON "Template"("productProfileId");

-- CreateIndex
CREATE INDEX "Template_isActive_idx" ON "Template"("isActive");

-- CreateIndex
CREATE INDEX "TemplateTokenDefinition_templateId_idx" ON "TemplateTokenDefinition"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateTokenDefinition_templateId_key_key" ON "TemplateTokenDefinition"("templateId", "key");

-- CreateIndex
CREATE INDEX "BatchRun_templateId_idx" ON "BatchRun"("templateId");

-- CreateIndex
CREATE INDEX "BatchRun_status_idx" ON "BatchRun"("status");

-- CreateIndex
CREATE INDEX "BatchRunItem_batchRunId_status_idx" ON "BatchRunItem"("batchRunId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BatchRunItem_batchRunId_rowIndex_key" ON "BatchRunItem"("batchRunId", "rowIndex");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- AddForeignKey
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_productProfileId_fkey" FOREIGN KEY ("productProfileId") REFERENCES "ProductProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_machineProfileId_fkey" FOREIGN KEY ("machineProfileId") REFERENCES "MachineProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_batchRunItemId_fkey" FOREIGN KEY ("batchRunItemId") REFERENCES "BatchRunItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_designJobId_fkey" FOREIGN KEY ("designJobId") REFERENCES "DesignJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_productProfileId_fkey" FOREIGN KEY ("productProfileId") REFERENCES "ProductProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTokenDefinition" ADD CONSTRAINT "TemplateTokenDefinition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRun" ADD CONSTRAINT "BatchRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRun" ADD CONSTRAINT "BatchRun_productProfileId_fkey" FOREIGN KEY ("productProfileId") REFERENCES "ProductProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRunItem" ADD CONSTRAINT "BatchRunItem_batchRunId_fkey" FOREIGN KEY ("batchRunId") REFERENCES "BatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
