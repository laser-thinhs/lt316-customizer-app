export const SECTION_TYPES = ["hero", "richText", "imageText", "buttonRow"] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export type SectionInstance = {
  id: string;
  type: SectionType;
  settings: unknown;
  hidden?: boolean;
};

export type PageLayout = {
  slug: string;
  sections: SectionInstance[];
};
