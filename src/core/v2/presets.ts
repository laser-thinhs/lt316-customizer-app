import { LensPreset, MachinePreset, ObjectDefinition, SettingsPreset } from "@/core/v2/types";

export const objectPresets: ObjectDefinition[] = [
  {
    id: "tumbler-20oz",
    name: "Tumbler 20oz",
    type: "cylinder",
    dimensions_mm: { diameter: 73, height: 210 },
    safeArea_mm: { x: 5, y: 8, width: 219, height: 194 },
    defaultSeam_mm: 0
  },
  {
    id: "tumbler-30oz",
    name: "Tumbler 30oz",
    type: "cylinder",
    dimensions_mm: { diameter: 80, height: 240 },
    safeArea_mm: { x: 5, y: 8, width: 241, height: 224 },
    defaultSeam_mm: 0
  },
  {
    id: "tumbler-40oz",
    name: "Tumbler 40oz",
    type: "cylinder",
    dimensions_mm: { diameter: 90, height: 265 },
    safeArea_mm: { x: 5, y: 10, width: 272, height: 245 },
    defaultSeam_mm: 0
  },
  {
    id: "flat-rect-m",
    name: "Flat Rectangle M",
    type: "flat",
    dimensions_mm: { width: 200, height: 120 },
    safeArea_mm: { x: 5, y: 5, width: 190, height: 110 },
    defaultSeam_mm: 0
  }
];

export const machinePresets: MachinePreset[] = [
  { id: "fiber-1", name: "Fiber 30W", type: "fiber" },
  { id: "co2-1", name: "CO2 60W", type: "co2" },
  { id: "uv-1", name: "UV 15W", type: "uv" }
];

export const lensPresets: LensPreset[] = [
  { id: "lens-110", name: "110x110", field_mm: { width: 110, height: 110 } },
  { id: "lens-150", name: "150x150", field_mm: { width: 150, height: 150 } },
  { id: "lens-200", name: "200x200", field_mm: { width: 200, height: 200 } }
];

export const settingsPresets: SettingsPreset[] = [
  { id: "std-marking", name: "Standard Marking" },
  { id: "deep-engrave", name: "Deep Engrave" },
  { id: "fast-pass", name: "Fast Pass" }
];

export const defaultDestinationRule = "/storage/v2-runtime/jobs/{YYYY}/{MM}/{JOBID}/";