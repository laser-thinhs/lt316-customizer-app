import { z } from "zod";
import { SectionDefinition } from "@/sections/types";

const richTextSettingsSchema = z.object({
  title: z.string().max(120).default(""),
  body: z.string().min(1).max(4000)
});

export type RichTextSettings = z.infer<typeof richTextSettingsSchema>;

export const richTextSection: SectionDefinition<RichTextSettings> = {
  type: "rich-text",
  label: "Rich Text",
  defaultSettings: {
    title: "Tell your story",
    body: "Use this section to describe your products, brand values, and key details."
  },
  settingsSchema: richTextSettingsSchema,
  fields: [
    { key: "title", label: "Title", kind: "text", placeholder: "Section title" },
    { key: "body", label: "Body", kind: "textarea", placeholder: "Write content..." }
  ],
  render: (settings) => (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      {settings.title ? <h2 className="text-2xl font-semibold text-slate-900">{settings.title}</h2> : null}
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{settings.body}</p>
    </section>
  )
};
