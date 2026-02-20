import fs from "node:fs/promises";
import path from "node:path";

export type YetiTemplateColor = {
  id: string;
  label: string;
  materialPath: string;
  hex?: string;
};

export type YetiTemplateDesign = {
  id: string;
  label: string;
  gblPath: string;
  previewSvgPath: string;
};

export type YetiTemplateStyle = {
  id: string;
  label: string;
  height_mm: number;
  diameter_mm: number;
  meshPath: string;
  colors: YetiTemplateColor[];
  designs: YetiTemplateDesign[];
};

export type YetiTemplateManifest = {
  product: "yeti" | string;
  styles: YetiTemplateStyle[];
};

const manifestPath = path.join(process.cwd(), "public", "templates", "yeti", "manifest.json");

export async function getYetiTemplateManifest(): Promise<YetiTemplateManifest> {
  const content = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(content) as YetiTemplateManifest;
}

export async function getYetiStyle(styleId: string): Promise<YetiTemplateStyle | null> {
  const manifest = await getYetiTemplateManifest();
  return manifest.styles.find((style) => style.id === styleId) ?? null;
}
