import { buttonRowSection } from "@/sections/button-row";
import { heroSection } from "@/sections/hero";
import { imageTextSection } from "@/sections/image-text";
import { richTextSection } from "@/sections/rich-text";
import { SectionDefinition } from "@/sections/types";
import { SectionType } from "@/lib/page-layout/types";

function asUnknownSection<TSettings>(definition: SectionDefinition<TSettings>): SectionDefinition<unknown> {
  return definition as unknown as SectionDefinition<unknown>;
}

const sectionRegistry: Record<SectionType, SectionDefinition<unknown>> = {
  hero: asUnknownSection(heroSection),
  "rich-text": asUnknownSection(richTextSection),
  "image-text": asUnknownSection(imageTextSection),
  "button-row": asUnknownSection(buttonRowSection)
};

export function getSectionDefinition(type: SectionType) {
  return sectionRegistry[type];
}

export function listSectionDefinitions() {
  return Object.values(sectionRegistry);
}

export { sectionRegistry };
