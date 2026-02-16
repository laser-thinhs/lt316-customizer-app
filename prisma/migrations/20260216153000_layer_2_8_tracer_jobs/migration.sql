-- CreateEnum
CREATE TYPE "TracerJobStatus" AS ENUM ('queued', 'processing', 'done', 'failed');

-- CreateTable
CREATE TABLE "TracerJob" (
    "id" TEXT NOT NULL,
    "status" "TracerJobStatus" NOT NULL DEFAULT 'queued',
    "originalAssetId" TEXT NOT NULL,
    "outputSvgAssetId" TEXT,
    "settingsJson" JSONB NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "preprocessMs" INTEGER,
    "traceMs" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TracerJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TracerJob_status_createdAt_idx" ON "TracerJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TracerJob_originalAssetId_idx" ON "TracerJob"("originalAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "TracerJob_outputSvgAssetId_key" ON "TracerJob"("outputSvgAssetId");

-- AddForeignKey
ALTER TABLE "TracerJob" ADD CONSTRAINT "TracerJob_originalAssetId_fkey" FOREIGN KEY ("originalAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TracerJob" ADD CONSTRAINT "TracerJob_outputSvgAssetId_fkey" FOREIGN KEY ("outputSvgAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
