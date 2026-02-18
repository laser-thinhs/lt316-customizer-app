export const SECTION_TYPES = ["hero", "rich-text", "image-text", "button-row"] as const;

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
