import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { createDefaultLayout, parseLayoutFromUnknown, pageLayoutSchema, sanitizeLayout } from "@/lib/page-layout/schemas";
import { PageLayout } from "@/lib/page-layout/types";

const layoutsDir = path.join(process.cwd(), "storage", "page-layouts");

function getLayoutPath(slug: string) {
  return path.join(layoutsDir, `${slug}.json`);
}

export async function readLayout(slug: string): Promise<{ layout: PageLayout; error?: string }> {
  const filePath = getLayoutPath(slug);

  try {
    const file = await fs.readFile(filePath, "utf8");
    return parseLayoutFromUnknown(JSON.parse(file), slug);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { layout: createDefaultLayout(slug) };
    }

    return {
      layout: createDefaultLayout(slug),
      error: "Could not load layout"
    };
  }
}

export async function writeLayout(slug: string, input: unknown): Promise<{ layout?: PageLayout; error?: string }> {
  const parsed = pageLayoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Validation error" };
  }

  const sanitized = sanitizeLayout({ ...parsed.data, slug });

  await fs.mkdir(layoutsDir, { recursive: true });
  await fs.writeFile(getLayoutPath(slug), JSON.stringify(sanitized, null, 2), "utf8");

  return { layout: sanitized };
}
