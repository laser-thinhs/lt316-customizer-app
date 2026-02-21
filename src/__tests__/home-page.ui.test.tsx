/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import HomePage from "@/app/page";

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe("HomePage", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    fetchMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("loads profiles and creates a new job", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "prod_1", name: "20oz Straight Tumbler", sku: "TMBLR-20OZ-STRAIGHT" }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "job_123",
            status: "draft",
            createdAt: new Date().toISOString(),
            placementJson: {
              version: 2,
              canvas: { widthMm: 50, heightMm: 50 },
              machine: { strokeWidthWarningThresholdMm: 0.1 },
              objects: []
            },
            productProfile: { id: "prod_1", name: "20oz Straight Tumbler", sku: "TMBLR-20OZ-STRAIGHT" },
            machineProfile: { id: "mach_1", name: "Fiber Galvo 300 Lens", lens: "300mm" }
          }
        })
      });

    const root = createRoot(container);

    await act(async () => {
      root.render(<HomePage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("New Job");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Job Created");
    expect(fetchMock).toHaveBeenCalledWith("/api/product-profiles");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/design-jobs",
      expect.objectContaining({ method: "POST" })
    );
  });
});
