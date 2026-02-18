import { z } from "zod";
import { SectionDefinition } from "@/sections/types";

export type ImageTextSettings = {
  title: string;
  text: string;
  imageUrl: string;
  imageAlt: string;
  imageLeft: boolean;
};

const imageTextSettingsSchema: z.ZodType<ImageTextSettings> = z.object({
  title: z.string().max(120).default(""),
  text: z.string().max(1200).default(""),
  imageUrl: z.string().max(2048),
  imageAlt: z.string().max(200).default(""),
  imageLeft: z.boolean().default(true)
}) as z.ZodType<ImageTextSettings>;

export const imageTextSection: SectionDefinition<ImageTextSettings> = {
  type: "image-text",
  label: "Image + Text",
  defaultSettings: {
    title: "Feature spotlight",
    text: "Pair an image with copy to emphasize your best products.",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=80",
    imageAlt: "Showcase",
    imageLeft: true
  },
  settingsSchema: imageTextSettingsSchema,
  fields: [
    { key: "title", label: "Title", kind: "text" },
    { key: "text", label: "Text", kind: "textarea" },
    { key: "imageUrl", label: "Image URL", kind: "url" },
    { key: "imageAlt", label: "Image alt", kind: "text" },
    { key: "imageLeft", label: "Image on left", kind: "checkbox" }
  ],
  render: (settings) => (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className={`grid gap-6 md:grid-cols-2 ${settings.imageLeft ? "" : "md:[&>*:first-child]:order-last"}`}>
        <img src={settings.imageUrl} alt={settings.imageAlt || ""} className="h-64 w-full rounded-lg object-cover" />
        <div className="flex flex-col justify-center">
          {settings.title ? <h2 className="text-2xl font-semibold text-slate-900">{settings.title}</h2> : null}
          {settings.text ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{settings.text}</p> : null}
        </div>
      </div>
    </section>
  )
};
