import React from "react";
import { z } from "zod";
import { SectionType } from "@/lib/page-layout/types";

export type SettingsFieldDefinition = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "url" | "number" | "checkbox";
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
};

export type SectionDefinition<TSettings> = {
  type: SectionType;
  label: string;
  defaultSettings: TSettings;
  settingsSchema: z.ZodType<TSettings>;
  fields: SettingsFieldDefinition[];
  render: (settings: TSettings) => React.ReactNode;
};
