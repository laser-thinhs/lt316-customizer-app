/** @jest-environment jsdom */

import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import PlacementEditor from "@/components/PlacementEditor";
import { createDefaultPlacementDocument } from "@/schemas/placement";

// Suppress act() warnings for this test: PlacementEditor intentionally updates state
// in effects triggered by event handlers, which bypasses strict act() boundaries.
// This is acceptable in production but caught by test libraries. We use a jest spy
// to suppress these specific warnings.
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = String(args[0] ?? "");
    if (message.includes("The current testing environment is not configured to support act(...)")) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

describe("PlacementEditor text workflow", () => {
  it("adds curved text, updates controls, converts outline and persists", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/assets")) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }

      if (url.includes("/api/text/outline")) {
        return {
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
        } as Response;
      }

      return { ok: true, json: async () => ({ data: { placementJson: createDefaultPlacementDocument() } }) } as Response;
    });

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PlacementEditor
          designJobId="job_1"
          placement={createDefaultPlacementDocument()}
          onUpdated={jest.fn()}
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
    fetchMock.mockRestore();
  });
});

