export type SceneBackground =
  | { type: "solid"; colorA: string; colorB?: null; env?: null }
  | { type: "gradient"; colorA: string; colorB: string; env?: null }
  | { type: "env"; colorA?: null; colorB?: null; env: "studio" | "warehouse" | "city" | "apartment" };

export type SceneLight = {
  intensity: number;
  pos: [number, number, number];
};

export type ScenePreset = {
  id: string;
  label: string;
  background: SceneBackground;
  lights: {
    ambient: number;
    key: SceneLight;
    fill: SceneLight;
    rim: SceneLight;
  };
  ground: {
    enabled: boolean;
    y: number;
    shadowOpacity: number;
    size: number;
  };
};

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "studio-soft",
    label: "Studio Soft",
    background: { type: "gradient", colorA: "#f1f5f9", colorB: "#cbd5e1" },
    lights: {
      ambient: 0.35,
      key: { intensity: 1.2, pos: [3, 4, 2] },
      fill: { intensity: 0.55, pos: [-3, 2, 1] },
      rim: { intensity: 0.4, pos: [0, 3, -4] }
    },
    ground: { enabled: true, y: -0.8, shadowOpacity: 0.25, size: 20 }
  },
  {
    id: "dark-navy",
    label: "Dark Navy",
    background: { type: "solid", colorA: "#0f172a" },
    lights: {
      ambient: 0.24,
      key: { intensity: 1.0, pos: [2.5, 3.5, 2.5] },
      fill: { intensity: 0.35, pos: [-3, 1.5, 0.5] },
      rim: { intensity: 0.65, pos: [-1, 4, -3] }
    },
    ground: { enabled: true, y: -0.82, shadowOpacity: 0.2, size: 22 }
  },
  {
    id: "bright-showroom",
    label: "Bright Showroom",
    background: { type: "env", env: "warehouse" },
    lights: {
      ambient: 0.45,
      key: { intensity: 1.5, pos: [4, 4, 3] },
      fill: { intensity: 0.75, pos: [-4, 3, 2] },
      rim: { intensity: 0.5, pos: [0, 4, -5] }
    },
    ground: { enabled: true, y: -0.78, shadowOpacity: 0.22, size: 24 }
  },
  {
    id: "moody-rim-light",
    label: "Moody Rim Light",
    background: { type: "gradient", colorA: "#111827", colorB: "#020617" },
    lights: {
      ambient: 0.16,
      key: { intensity: 0.85, pos: [2, 2.8, 3.2] },
      fill: { intensity: 0.2, pos: [-2.5, 1.6, 1.5] },
      rim: { intensity: 1.25, pos: [0.4, 3.6, -3.8] }
    },
    ground: { enabled: true, y: -0.86, shadowOpacity: 0.32, size: 20 }
  }
];

export const DEFAULT_SCENE_PRESET_ID = "studio-soft";

export function getScenePresetById(id: string) {
  return SCENE_PRESETS.find((preset) => preset.id === id) ?? SCENE_PRESETS[0];
}
