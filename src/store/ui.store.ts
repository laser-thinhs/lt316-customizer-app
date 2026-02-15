import { create } from "zustand";

type UIState = {
  isCreatingJob: boolean;
  setCreatingJob: (value: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
  isCreatingJob: false,
  setCreatingJob: (value: boolean) => set({ isCreatingJob: value })
}));
