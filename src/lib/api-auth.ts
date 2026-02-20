import { AppError } from "@/lib/errors";

export type ApiActorRole = "admin" | "operator";

/**
 * Auth enforcement strategy:
 * - Production/Staging: Always required (API_AUTH_REQUIRED=true, API_KEY must be set)
 * - Development: Optional (API_AUTH_REQUIRED=false by default)
 * - Test: Optional unless explicitly enabled (API_AUTH_REQUIRED_IN_TEST=true)
 */
function isAuthRequired() {
  // Production and staging always require auth
  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    return true;
  }

  // Otherwise, check explicit config
  if (process.env.API_AUTH_REQUIRED !== "true") {
    return false;
  }

  // In test environment, respect flag
  if (process.env.NODE_ENV === "test" && process.env.API_AUTH_REQUIRED_IN_TEST !== "true") {
    return false;
  }

  return true;
}

/**
 * Validates that auth is properly configured for the environment.
 * Call once on startup to fail fast if production auth is misconfigured.
 */
export function validateAuthConfig() {
  const required = isAuthRequired();
  if (!required) return; // Auth not required, config is valid

  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "API_AUTH_REQUIRED=true but API_KEY is not set. Set a strong API_KEY in environment variables."
    );
  }

  if (apiKey.length < 32) {
    console.warn(
      "Warning: API_KEY is shorter than 32 characters. Consider using a longer, random key."
    );
  }
}

export function requireApiRole(request: Request, allowedRoles: ApiActorRole[] = ["admin", "operator"]) {
  if (!isAuthRequired()) {
    return;
  }

  const expectedApiKey = process.env.API_KEY;
  if (!expectedApiKey || expectedApiKey.trim().length === 0) {
    // Misconfigured: auth is required but no key is set. Fail gracefully.
    throw new AppError(
      "Invalid credentials",
      403,
      "FORBIDDEN"
    );
  }

  const receivedApiKey = request.headers.get("x-api-key");
  if (receivedApiKey !== expectedApiKey) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const actor = request.headers.get("x-actor-role") as ApiActorRole | null;
  if (!actor || !allowedRoles.includes(actor)) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
}
