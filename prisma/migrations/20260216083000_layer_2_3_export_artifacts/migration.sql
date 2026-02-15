-- CreateEnum
CREATE TYPE "ExportArtifactKind" AS ENUM ('manifest', 'svg');

-- CreateEnum
CREATE TYPE "ExportPreflightStatus" AS ENUM ('pass', 'warn', 'fail');

-- CreateTable
CREATE TABLE "ExportArtifact" (
    "id" TEXT NOT NULL,
    "designJobId" TEXT NOT NULL,
    "kind" "ExportArtifactKind" NOT NULL,
    "version" TEXT NOT NULL,
    "preflightStatus" "ExportPreflightStatus" NOT NULL,
    "payloadJson" JSONB,
    "textContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportArtifact_designJobId_createdAt_idx" ON "ExportArtifact"("designJobId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportArtifact_kind_idx" ON "ExportArtifact"("kind");

-- AddForeignKey
ALTER TABLE "ExportArtifact" ADD CONSTRAINT "ExportArtifact_designJobId_fkey" FOREIGN KEY ("designJobId") REFERENCES "DesignJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
