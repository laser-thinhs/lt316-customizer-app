import { z } from "zod";
import { SectionDefinition } from "@/sections/types";

const heroSettingsSchema = z.object({
  heading: z.string().min(1).max(120),
  subheading: z.string().max(320).default(""),
  ctaLabel: z.string().max(40).default(""),
  ctaUrl: z.string().max(2048).default(""),
  backgroundImageUrl: z.string().max(2048).default("")
});

export type HeroSettings = z.infer<typeof heroSettingsSchema>;

export const heroSection: SectionDefinition<HeroSettings> = {
  type: "hero",
  label: "Hero",
  defaultSettings: {
    heading: "Build your perfect layout",
    subheading: "Add sections and customize them in real time.",
    ctaLabel: "Get started",
    ctaUrl: "#",
    backgroundImageUrl: ""
  },
  settingsSchema: heroSettingsSchema,
  fields: [
    { key: "heading", label: "Heading", kind: "text", placeholder: "Big headline" },
    { key: "subheading", label: "Subheading", kind: "textarea", placeholder: "Supporting text" },
    { key: "ctaLabel", label: "CTA label", kind: "text", placeholder: "Shop now" },
    { key: "ctaUrl", label: "CTA URL", kind: "url", placeholder: "https://" },
    { key: "backgroundImageUrl", label: "Background image URL", kind: "url", placeholder: "https://" }
  ],
  render: (settings) => (
    <section
      className="rounded-xl border border-slate-200 px-6 py-16 text-center text-white"
      style={{
        background: settings.backgroundImageUrl
          ? `linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.55)), url(${settings.backgroundImageUrl}) center / cover`
          : "linear-gradient(135deg, rgb(30 41 59), rgb(15 23 42))"
      }}
    >
      <h1 className="text-3xl font-bold md:text-4xl">{settings.heading}</h1>
      {settings.subheading ? <p className="mx-auto mt-3 max-w-2xl text-base text-slate-200">{settings.subheading}</p> : null}
      {settings.ctaLabel ? (
        <a href={settings.ctaUrl || "#"} className="mt-6 inline-flex rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900">
          {settings.ctaLabel}
        </a>
      ) : null}
    </section>
  )
};
