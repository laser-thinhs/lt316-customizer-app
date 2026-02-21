import { z } from "zod";
import { SectionDefinition } from "@/sections/types";

export type HeroSettings = {
  headline: string;
  subhead: string;
  ctaText: string;
  ctaHref: string;
  imageUrl: string;
  overlay: number;
  align: "left" | "center";
};

const heroSettingsSchema: z.ZodType<HeroSettings> = z.object({
  headline: z.string().min(1).max(120),
  subhead: z.string().max(320),
  ctaText: z.string().max(40),
  ctaHref: z.string().max(2048),
  imageUrl: z.string().max(2048),
  overlay: z.number().min(0).max(1),
  align: z.enum(["left", "center"])
});

export const heroSection: SectionDefinition<HeroSettings> = {
  type: "hero",
  label: "Hero",
  defaultSettings: {
    headline: "Build your perfect layout",
    subhead: "Add sections and customize them in real time.",
    ctaText: "Get started",
    ctaHref: "#",
    imageUrl: "",
    overlay: 0.55,
    align: "center"
  },
  settingsSchema: heroSettingsSchema,
  fields: [
    { key: "headline", label: "Headline", kind: "text", placeholder: "Big headline" },
    { key: "subhead", label: "Subhead", kind: "textarea", placeholder: "Supporting text" },
    { key: "ctaText", label: "CTA text", kind: "text" },
    { key: "ctaHref", label: "CTA href", kind: "url", placeholder: "https://" },
    { key: "imageUrl", label: "Image URL", kind: "url", placeholder: "https://" },
    { key: "overlay", label: "Overlay (0-1)", kind: "number", min: 0, max: 1, step: 0.05 },
    {
      key: "align",
      label: "Alignment",
      kind: "select",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" }
      ]
    }
  ],
  render: (settings) => (
    <section
      className={`rounded-xl border border-slate-200 px-6 py-16 text-white ${settings.align === "left" ? "text-left" : "text-center"}`}
      style={{
        background: settings.imageUrl
          ? `linear-gradient(rgba(15,23,42,${settings.overlay}), rgba(15,23,42,${settings.overlay})), url(${settings.imageUrl}) center / cover`
          : "linear-gradient(135deg, rgb(30 41 59), rgb(15 23 42))"
      }}
    >
      <h1 className="text-3xl font-bold md:text-4xl">{settings.headline}</h1>
      {settings.subhead ? <p className="mt-3 max-w-2xl text-base text-slate-200">{settings.subhead}</p> : null}
      {settings.ctaText ? (
        <a href={settings.ctaHref || "#"} className="mt-6 inline-flex rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900">
          {settings.ctaText}
        </a>
      ) : null}
    </section>
  )
};
