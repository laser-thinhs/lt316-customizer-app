import "server-only";

import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { AppError } from "@/lib/errors";

const SESSION_COOKIE = "studio_session";
const CSRF_COOKIE = "studio_csrf";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function mustEnableStudio() {
  if (process.env.STUDIO_ENABLED !== "true") {
    throw new AppError("Studio disabled", 404, "STUDIO_DISABLED");
  }
}

function getPassword() {
  const password = process.env.STUDIO_PASSWORD?.trim();
  if (!password) {
    throw new AppError("Studio password not configured", 500, "STUDIO_PASSWORD_MISSING");
  }
  return password;
}

function sign(value: string) {
  const secret = process.env.STUDIO_PASSWORD || "studio-dev-secret";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export async function createStudioSession() {
  mustEnableStudio();
  const nonce = crypto.randomUUID();
  const token = `${nonce}.${sign(nonce)}`;
  const csrf = crypto.randomUUID().replace(/-/g, "");
  const store = await cookies();

  store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: MAX_AGE_SECONDS, path: "/" });
  store.set(CSRF_COOKIE, csrf, { httpOnly: false, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: MAX_AGE_SECONDS, path: "/" });

  return { csrfToken: csrf };
}

export async function requireStudioSession(requireCsrf = false) {
  mustEnableStudio();
  const store = await cookies();
  const sessionValue = store.get(SESSION_COOKIE)?.value;
  if (!sessionValue) {
    throw new AppError("Unauthorized", 401, "STUDIO_UNAUTHORIZED");
  }

  const [nonce, signature] = sessionValue.split(".");
  if (!nonce || !signature || sign(nonce) !== signature) {
    throw new AppError("Unauthorized", 401, "STUDIO_UNAUTHORIZED");
  }

  const csrfCookie = store.get(CSRF_COOKIE)?.value;
  if (requireCsrf) {
    const requestHeaders = await headers();
    const csrfHeader = requestHeaders.get("x-studio-csrf");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new AppError("Invalid CSRF token", 403, "CSRF_INVALID");
    }
  }

  return { csrfToken: csrfCookie ?? "" };
}

export function verifyStudioPassword(password: string) {
  mustEnableStudio();
  const expected = getPassword();
  if (!password || password.length > 200) {
    throw new AppError("Invalid password", 400, "INVALID_PASSWORD");
  }

  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AppError("Unauthorized", 401, "STUDIO_UNAUTHORIZED");
  }
}

const hits = new Map<string, number[]>();
export function checkStudioRateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const existing = hits.get(key) ?? [];
  const recent = existing.filter((ts) => now - ts < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (recent.length > limit) {
    throw new AppError("Too many requests", 429, "RATE_LIMITED");
  }
}

export async function getRequestIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}
