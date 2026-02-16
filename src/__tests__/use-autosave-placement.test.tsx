/** @jest-environment jsdom */

import React, { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useAutosavePlacement } from "@/hooks/useAutosavePlacement";
import { createDefaultPlacementDocument, type PlacementDocument } from "@/schemas/placement";
import { readPlacementDraft, writePlacementDraft } from "@/lib/placement/localDraft";

const savePlacementMock = jest.fn();

jest.mock("@/lib/designJobs/savePlacement", () => ({
  savePlacement: (...args: unknown[]) => savePlacementMock(...args)
}));

function buildPlacement(widthMm: number): PlacementDocument {
  return {
    ...createDefaultPlacementDocument(),
    canvas: { widthMm, heightMm: 50 }
  };
}

type HarnessProps = {
  designJobId: string;
  initialPlacement: PlacementDocument;
  onReady: (api: { setPlacement: (placement: PlacementDocument) => void }) => void;
};

function Harness({ designJobId, initialPlacement, onReady }: HarnessProps) {
  const [placement, setPlacement] = useState(initialPlacement);
  const [serverPlacement, setServerPlacement] = useState(initialPlacement);
  const autosave = useAutosavePlacement({
    designJobId,
    placement,
    serverPlacement,
    onPlacementRecovered: setPlacement,
    onPlacementSaved: (saved) => setServerPlacement(saved)
  });

  useEffect(() => {
    onReady({ setPlacement });
  }, [onReady]);

  return (
    <div>
      <p data-testid="status">{autosave.statusMessage}</p>
      <p data-testid="has-recovered">{autosave.hasRecoveredDraft ? "yes" : "no"}</p>
      <button onClick={autosave.useLocalDraft}>local</button>
      <button onClick={autosave.useServerVersion}>server</button>
    </div>
  );
}

describe("useAutosavePlacement", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("debounces burst edits into one save request", async () => {
    savePlacementMock.mockResolvedValue({ placementJson: buildPlacement(70), updatedAt: new Date().toISOString() });
    const root = createRoot(document.createElement("div"));
    let api: { setPlacement: (placement: PlacementDocument) => void } | null = null;

    await act(async () => {
      root.render(<Harness designJobId="job_1" initialPlacement={buildPlacement(50)} onReady={(instance) => { api = instance; }} />);
    });

    await act(async () => {
      api?.setPlacement(buildPlacement(60));
      api?.setPlacement(buildPlacement(65));
      api?.setPlacement(buildPlacement(70));
    });

    await act(async () => {
      jest.advanceTimersByTime(1199);
    });
    expect(savePlacementMock).toHaveBeenCalledTimes(0);

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(savePlacementMock).toHaveBeenCalledTimes(1);
    expect(savePlacementMock).toHaveBeenCalledWith("job_1", expect.objectContaining({ canvas: { widthMm: 70, heightMm: 50 } }));
  });

  it("retries on transient save failure with exponential backoff", async () => {
    savePlacementMock
      .mockRejectedValueOnce(new Error("fail once"))
      .mockResolvedValueOnce({ placementJson: buildPlacement(80), updatedAt: new Date().toISOString() });

    const root = createRoot(document.createElement("div"));
    let api: { setPlacement: (placement: PlacementDocument) => void } | null = null;

    await act(async () => {
      root.render(<Harness designJobId="job_2" initialPlacement={buildPlacement(50)} onReady={(instance) => { api = instance; }} />);
    });

    await act(async () => {
      api?.setPlacement(buildPlacement(80));
    });

    await act(async () => {
      jest.advanceTimersByTime(1200);
      await Promise.resolve();
    });

    expect(savePlacementMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(savePlacementMock).toHaveBeenCalledTimes(2);
  });

  it("supports local draft recovery decision flow", async () => {
    writePlacementDraft("job_3", buildPlacement(75));

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness designJobId="job_3" initialPlacement={buildPlacement(50)} onReady={() => {}} />);
    });

    expect(container.querySelector('[data-testid="has-recovered"]')?.textContent).toBe("yes");

    await act(async () => {
      container.querySelectorAll("button")[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(readPlacementDraft("job_3")).toBeNull();
  });
});
