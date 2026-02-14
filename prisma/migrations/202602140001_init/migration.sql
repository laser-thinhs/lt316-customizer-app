-- CreateEnum
CREATE TYPE "DesignJobStatus" AS ENUM ('draft', 'approved', 'exported');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('original', 'normalized', 'preview');

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

-- CreateIndex
CREATE UNIQUE INDEX "ProductProfile_sku_key" ON "ProductProfile"("sku");

-- CreateIndex
CREATE INDEX "DesignJob_productProfileId_idx" ON "DesignJob"("productProfileId");
CREATE INDEX "DesignJob_machineProfileId_idx" ON "DesignJob"("machineProfileId");
CREATE INDEX "DesignJob_status_idx" ON "DesignJob"("status");
CREATE INDEX "Asset_designJobId_idx" ON "Asset"("designJobId");

-- AddForeignKey
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_productProfileId_fkey"
FOREIGN KEY ("productProfileId") REFERENCES "ProductProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_machineProfileId_fkey"
FOREIGN KEY ("machineProfileId") REFERENCES "MachineProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_designJobId_fkey"
FOREIGN KEY ("designJobId") REFERENCES "DesignJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
