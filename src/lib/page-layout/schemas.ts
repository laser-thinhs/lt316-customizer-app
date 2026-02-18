import { z } from "zod";
import { PageLayout, SectionType, SECTION_TYPES } from "@/lib/page-layout/types";
import { sectionRegistry } from "@/sections/registry";

const sectionTypeSchema = z.enum(SECTION_TYPES);

export const sectionInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  settings: z.unknown(),
  hidden: z.boolean().optional()
});

export const pageLayoutSchema = z.object({
  slug: z.string().min(1),
  sections: z.array(sectionInstanceSchema)
});

function isSectionType(value: string): value is SectionType {
  return sectionTypeSchema.safeParse(value).success;
}

export function createDefaultLayout(slug: string): PageLayout {
  return {
    slug,
    sections: [
      {
        id: `${slug}-hero-1`,
        type: "hero",
        settings: sectionRegistry.hero.defaultSettings
      },
      {
        id: `${slug}-richText-1`,
        type: "richText",
        settings: sectionRegistry.richText.defaultSettings
      }
    ]
  };
}

export function sanitizeLayout(layout: z.infer<typeof pageLayoutSchema>): PageLayout {
  const sanitizedSections = layout.sections.flatMap((section) => {
    if (!isSectionType(section.type)) {
      return [];
    }

    const definition = sectionRegistry[section.type];
    const parsedSettings = definition.settingsSchema.safeParse(section.settings);

    return [
      {
        id: section.id,
        type: definition.type,
        hidden: section.hidden,
        settings: parsedSettings.success ? parsedSettings.data : definition.defaultSettings
      }
    ];
  });

  return {
    slug: layout.slug,
    sections: sanitizedSections
  };
}

export function parseLayoutFromUnknown(value: unknown, slug: string): { layout: PageLayout; error?: string } {
  const parsed = pageLayoutSchema.safeParse(value);

  if (!parsed.success) {
    return {
      layout: createDefaultLayout(slug),
      error: parsed.error.issues.map((issue) => issue.message).join("; ")
    };
  }

  return {
    layout: sanitizeLayout(parsed.data)
  };
}
