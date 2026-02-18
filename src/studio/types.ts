import { z } from "zod";

export const blockTypeSchema = z.enum(["text", "image", "cylinder"]);

export const studioBlockBaseSchema = z.object({
  id: z.string().min(1).max(80),
  type: blockTypeSchema
});

export const textBlockPropsSchema = z.object({
  text: z.string().min(1).max(500),
  align: z.enum(["left", "center", "right"]).default("left")
});

export const imageBlockPropsSchema = z.object({
  src: z.string().url().or(z.literal("")),
  alt: z.string().max(200).default("")
});

export const cylinderBlockPropsSchema = z.object({
  label: z.string().min(1).max(80),
  diameterMm: z.number().min(10).max(1000),
  heightMm: z.number().min(10).max(1000)
});

const textBlockSchema = studioBlockBaseSchema.extend({
  type: z.literal("text"),
  props: textBlockPropsSchema
});

const imageBlockSchema = studioBlockBaseSchema.extend({
  type: z.literal("image"),
  props: imageBlockPropsSchema
});

const cylinderBlockSchema = studioBlockBaseSchema.extend({
  type: z.literal("cylinder"),
  props: cylinderBlockPropsSchema
});

export const studioBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  imageBlockSchema,
  cylinderBlockSchema
]);

export const studioLayoutSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  blocks: z.array(studioBlockSchema).max(100)
});

export type StudioBlockType = z.infer<typeof blockTypeSchema>;
export type StudioBlock = z.infer<typeof studioBlockSchema>;
export type StudioLayout = z.infer<typeof studioLayoutSchema>;

export type StudioProposalResponse = {
  proposal_id: string;
  next_layout: StudioLayout;
  json_patch?: Array<{ op: string; path: string; value?: unknown }>;
  summary: string;
  warnings: string[];
};
