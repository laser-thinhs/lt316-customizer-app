import { z } from "zod";
import { SectionDefinition } from "@/sections/types";

const buttonRowSettingsSchema = z.object({
  primaryLabel: z.string().max(40).default(""),
  primaryUrl: z.string().max(2048).default(""),
  secondaryLabel: z.string().max(40).default(""),
  secondaryUrl: z.string().max(2048).default(""),
  align: z.enum(["left", "center", "right"]).default("center")
});

export type ButtonRowSettings = z.infer<typeof buttonRowSettingsSchema>;

export const buttonRowSection: SectionDefinition<ButtonRowSettings> = {
  type: "button-row",
  label: "Button Row",
  defaultSettings: {
    primaryLabel: "Primary",
    primaryUrl: "#",
    secondaryLabel: "Secondary",
    secondaryUrl: "#",
    align: "center"
  },
  settingsSchema: buttonRowSettingsSchema,
  fields: [
    { key: "primaryLabel", label: "Primary label", kind: "text" },
    { key: "primaryUrl", label: "Primary URL", kind: "url" },
    { key: "secondaryLabel", label: "Secondary label", kind: "text" },
    { key: "secondaryUrl", label: "Secondary URL", kind: "url" },
    { key: "align", label: "Alignment (left/center/right)", kind: "text" }
  ],
  render: (settings) => (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div
        className={`flex flex-wrap gap-3 ${
          settings.align === "left" ? "justify-start" : settings.align === "right" ? "justify-end" : "justify-center"
        }`}
      >
        {settings.primaryLabel ? (
          <a href={settings.primaryUrl || "#"} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            {settings.primaryLabel}
          </a>
        ) : null}
        {settings.secondaryLabel ? (
          <a href={settings.secondaryUrl || "#"} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">
            {settings.secondaryLabel}
          </a>
        ) : null}
      </div>
    </section>
  )
};
