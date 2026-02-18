const MAX_PATCH_SIZE_BYTES = 200 * 1024;
const MAX_CHANGED_FILES = 12;

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".md", ".json"]);
const ALWAYS_FORBIDDEN_PREFIXES = [
  ".next/",
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  "coverage/",
];
const ALLOWED_PREFIXES = ["src/studio/", "src/components/", "src/app/(studio)/"];

export type PatchValidation = {
  files: string[];
  errors: string[];
  warnings: string[];
};

function normalizePath(path: string) {
  return path.replace(/^([ab])\//, "").replace(/^\.\//, "");
}

function extensionFor(path: string) {
  const idx = path.lastIndexOf(".");
  return idx >= 0 ? path.slice(idx) : "";
}

function isForbiddenPath(path: string) {
  return ALWAYS_FORBIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isAllowedPath(path: string) {
  return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function parseDiffPaths(patch: string): { paths: string[]; renames: string[]; deletions: string[] } {
  const lines = patch.split(/\r?\n/);
  const paths = new Set<string>();
  const renames: string[] = [];
  const deletions: string[] = [];

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      const parts = line.split(" ");
      if (parts.length >= 4) {
        const rightPath = normalizePath(parts[3]);
        paths.add(rightPath);
      }
      continue;
    }

    if (line.startsWith("+++ ")) {
      const file = line.slice(4).trim();
      if (file !== "/dev/null") {
        paths.add(normalizePath(file));
      }
      continue;
    }

    if (line.startsWith("rename to ")) {
      renames.push(normalizePath(line.slice("rename to ".length).trim()));
      continue;
    }

    if (line.startsWith("deleted file mode ")) {
      const lastPath = [...paths].at(-1);
      if (lastPath) {
        deletions.push(lastPath);
      }
    }
  }

  return {
    paths: [...paths],
    renames,
    deletions,
  };
}

export function validatePatchAgainstPolicy(patch: string): PatchValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const size = Buffer.byteLength(patch, "utf8");
  if (size > MAX_PATCH_SIZE_BYTES) {
    errors.push(`Patch exceeds max size of ${MAX_PATCH_SIZE_BYTES} bytes.`);
  }

  const { paths, renames, deletions } = parseDiffPaths(patch);

  if (paths.length === 0) {
    errors.push("Patch does not contain any file headers.");
  }

  if (paths.length > MAX_CHANGED_FILES) {
    errors.push(`Patch exceeds max file count of ${MAX_CHANGED_FILES}.`);
  }

  const lockfilesEnabled = process.env.STUDIO_CODEGEN_ALLOW_LOCKFILES === "true";

  for (const path of paths) {
    if (!path || path.includes("..")) {
      errors.push(`Invalid patch path: ${path}`);
      continue;
    }

    if (isForbiddenPath(path)) {
      errors.push(`Forbidden patch path: ${path}`);
      continue;
    }

    if (!isAllowedPath(path)) {
      errors.push(`Path outside allowlist: ${path}`);
      continue;
    }

    const ext = extensionFor(path);
    const isLockfile = /(^|\/)package-lock\.json$|(^|\/)pnpm-lock\.yaml$|(^|\/)yarn\.lock$/.test(path);

    if (isLockfile && !lockfilesEnabled) {
      errors.push(`Lockfile changes are disabled by default: ${path}`);
      continue;
    }

    if (!ALLOWED_EXTENSIONS.has(ext) && !isLockfile) {
      errors.push(`Unsupported file extension for ${path}`);
    }
  }

  for (const renamePath of renames) {
    if (!renamePath.startsWith("src/studio/")) {
      errors.push(`Renames are only allowed inside src/studio/**: ${renamePath}`);
    }
  }

  for (const deletionPath of deletions) {
    if (!deletionPath.startsWith("src/studio/")) {
      errors.push(`Deletions are only allowed inside src/studio/**: ${deletionPath}`);
    } else {
      warnings.push(`Deletion detected in studio path: ${deletionPath}`);
    }
  }

  return { files: paths, errors, warnings };
}
