/**
 * Tracing presets for common use cases
 */

export type TracingPreset = {
  id: string;
  name: string;
  description: string;
  settings: {
    threshold?: number; // 0-255
    smoothing?: number; // 0-10
    despeckle?: number; // 0-10
    simplify?: number; // 0-10
    outputMode?: "fill" | "stroke";
    strokeWidth?: number;
    bgTolerance?: number; // 0-60
    assumeWhiteBg?: boolean;
  };
};

export const TRACING_PRESETS: Record<string, TracingPreset> = {
  logoClean: {
    id: "logoClean",
    name: "Logo Clean",
    description: "High-contrast logos with clean edges",
    settings: {
      threshold: 175,
      simplify: 4,
      despeckle: 6,
      smoothing: 2,
      outputMode: "fill",
      bgTolerance: 10,
      assumeWhiteBg: true
    }
  },

  photoEngrave: {
    id: "photoEngrave",
    name: "Photo to Engrave",
    description: "Convert photos to engraving patterns",
    settings: {
      threshold: 155,
      smoothing: 5,
      despeckle: 10,
      simplify: 2,
      outputMode: "fill",
      bgTolerance: 20,
      assumeWhiteBg: true
    }
  },

  cutOutline: {
    id: "cutOutline",
    name: "Cut Outline",
    description: "Single-line strokes for cutting",
    settings: {
      threshold: 180,
      simplify: 5,
      despeckle: 8,
      smoothing: 1,
      outputMode: "stroke",
      strokeWidth: 1,
      bgTolerance: 5,
      assumeWhiteBg: true
    }
  },

  fineDetail: {
    id: "fineDetail",
    name: "Fine Detail",
    description: "Preserve intricate details",
    settings: {
      threshold: 165,
      smoothing: 1,
      despeckle: 2,
      simplify: 1,
      outputMode: "fill",
      bgTolerance: 5,
      assumeWhiteBg: true
    }
  }
};

export const PRESET_OPTIONS = Object.values(TRACING_PRESETS).map((p) => ({
  value: p.id,
  label: p.name,
  description: p.description
}));

export function getPreset(id: string): TracingPreset | null {
  return TRACING_PRESETS[id] || null;
}
