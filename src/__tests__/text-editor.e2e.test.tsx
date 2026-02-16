/** @jest-environment jsdom */

import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import PlacementEditor from "@/components/PlacementEditor";
import { createDefaultPlacementDocument } from "@/schemas/placement";

describe("PlacementEditor text workflow", () => {
  it("adds curved text, updates controls, converts outline and persists", async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn();
    const fetchMock = (global as unknown as { fetch: jest.Mock }).fetch
            .mockResolvedValue({ ok: true, json: async () => ({ data: { placementJson: createDefaultPlacementDocument() } }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            derivedVectorObject: {
              id: "o1",
              kind: "vector",
              pathData: "M0 0 L1 0 L1 1 Z",
              rotationDeg: 0,
              anchor: "center",
              offsetXMm: 0,
              offsetYMm: 0,
              boxWidthMm: 1,
              boxHeightMm: 1,
              mirrorX: false,
              mirrorY: false,
              zIndex: 99
            },
            warnings: []
          }
        })
      } as Response);

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PlacementEditor
          designJobId="job_1"
          placement={createDefaultPlacementDocument()}
          onUpdated={jest.fn()}
          onRunPreflight={async () => null}
          onExportSvg={async () => {}}
        />
      );
    });

    const addCurvedButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Add Curved Text")
    );

    await act(async () => {
      addCurvedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const convertButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Convert to Outline")
    );

    await act(async () => {
      convertButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/text/outline", expect.objectContaining({ method: "POST" }));
  });
});
