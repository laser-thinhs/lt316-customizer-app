const bucket = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(key: string, maxPerMinute = Number(process.env.BATCH_CREATE_RATE_LIMIT_PER_MIN ?? "10")) {
  const now = Date.now();
  const current = bucket.get(key);
  if (!current || now - current.windowStart > 60_000) {
    bucket.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (current.count >= maxPerMinute) return false;
  current.count += 1;
  return true;
}
