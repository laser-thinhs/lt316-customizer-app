import { buttonRowSection } from "@/sections/button-row";
import { heroSection } from "@/sections/hero";
import { imageTextSection } from "@/sections/image-text";
import { richTextSection } from "@/sections/rich-text";
import { SectionDefinition } from "@/sections/types";
import { SectionType } from "@/lib/page-layout/types";

const sectionRegistry: Record<SectionType, SectionDefinition<unknown>> = {
  hero: heroSection,
  "rich-text": richTextSection,
  "image-text": imageTextSection,
  "button-row": buttonRowSection
};

export function getSectionDefinition(type: SectionType) {
  return sectionRegistry[type];
}

export function listSectionDefinitions() {
  return Object.values(sectionRegistry);
}

export { sectionRegistry };
