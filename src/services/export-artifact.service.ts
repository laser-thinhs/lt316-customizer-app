import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { buildExportManifest, buildExportSvg, runDesignJobPreflight } from "@/lib/export-pack";
import { ExportPayload, PreflightIssue } from "@/schemas/preflight-export";
import { promises as fs } from "node:fs";
import path from "node:path";
import { asAssetPublicUrl, createAssetId, ensureDesignJobAssetDir, sanitizeFilename } from "@/lib/assets";
import { Prisma } from "@prisma/client";

export async function getDesignJobExportContext(designJobId: string) {
  const job = await prisma.designJob.findUnique({
    where: { id: designJobId },
    include: {
      productProfile: true,
      machineProfile: true,
      assets: true
    }
  });

  if (!job) {
    throw new AppError("DesignJob not found", 404, "NOT_FOUND");
  }

  return job;
}

export async function preflightDesignJob(designJobId: string) {
  const context = await getDesignJobExportContext(designJobId);
  return runDesignJobPreflight({
    job: context,
    productProfile: context.productProfile,
    machineProfile: context.machineProfile
  });
}

export async function exportDesignJob(designJobId: string): Promise<ExportPayload> {
  const context = await getDesignJobExportContext(designJobId);
  const preflight = runDesignJobPreflight({
    job: context,
    productProfile: context.productProfile,
    machineProfile: context.machineProfile
  });

  if (preflight.status === "fail") {
    throw new AppError("Preflight failed", 422, "PREFLIGHT_FAILED", preflight);
  }

  const manifest = buildExportManifest(context, context.productProfile, context.machineProfile, preflight);
  const svg = buildExportSvg(context, context.productProfile);

  await prisma.exportArtifact.createMany({
    data: [
      {
        designJobId,
        kind: "manifest",
        version: manifest.version,
        preflightStatus: preflight.status,
        payloadJson: manifest,
        textContent: null
      },
      {
        designJobId,
        kind: "svg",
        version: manifest.version,
        preflightStatus: preflight.status,
        payloadJson: Prisma.JsonNull,
        textContent: svg
      }
    ]
  });

  return {
    manifest,
    svg,
    metadata: {
      preflightStatus: preflight.status,
      issueCount: preflight.issues.length
    }
  };
}

export async function exportDesignJobsBatch(designJobIds: string[]) {
  return Promise.all(
    designJobIds.map(async (designJobId) => {
      try {
        const artifacts = await exportDesignJob(designJobId);
        return { designJobId, success: true, artifacts };
      } catch (error) {
        if (error instanceof AppError && error.code === "PREFLIGHT_FAILED") {
          return {
            designJobId,
            success: false,
            reason: error.message,
            issues: ((error.details as { issues?: PreflightIssue[] } | undefined)?.issues ?? [])
          };
        }

        return {
          designJobId,
          success: false,
          reason: error instanceof Error ? error.message : "Unknown export error"
        };
      }
    })
  );
}

type JobExportResponse = {
  svgUrl: string;
  manifestUrl: string;
  warnings: string[];
  errors: string[];
  exportedAt: string;
  svgByteSize: number;
  manifestByteSize: number;
  svg: string;
  manifest: string;
};

export async function exportDesignJobAsAssets(designJobId: string): Promise<JobExportResponse> {
  const exported = await exportDesignJob(designJobId);
  const manifestJson = JSON.stringify(exported.manifest, null, 2);
  const svgText = exported.svg;
  const manifestByteSize = Buffer.byteLength(manifestJson, "utf8");
  const svgByteSize = Buffer.byteLength(svgText, "utf8");

  const dir = await ensureDesignJobAssetDir(designJobId);
  const manifestAssetId = createAssetId();
  const svgAssetId = createAssetId();
  const manifestName = `${manifestAssetId}-${sanitizeFilename(`job-${designJobId}-manifest.json`)}`;
  const svgName = `${svgAssetId}-${sanitizeFilename(`job-${designJobId}.svg`)}`;
  const manifestPath = path.join(dir, manifestName);
  const svgPath = path.join(dir, svgName);

  await fs.writeFile(manifestPath, manifestJson, "utf8");
  await fs.writeFile(svgPath, svgText, "utf8");

  const createdAt = new Date();
  await prisma.asset.createMany({
    data: [
      {
        id: manifestAssetId,
        designJobId,
        kind: "export_zip",
        originalName: `job-${designJobId}-manifest.json`,
        mimeType: "application/json",
        byteSize: manifestByteSize,
        filePath: manifestPath,
        widthPx: null,
        heightPx: null,
        createdAt
      },
      {
        id: svgAssetId,
        designJobId,
        kind: "export_zip",
        originalName: `job-${designJobId}.svg`,
        mimeType: "image/svg+xml",
        byteSize: svgByteSize,
        filePath: svgPath,
        widthPx: null,
        heightPx: null,
        createdAt
      }
    ]
  });

  const warnings = exported.manifest.preflight.warningCount > 0
    ? ["Preflight completed with warnings. Review issues before production."]
    : [];
  const errors = exported.manifest.preflight.errorCount > 0
    ? ["Preflight returned errors."]
    : [];

  return {
    svgUrl: asAssetPublicUrl(svgAssetId),
    manifestUrl: asAssetPublicUrl(manifestAssetId),
    warnings,
    errors,
    exportedAt: createdAt.toISOString(),
    svgByteSize,
    manifestByteSize,
    svg: svgText,
    manifest: manifestJson
  };
}
