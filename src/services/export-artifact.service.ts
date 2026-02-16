import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { buildExportManifest, buildExportSvg, runDesignJobPreflight } from "@/lib/export-pack";
import { ExportPayload, PreflightIssue } from "@/schemas/preflight-export";

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
        payloadJson: null,
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
