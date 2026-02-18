import { z } from "zod";
import { SectionDefinition } from "@/sections/types";

export type RichTextSettings = {
  content: string;
};

const richTextSettingsSchema: z.ZodType<RichTextSettings> = z.object({
  content: z.string().min(1).max(4000)
});

export const richTextSection: SectionDefinition<RichTextSettings> = {
  type: "richText",
  label: "Rich Text",
  defaultSettings: {
    content: "Use this section to describe your products, brand values, and key details."
  },
  settingsSchema: richTextSettingsSchema,
  fields: [{ key: "content", label: "Content", kind: "textarea", placeholder: "Write content..." }],
  render: (settings) => (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{settings.content}</p>
    </section>
  )
};
