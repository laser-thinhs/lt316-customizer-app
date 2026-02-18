import { z } from "zod";
import { SectionDefinition } from "@/sections/types";

type ButtonItem = {
  label: string;
  href: string;
};

export type ButtonRowSettings = {
  buttons: ButtonItem[];
};

const buttonItemSchema: z.ZodType<ButtonItem> = z.object({
  label: z.string().max(40),
  href: z.string().max(2048)
});

const buttonRowSettingsSchema: z.ZodType<ButtonRowSettings> = z.object({
  buttons: z.array(buttonItemSchema).max(6)
});

export const buttonRowSection: SectionDefinition<ButtonRowSettings> = {
  type: "buttonRow",
  label: "Button Row",
  defaultSettings: {
    buttons: [
      { label: "Primary", href: "#" },
      { label: "Secondary", href: "#" }
    ]
  },
  settingsSchema: buttonRowSettingsSchema,
  fields: [{ key: "buttons", label: "Buttons (label|href per line)", kind: "textarea" }],
  render: (settings) => (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap justify-center gap-3">
        {settings.buttons.map((button, index) => (
          <a
            key={`${button.label}-${index}`}
            href={button.href || "#"}
            className={index === 0 ? "rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" : "rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"}
          >
            {button.label}
          </a>
        ))}
      </div>
    </section>
  )
};
