import { fail, ok } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { requireStudioAccess } from "@/lib/studio/auth";
import { validatePatchAgainstPolicy } from "@/lib/studio/patch-policy";
import fs from "node:fs/promises";
import path from "node:path";

function sanitizeProposalId(input: string) {
  return input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

export async function POST(request: Request) {
  try {
    requireStudioAccess(request);
    const body = (await request.json()) as { proposal_id?: string; patch?: string };

    if (!body.proposal_id || !body.patch) {
      throw new AppError("proposal_id and patch are required", 400, "BAD_REQUEST");
    }

    const policy = validatePatchAgainstPolicy(body.patch);
    if (policy.errors.length > 0) {
      throw new AppError("Patch rejected by policy", 400, "PATCH_POLICY_REJECTED", {
        errors: policy.errors,
      });
    }

    const proposalId = sanitizeProposalId(body.proposal_id);
    if (!proposalId) {
      throw new AppError("Invalid proposal_id", 400, "BAD_REQUEST");
    }

    const folder = path.join("data", "studio-patches");
    await fs.mkdir(folder, { recursive: true });
    const filePath = path.join(folder, `${proposalId}.patch`);
    await fs.writeFile(filePath, body.patch, "utf8");

    return ok({ saved_path: filePath });
  } catch (error) {
    return fail(error);
  }
}
