import { z } from "zod";
import { PageLayout } from "@/lib/page-layout/types";
import { sectionRegistry } from "@/sections/registry";

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
        id: `${slug}-rich-text-1`,
        type: "rich-text",
        settings: sectionRegistry["rich-text"].defaultSettings
      }
    ]
  };
}

export function sanitizeLayout(layout: z.infer<typeof pageLayoutSchema>): PageLayout {
  const sanitizedSections = layout.sections.flatMap((section) => {
    const definition = sectionRegistry[section.type as keyof typeof sectionRegistry];

    if (!definition) {
      console.warn(`Skipping unknown section type: ${String(section.type)}`);
      return [];
    }

    const parsedSettings = definition.settingsSchema.safeParse(section.settings);

    if (!parsedSettings.success) {
      console.warn(`Invalid settings for section ${section.id}; using defaults.`);
      return [
        {
          id: section.id,
          type: definition.type,
          hidden: section.hidden,
          settings: definition.defaultSettings
        }
      ];
    }

    return [
      {
        id: section.id,
        type: definition.type,
        hidden: section.hidden,
        settings: parsedSettings.data
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
      error: "Validation error. A default layout was loaded."
    };
  }

  return {
    layout: sanitizeLayout(parsed.data)
  };
}
