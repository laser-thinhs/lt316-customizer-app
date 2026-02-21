export type ObjectType = "cylinder" | "flat";

export type ObjectDefinition = {
  id: string;
  name: string;
  type: ObjectType;
  dimensions_mm: {
    diameter?: number;
    width?: number;
    height: number;
  };
  safeArea_mm: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  defaultSeam_mm: number;
};

export type DesignAsset = {
  id: string;
  originalSvgPath: string;
  originalSvgPublicUrl?: string;
  normalizedSvgPath?: string;
  bbox: { width: number; height: number };
  createdAt: string;
};

export type Placement = {
  x_mm: number;
  y_mm: number;
  scale: number;
  rotation_deg: number;
  coordinateSpace: "unwrapped_mm" | "bed_mm";
  wrapEnabled: boolean;
  seamX_mm: number;
};

export type JobStatus = "draft" | "submitted" | "in_review" | "production_ready" | "completed";

export type DesignJob = {
  id: string;
  status: JobStatus;
  customerName?: string;
  customerEmail?: string;
  objectDefinitionId: string;
  assetId?: string;
  placement: Placement;
  createdAt: string;
  updatedAt: string;
  productionConfig?: ProductionConfig;
  bedLayout?: BedLayout;
  productTemplateId?: string;
  colorId?: string;
  templateDesignId?: string;
  templateGblPath?: string;
  templatePreviewSvgPath?: string;
  templateMeshPath?: string;
  bedPresetId?: string;
  bedLayoutOverrideEnabled?: boolean;
  bedLayoutOverride?: BedLayout;
  selectedAdminAssetIds?: string[];
};

export type BedPreset = {
  id: string;
  name: string;
  isDefault?: boolean;
  bedW_mm: number;
  bedH_mm: number;
  grid: {
    enabled: boolean;
    spacing: number;
    offsetX_mm: number;
    offsetY_mm: number;
    snapToGrid: boolean;
    showIntersections: boolean;
  };
  rotaryDefaults: {
    showRotary: boolean;
    axisY_mm: number;
    chuckX_mm: number;
    tailstockX_mm: number;
    cylinderDiameter_mm: number;
  };
  holes: {
    gridEnabled: boolean;
    spacing: number;
    offsetX_mm: number;
    offsetY_mm: number;
    customHoles: Array<{ x_mm: number; y_mm: number }>;
  };
};

export type AdminAssetType = "lightburn-system" | "hatch-library" | "other";

export type AdminAssetRecord = {
  id: string;
  type: AdminAssetType;
  originalFilename: string;
  storedPath: string;
  createdAt: string;
};

export type ProductionConfig = {
  machineId: string;
  lensId: string;
  presetId: string;
  outputProfile: {
    format: "png" | "svg" | "json";
    namingTemplate: string;
  };
  destinationRule: string;
};

export type BedLayout = {
  bedW_mm: number;
  bedH_mm: number;
  grid: {
    spacing: number;
    offsetX: number;
    offsetY: number;
    enabled: boolean;
  };
  customHoles: Array<{ x: number; y: number }>;
  placedItem: { x: number; y: number; rotation: number };
  rotaryConfig: {
    axisY: number;
    chuckX: number;
    tailstockX: number;
    cylinderGhostDiameter?: number;
    enabled: boolean;
  };
};

export type MachinePreset = { id: string; name: string; type: "fiber" | "co2" | "uv" };
export type LensPreset = { id: string; name: string; field_mm: { width: number; height: number } };
export type SettingsPreset = { id: string; name: string; notes?: string };
