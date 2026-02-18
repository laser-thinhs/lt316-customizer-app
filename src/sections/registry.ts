import { SectionType } from "@/lib/page-layout/types";
import { buttonRowSection } from "@/sections/button-row";
import { heroSection } from "@/sections/hero";
import { imageTextSection } from "@/sections/image-text";
import { richTextSection } from "@/sections/rich-text";
import { SectionDefinition } from "@/sections/types";

function asUnknownSection<TSettings>(definition: SectionDefinition<TSettings>): SectionDefinition<unknown> {
  return definition as unknown as SectionDefinition<unknown>;
}

export const sectionRegistry: Record<SectionType, SectionDefinition<unknown>> = {
  hero: asUnknownSection(heroSection),
  richText: asUnknownSection(richTextSection),
  imageText: asUnknownSection(imageTextSection),
  buttonRow: asUnknownSection(buttonRowSection)
};

export function getSectionDefinition(type: SectionType) {
  return sectionRegistry[type];
}

export function listSectionDefinitions() {
  return Object.values(sectionRegistry);
}
