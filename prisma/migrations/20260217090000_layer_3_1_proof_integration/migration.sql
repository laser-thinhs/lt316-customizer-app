-- AlterEnum
ALTER TYPE "DesignJobStatus" ADD VALUE 'failed';

-- AlterEnum
ALTER TYPE "AssetKind" ADD VALUE 'proof_png';
ALTER TYPE "AssetKind" ADD VALUE 'export_zip';

-- AlterTable
ALTER TABLE "DesignJob"
ADD COLUMN "sourceSvgAssetId" TEXT,
ADD COLUMN "proofPngAssetId" TEXT,
ADD COLUMN "exportZipAssetId" TEXT,
ADD COLUMN "proofTemplateId" TEXT,
ADD COLUMN "proofPlacementJson" JSONB,
ADD COLUMN "proofStatus" TEXT DEFAULT 'draft',
ADD COLUMN "proofError" TEXT;
