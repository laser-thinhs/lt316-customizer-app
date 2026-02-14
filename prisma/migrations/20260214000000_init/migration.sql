-- CreateTable
CREATE TABLE "ProductTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "diameterMm" DOUBLE PRECISION NOT NULL,
    "heightMm" DOUBLE PRECISION NOT NULL,
    "engravingAreaWidthMm" DOUBLE PRECISION NOT NULL,
    "engravingAreaHeightMm" DOUBLE PRECISION NOT NULL,
    "lightburnDefaults" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSubmission" (
    "id" TEXT NOT NULL,
    "productTemplateId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "transform" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductTemplate_name_key" ON "ProductTemplate"("name");

-- CreateIndex
CREATE INDEX "JobSubmission_productTemplateId_idx" ON "JobSubmission"("productTemplateId");

-- CreateIndex
CREATE INDEX "JobSubmission_assetId_idx" ON "JobSubmission"("assetId");

-- AddForeignKey
ALTER TABLE "JobSubmission" ADD CONSTRAINT "JobSubmission_productTemplateId_fkey" FOREIGN KEY ("productTemplateId") REFERENCES "ProductTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSubmission" ADD CONSTRAINT "JobSubmission_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
