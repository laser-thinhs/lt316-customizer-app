import fs from "node:fs/promises";
import path from "node:path";

const RETRYABLE = new Set(["EBUSY", "EPERM", "EMFILE", "ENFILE"]);

export const dataRoot = path.join(process.cwd(), "data");
export const jobsRoot = path.join(dataRoot, "jobs");
export const recordsRoot = path.join(jobsRoot, "records");

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function withFsRetries<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let error: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      error = err;
      const code = (err as NodeJS.ErrnoException)?.code;
      if (!code || !RETRYABLE.has(code) || i === attempts - 1) throw err;
      await wait(30 * (i + 1));
    }
  }
  throw error;
}

export async function atomicWriteJson(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  const temp = `${filePath}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await withFsRetries(() => fs.writeFile(temp, payload, "utf8"));
  await withFsRetries(() => fs.rename(temp, filePath));
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const text = await withFsRetries(() => fs.readFile(filePath, "utf8"));
    return JSON.parse(text) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}