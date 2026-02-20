ALTER TABLE "DesignJob"
ADD COLUMN "proofDpi" INTEGER,
ADD COLUMN "proofPlacementMmJson" JSONB,
ADD COLUMN "proofUiSettingsJson" JSONB;
