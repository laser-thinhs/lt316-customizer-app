import { templateRegistrySchema, type Template } from "./schema";

export const templates = templateRegistrySchema.parse([
  {
    id: "40oz_tumbler_wrap",
    name: "40oz Tumbler Wrap",
    wrapWidthMm: 280,
    wrapHeightMm: 110,
    defaultDpi: 300,
    bleedMm: 3,
    safeMarginMm: 5,
    guides: [
      { type: "centerline", axis: "both" },
      { type: "grid", spacingMm: 10 }
    ]
  },
  {
    id: "20oz_tumbler_wrap",
    name: "20oz Tumbler Wrap",
    wrapWidthMm: 240,
    wrapHeightMm: 95,
    defaultDpi: 300,
    bleedMm: 3,
    safeMarginMm: 5,
    guides: [
      { type: "centerline", axis: "both" },
      { type: "grid", spacingMm: 10 }
    ]
  },
  {
    id: "universal_panel_12x12in",
    name: "Universal Panel 12 x 12 in",
    wrapWidthMm: 304.8,
    wrapHeightMm: 304.8,
    defaultDpi: 300,
    bleedMm: 3,
    safeMarginMm: 5,
    guides: [
      { type: "centerline", axis: "both" },
      { type: "grid", spacingMm: 5 }
    ]
  }
]);

export const defaultTemplateId = "40oz_tumbler_wrap";

export function getTemplateById(templateId: string): Template {
  return templates.find((template) => template.id === templateId) ?? templates[0];
}
