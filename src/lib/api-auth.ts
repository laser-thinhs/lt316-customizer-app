import { AppError } from "@/lib/errors";

export type ApiActorRole = "admin" | "operator";

function isAuthRequired() {
  if (process.env.API_AUTH_REQUIRED !== "true") {
    return false;
  }

  if (process.env.NODE_ENV === "test" && process.env.API_AUTH_REQUIRED_IN_TEST !== "true") {
    return false;
  }

  return true;
}

export function requireApiRole(request: Request, allowedRoles: ApiActorRole[] = ["admin", "operator"]) {
  if (!isAuthRequired()) {
    return;
  }

  const expectedApiKey = process.env.API_KEY;
  if (expectedApiKey) {
    const receivedApiKey = request.headers.get("x-api-key");
    if (receivedApiKey !== expectedApiKey) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }
  }

  const actor = request.headers.get("x-actor-role") as ApiActorRole | null;
  if (!actor || !allowedRoles.includes(actor)) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
}
