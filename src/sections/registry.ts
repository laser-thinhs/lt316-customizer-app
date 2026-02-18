import { SectionType } from "@/lib/page-layout/types";
import { buttonRowSection } from "@/sections/button-row";
import { heroSection } from "@/sections/hero";
import { imageTextSection } from "@/sections/image-text";
import { richTextSection } from "@/sections/rich-text";
import { SectionDefinition } from "@/sections/types";

export const sectionRegistry: Record<SectionType, SectionDefinition<unknown>> = {
  hero: heroSection as SectionDefinition<unknown>,
  richText: richTextSection as SectionDefinition<unknown>,
  imageText: imageTextSection as SectionDefinition<unknown>,
  buttonRow: buttonRowSection as SectionDefinition<unknown>
};

export function getSectionDefinition(type: SectionType) {
  return sectionRegistry[type];
}

export function listSectionDefinitions() {
  return Object.values(sectionRegistry);
}
