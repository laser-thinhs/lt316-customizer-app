import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlacementDocument } from "@/schemas/placement";
import { savePlacement } from "@/lib/designJobs/savePlacement";
import { arePlacementsEqual } from "@/lib/placement/stableCompare";
import { clearPlacementDraft, readPlacementDraft, writePlacementDraft } from "@/lib/placement/localDraft";

const SAVE_DEBOUNCE_MS = 1200;
const DRAFT_THROTTLE_MS = 500;

type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type UseAutosavePlacementInput = {
  designJobId: string;
  placement: PlacementDocument;
  serverPlacement: PlacementDocument;
  onPlacementRecovered: (placement: PlacementDocument) => void;
  onPlacementSaved: (placement: PlacementDocument) => void;
};

export function useAutosavePlacement({
  designJobId,
  placement,
  serverPlacement,
  onPlacementRecovered,
  onPlacementSaved
}: UseAutosavePlacementInput) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasRecoveredDraft, setHasRecoveredDraft] = useState(false);

  const lastSavedRef = useRef(serverPlacement);
  const currentPlacementRef = useRef(placement);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const retryDelayRef = useRef(1000);
  const latestDesignJobIdRef = useRef(designJobId);

  useEffect(() => {
    latestDesignJobIdRef.current = designJobId;

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    queuedSaveRef.current = false;
    retryDelayRef.current = 1000;
  }, [designJobId]);

  useEffect(() => {
    currentPlacementRef.current = placement;
  }, [placement]);

  useEffect(() => {
    lastSavedRef.current = serverPlacement;
  }, [serverPlacement]);

  useEffect(() => {
    const localDraft = readPlacementDraft(designJobId);
    if (localDraft && !arePlacementsEqual(localDraft, serverPlacement)) {
      setHasRecoveredDraft(true);
      return;
    }

    setHasRecoveredDraft(false);
  }, [designJobId, serverPlacement]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, []);

  const performSave = useCallback(async () => {
    const jobIdAtSaveStart = designJobId;
    if (latestDesignJobIdRef.current !== jobIdAtSaveStart) {
      return;
    }

    if (isSavingRef.current) {
      queuedSaveRef.current = true;
      return;
    }

    const nextPlacement = currentPlacementRef.current;
    if (arePlacementsEqual(lastSavedRef.current, nextPlacement)) {
      setStatus("saved");
      return;
    }

    isSavingRef.current = true;
    setStatus("saving");

    try {
      const result = await savePlacement(designJobId, nextPlacement);
      lastSavedRef.current = result.placementJson;
      setLastSavedAt(result.updatedAt);
      setStatus("saved");
      retryDelayRef.current = 1000;
      onPlacementSaved(result.placementJson);

      const localDraft = readPlacementDraft(designJobId);
      if (localDraft && arePlacementsEqual(localDraft, result.placementJson)) {
        clearPlacementDraft(designJobId);
      }
    } catch {
      setStatus("error");
      const retryJobId = jobIdAtSaveStart;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        if (latestDesignJobIdRef.current !== retryJobId) {
          return;
        }

        void performSave();
      }, retryDelayRef.current);
      retryDelayRef.current = Math.min(10000, retryDelayRef.current * 2);
    } finally {
      isSavingRef.current = false;
      if (latestDesignJobIdRef.current !== jobIdAtSaveStart) {
        queuedSaveRef.current = false;
        return;
      }

      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        void performSave();
      }
    }
  }, [designJobId, onPlacementSaved]);

  useEffect(() => {
    if (arePlacementsEqual(lastSavedRef.current, placement)) {
      setStatus((prev) => (prev === "saving" ? prev : (lastSavedAt ? "saved" : "idle")));
      return;
    }

    setStatus((prev) => (prev === "saving" ? prev : "dirty"));

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void performSave();
    }, SAVE_DEBOUNCE_MS);
  }, [lastSavedAt, performSave, placement]);

  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      writePlacementDraft(designJobId, placement);
      draftTimerRef.current = null;
    }, DRAFT_THROTTLE_MS);
  }, [designJobId, placement]);

  const useLocalDraft = useCallback(() => {
    const localDraft = readPlacementDraft(designJobId);
    if (!localDraft) {
      setHasRecoveredDraft(false);
      return;
    }

    onPlacementRecovered(localDraft);
    currentPlacementRef.current = localDraft;
    setHasRecoveredDraft(false);
    setStatus("dirty");
  }, [designJobId, onPlacementRecovered]);

  const useServerVersion = useCallback(() => {
    clearPlacementDraft(designJobId);
    setHasRecoveredDraft(false);
  }, [designJobId]);

  const statusMessage = useMemo(() => {
    if (status === "dirty") return "Unsaved changes";
    if (status === "saving") return "Saving…";
    if (status === "error") return "Save failed. Retrying…";
    if (status === "saved" && lastSavedAt) return `Saved at ${new Date(lastSavedAt).toLocaleTimeString()}`;
    return "All changes saved";
  }, [lastSavedAt, status]);

  return {
    status,
    statusMessage,
    lastSavedAt,
    hasRecoveredDraft,
    useLocalDraft,
    useServerVersion
  };
}
