-- AlterTable
ALTER TABLE "DesignJob"
ADD COLUMN "sourceSvgAssetId" TEXT,
ADD COLUMN "proofPngAssetId" TEXT,
ADD COLUMN "exportZipAssetId" TEXT,
ADD COLUMN "proofPlacementJson" JSONB,
ADD COLUMN "proofTemplateId" TEXT,
ADD COLUMN "proofStatus" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN "proofError" TEXT;
