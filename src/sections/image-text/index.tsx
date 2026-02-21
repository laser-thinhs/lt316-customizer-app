import { z } from "zod";
import { SectionDefinition } from "@/sections/types";

export type ImageTextSettings = {
  imageUrl: string;
  heading: string;
  body: string;
  imageSide: "left" | "right";
};

const imageTextSettingsSchema: z.ZodType<ImageTextSettings> = z.object({
  imageUrl: z.string().max(2048),
  heading: z.string().max(120),
  body: z.string().max(1200),
  imageSide: z.enum(["left", "right"])
});

export const imageTextSection: SectionDefinition<ImageTextSettings> = {
  type: "imageText",
  label: "Image + Text",
  defaultSettings: {
    heading: "Feature spotlight",
    body: "Pair an image with copy to emphasize your best products.",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=80",
    imageSide: "left"
  },
  settingsSchema: imageTextSettingsSchema,
  fields: [
    { key: "imageUrl", label: "Image URL", kind: "url" },
    { key: "heading", label: "Heading", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
    {
      key: "imageSide",
      label: "Image side",
      kind: "select",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" }
      ]
    }
  ],
  render: (settings) => (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className={`grid gap-6 md:grid-cols-2 ${settings.imageSide === "left" ? "" : "md:[&>*:first-child]:order-last"}`}>
        <img src={settings.imageUrl} alt={settings.heading || "Image"} className="h-64 w-full rounded-lg object-cover" />
        <div className="flex flex-col justify-center">
          {settings.heading ? <h2 className="text-2xl font-semibold text-slate-900">{settings.heading}</h2> : null}
          {settings.body ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{settings.body}</p> : null}
        </div>
      </div>
    </section>
  )
};
