import { create } from "zustand";
import { clampPlacementToZone, resolveAnchoredRect, type ZoneRectMm, validatePlacement } from "@/lib/geometry/cylinder";
import type { PlacementInput } from "@/schemas/placement";

type ProfileDims = {
  diameterMm: number;
  unwrapWidthMm: number;
  unwrapHeightMm: number;
};

type PlacementState = {
  currentAssetId: string | null;
  placement: PlacementInput;
  profile: ProfileDims;
  hardClamp: boolean;
  lockAspectRatio: boolean;
  snapToGrid: boolean;
  gridMm: number;
  undoStack: PlacementInput[];
  redoStack: PlacementInput[];
  setAsset: (assetId: string | null) => void;
  setProfile: (profile: ProfileDims) => void;
  patchPlacement: (patch: Partial<PlacementInput>) => void;
  setPlacement: (placement: PlacementInput) => void;
  undo: () => void;
  redo: () => void;
  toggleHardClamp: () => void;
  toggleAspectLock: () => void;
  toggleSnapToGrid: () => void;
};

const DEFAULT_PLACEMENT: PlacementInput = {
  widthMm: 50,
  heightMm: 50,
  offsetXMm: 25,
  offsetYMm: 25,
  rotationDeg: 0,
  anchor: "top-left"
};

const DEFAULT_PROFILE: ProfileDims = {
  diameterMm: 76.2,
  unwrapWidthMm: 239.389,
  unwrapHeightMm: 100
};

export const usePlacementStore = create<PlacementState>((set, get) => ({
  currentAssetId: null,
  placement: DEFAULT_PLACEMENT,
  profile: DEFAULT_PROFILE,
  hardClamp: true,
  lockAspectRatio: false,
  snapToGrid: true,
  gridMm: 1,
  undoStack: [],
  redoStack: [],
  setAsset: (assetId) => set({ currentAssetId: assetId }),
  setProfile: (profile) => set({ profile }),
  setPlacement: (placement) =>
    set((state) => ({
      placement,
      undoStack: [...state.undoStack.slice(-19), state.placement],
      redoStack: []
    })),
  patchPlacement: (patch) => {
    const state = get();
    const zone: ZoneRectMm = { xMm: 0, yMm: 0, widthMm: state.profile.unwrapWidthMm, heightMm: state.profile.unwrapHeightMm };
    const nextRaw = { ...state.placement, ...patch };
    const snapped = state.snapToGrid
      ? {
          ...nextRaw,
          widthMm: Math.round(nextRaw.widthMm / state.gridMm) * state.gridMm,
          heightMm: Math.round(nextRaw.heightMm / state.gridMm) * state.gridMm,
          offsetXMm: Math.round(nextRaw.offsetXMm / state.gridMm) * state.gridMm,
          offsetYMm: Math.round(nextRaw.offsetYMm / state.gridMm) * state.gridMm
        }
      : nextRaw;
    const next = state.hardClamp ? clampPlacementToZone(snapped, zone) : snapped;

    set({
      placement: next,
      undoStack: [...state.undoStack.slice(-19), state.placement],
      redoStack: []
    });
  },
  undo: () => {
    const state = get();
    const previous = state.undoStack[state.undoStack.length - 1];
    if (!previous) return;
    set({
      placement: previous,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [state.placement, ...state.redoStack].slice(0, 20)
    });
  },
  redo: () => {
    const state = get();
    const next = state.redoStack[0];
    if (!next) return;
    set({
      placement: next,
      redoStack: state.redoStack.slice(1),
      undoStack: [...state.undoStack.slice(-19), state.placement]
    });
  },
  toggleHardClamp: () => set((state) => ({ hardClamp: !state.hardClamp })),
  toggleAspectLock: () => set((state) => ({ lockAspectRatio: !state.lockAspectRatio })),
  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid }))
}));

export function selectPlacementDerived(state: PlacementState) {
  const zone: ZoneRectMm = { xMm: 0, yMm: 0, widthMm: state.profile.unwrapWidthMm, heightMm: state.profile.unwrapHeightMm };
  const resolvedRect = resolveAnchoredRect(state.placement);
  const validation = validatePlacement(state.placement, zone);
  const clampedPlacement = clampPlacementToZone(state.placement, zone);
  const clampedRect = resolveAnchoredRect(clampedPlacement);
  return { zone, resolvedRect, validation, clampedRect };
}
