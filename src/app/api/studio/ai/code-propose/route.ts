import { fail, ok } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { requireStudioAccess } from "@/lib/studio/auth";
import { checkStudioProposeRateLimit } from "@/lib/studio/rate-limit";
import { validatePatchAgainstPolicy } from "@/lib/studio/patch-policy";
import fs from "node:fs/promises";

type Body = {
  instruction: string;
  target?: string;
  context?: Record<string, unknown>;
};

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || "local";
}

async function loadRepoContext() {
  const context: {
    block_registry_excerpt?: string;
    existing_blocks?: string[];
    tree_hint?: string[];
  } = {};

  try {
    context.block_registry_excerpt = await fs.readFile("src/studio/registry.ts", "utf8");
  } catch {
    context.block_registry_excerpt = "";
  }

  try {
    const dir = await fs.readdir("src/studio/blocks");
    context.existing_blocks = dir.filter((entry) => entry.endsWith(".tsx"));
  } catch {
    context.existing_blocks = [];
  }

  context.tree_hint = ["src/studio/blocks", "src/studio/registry.ts", "app/(studio)/studio/page.tsx"];
  return context;
}

export async function POST(request: Request) {
  try {
    requireStudioAccess(request);

    if (!checkStudioProposeRateLimit(clientKey(request))) {
      throw new AppError("Rate limit exceeded for code propose", 429, "RATE_LIMITED");
    }

    const body = (await request.json()) as Body;
    if (!body.instruction || body.instruction.trim().length < 8) {
      throw new AppError("Instruction is required", 400, "BAD_REQUEST");
    }

    const upstreamUrl = process.env.STUDIO_AI_URL;
    if (!upstreamUrl) {
      throw new AppError("STUDIO_AI_URL is not configured", 500, "MISCONFIGURED");
    }

    const repoContext = await loadRepoContext();
    const upstream = await fetch(`${upstreamUrl}/v1/code/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instruction: body.instruction,
        target: body.target,
        repo_context: {
          ...repoContext,
          ...(body.context ?? {}),
        },
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      throw new AppError(`Python propose failed: ${text}`, 502, "UPSTREAM_ERROR");
    }

    const payload = (await upstream.json()) as {
      proposal_id: string;
      patch: string;
      summary: string;
      warnings?: string[];
      files?: string[];
    };

    const policy = validatePatchAgainstPolicy(payload.patch);
    if (policy.errors.length > 0) {
      throw new AppError("Patch rejected by policy", 400, "PATCH_POLICY_REJECTED", {
        errors: policy.errors,
      });
    }

    return ok({
      proposal_id: payload.proposal_id,
      patch: payload.patch,
      summary: payload.summary,
      warnings: [...(payload.warnings ?? []), ...policy.warnings],
      files: policy.files,
    });
  } catch (error) {
    return fail(error);
  }
}
