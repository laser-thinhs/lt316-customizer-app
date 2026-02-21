import { fail, ok } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { requireStudioAccess } from "@/lib/studio/auth";
import { validatePatchAgainstPolicy } from "@/lib/studio/patch-policy";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";

function execFileSafe(cmd: string, args: string[], timeoutMs = 20_000): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, output: `${stdout}\n${stderr}`.trim() });
        return;
      }
      resolve({ ok: true, output: `${stdout}\n${stderr}`.trim() || "OK" });
    });
  });
}

export async function POST(request: Request) {
  try {
    requireStudioAccess(request);
    const body = (await request.json()) as { patch?: string };
    const patch = body.patch;

    if (!patch || typeof patch !== "string") {
      throw new AppError("Patch is required", 400, "BAD_REQUEST");
    }

    const policy = validatePatchAgainstPolicy(patch);
    if (policy.errors.length > 0) {
      throw new AppError("Patch rejected by policy", 400, "PATCH_POLICY_REJECTED", {
        errors: policy.errors,
      });
    }

    await fs.mkdir("data/tmp", { recursive: true });
    const patchFile = path.join("data/tmp", `patch-${crypto.randomUUID()}.patch`);
    await fs.writeFile(patchFile, patch, "utf8");

    const gitApplyCheck = await execFileSafe("git", ["apply", "--check", patchFile]);

    let typecheck: { ok: boolean; output: string } | undefined;
    if (gitApplyCheck.ok) {
      const pkg = JSON.parse(await fs.readFile("package.json", "utf8")) as {
        scripts?: Record<string, string>;
      };
      if (pkg.scripts?.typecheck) {
        typecheck = await execFileSafe("npm", ["run", "-s", "typecheck"], 120_000);
      }
    }

    return ok({
      ok: gitApplyCheck.ok && (typecheck?.ok ?? true),
      git_apply_check: gitApplyCheck,
      ...(typecheck ? { typecheck } : {}),
    });
  } catch (error) {
    return fail(error);
  }
}
