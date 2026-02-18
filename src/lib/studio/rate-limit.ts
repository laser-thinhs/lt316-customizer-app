const buckets = new Map<string, number[]>();

export function checkStudioProposeRateLimit(key: string, limit = 6, windowMs = 60_000) {
  const now = Date.now();
  const existing = buckets.get(key) ?? [];
  const recent = existing.filter((ts) => now - ts <= windowMs);

  if (recent.length >= limit) {
    return false;
  }

  recent.push(now);
  buckets.set(key, recent);
  return true;
}
