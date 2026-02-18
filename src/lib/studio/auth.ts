import { AppError } from "@/lib/errors";
import { requireApiRole } from "@/lib/api-auth";

export function isStudioEnabled() {
  return process.env.STUDIO_ENABLED === "true";
}

export function isStudioCodegenEnabled() {
  return process.env.STUDIO_CODEGEN_ENABLED === "true";
}

export function requireStudioAccess(request: Request) {
  if (!isStudioEnabled() || !isStudioCodegenEnabled()) {
    throw new AppError("Studio code generation is disabled", 404, "NOT_FOUND");
  }

  requireApiRole(request, ["admin", "operator"]);
}
