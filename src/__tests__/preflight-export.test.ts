import { buildExportManifest, runDesignJobPreflight } from "@/lib/export-pack";

const baseProduct = {
  id: "prod_1",
  name: "Tumbler",
  sku: "TM-1",
  diameterMm: 75,
  heightMm: 120,
  engraveZoneWidthMm: 90,
  engraveZoneHeightMm: 60,
  seamReference: "front",
  toolOutlineSvgPath: "/tool.svg",
  defaultSettingsProfile: {},
  createdAt: new Date(),
  updatedAt: new Date()
};

const baseMachine = {
  id: "mach_1",
  name: "Fiber",
  laserType: "fiber",
  lens: "300mm",
  rotaryModeDefault: "chuck",
  powerDefault: 25,
  speedDefault: 1200,
  frequencyDefault: 30,
  createdAt: new Date(),
  updatedAt: new Date()
};

const baseJob = {
  id: "job_1",
  orderRef: null,
  productProfileId: "prod_1",
  machineProfileId: "mach_1",
  status: "draft",
  placementJson: {
    version: 2,
    canvas: { widthMm: 80, heightMm: 40 },
    machine: { strokeWidthWarningThresholdMm: 0.15 },
    objects: []
  },
  previewImagePath: null,
  proofImagePath: null,
  placementHash: null,
  templateId: null,
  batchRunItemId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  assets: []
};

describe("preflight export pipeline", () => {
  it("passes a clean job", () => {
    const result = runDesignJobPreflight({ job: baseJob as never, productProfile: baseProduct as never, machineProfile: baseMachine as never });
    expect(result.status).toBe("pass");
    expect(result.issues).toHaveLength(0);
  });

  it("fails when canvas exceeds engrave zone", () => {
    const result = runDesignJobPreflight({
      job: { ...baseJob, placementJson: { ...baseJob.placementJson, canvas: { widthMm: 200, heightMm: 40 } } } as never,
      productProfile: baseProduct as never,
      machineProfile: baseMachine as never
    });
    expect(result.status).toBe("fail");
    expect(result.issues.some((issue) => issue.code === "CANVAS_EXCEEDS_ENGRAVE_ZONE")).toBe(true);
  });

  it("fails when object is out of canvas", () => {
    const result = runDesignJobPreflight({
      job: {
        ...baseJob,
        placementJson: {
          ...baseJob.placementJson,
          objects: [{ id: "o1", kind: "vector", pathData: "M0 0", anchor: "top-left", offsetXMm: 78, offsetYMm: 1, boxWidthMm: 10, boxHeightMm: 10, rotationDeg: 0, mirrorX: false, mirrorY: false, zIndex: 1 }]
        }
      } as never,
      productProfile: baseProduct as never,
      machineProfile: baseMachine as never
    });
    expect(result.issues.some((issue) => issue.code === "OBJECT_OUT_OF_CANVAS")).toBe(true);
  });

  it("warns for thin stroke", () => {
    const result = runDesignJobPreflight({
      job: {
        ...baseJob,
        placementJson: {
          ...baseJob.placementJson,
          objects: [{ id: "t1", kind: "text_line", content: "x", fontFamily: "Inter", fontWeight: 400, fontStyle: "normal", fontSizeMm: 3, lineHeight: 1.2, letterSpacingMm: 0, horizontalAlign: "left", verticalAlign: "top", fillMode: "stroke", strokeWidthMm: 0.1, allCaps: false, anchor: "top-left", offsetXMm: 2, offsetYMm: 2, boxWidthMm: 10, boxHeightMm: 5, rotationDeg: 0, mirrorX: false, mirrorY: false, zIndex: 1 }]
        }
      } as never,
      productProfile: baseProduct as never,
      machineProfile: baseMachine as never
    });
    expect(result.status).toBe("warn");
    expect(result.issues.some((issue) => issue.code === "STROKE_TOO_THIN")).toBe(true);
  });

  it("fails for missing asset refs", () => {
    const result = runDesignJobPreflight({
      job: {
        ...baseJob,
        placementJson: {
          ...baseJob.placementJson,
          objects: [{ id: "i1", kind: "image", src: "missing", anchor: "top-left", offsetXMm: 2, offsetYMm: 2, boxWidthMm: 10, boxHeightMm: 5, rotationDeg: 0, mirrorX: false, mirrorY: false, zIndex: 1 }]
        }
      } as never,
      productProfile: baseProduct as never,
      machineProfile: baseMachine as never
    });
    expect(result.status).toBe("fail");
    expect(result.issues.some((issue) => issue.code === "MISSING_ASSET_REFERENCE")).toBe(true);
  });

  it("warns for overlap risk", () => {
    const result = runDesignJobPreflight({
      job: {
        ...baseJob,
        placementJson: {
          ...baseJob.placementJson,
          objects: [
            { id: "o1", kind: "vector", pathData: "M0 0", anchor: "top-left", offsetXMm: 2, offsetYMm: 2, boxWidthMm: 10, boxHeightMm: 10, rotationDeg: 0, mirrorX: false, mirrorY: false, zIndex: 1 },
            { id: "o2", kind: "vector", pathData: "M0 0", anchor: "top-left", offsetXMm: 8, offsetYMm: 8, boxWidthMm: 10, boxHeightMm: 10, rotationDeg: 0, mirrorX: false, mirrorY: false, zIndex: 2 }
          ]
        }
      } as never,
      productProfile: baseProduct as never,
      machineProfile: baseMachine as never
    });
    expect(result.issues.some((issue) => issue.code === "OBJECT_OVERLAP_RISK")).toBe(true);
  });

  it("builds deterministic manifest objects", () => {
    const job = {
      ...baseJob,
      placementJson: {
        ...baseJob.placementJson,
        objects: [
          { id: "z-obj", kind: "vector", pathData: "M0 0", anchor: "top-left", offsetXMm: 15, offsetYMm: 2, boxWidthMm: 10, boxHeightMm: 10, rotationDeg: 0, mirrorX: false, mirrorY: false, zIndex: 2 },
          { id: "a-obj", kind: "vector", pathData: "M0 0", anchor: "top-left", offsetXMm: 5, offsetYMm: 2, boxWidthMm: 8, boxHeightMm: 6, rotationDeg: 0, mirrorX: false, mirrorY: false, zIndex: 2 }
        ]
      }
    };

    const preflight = runDesignJobPreflight({ job: job as never, productProfile: baseProduct as never, machineProfile: baseMachine as never });
    const first = buildExportManifest(job as never, baseProduct as never, baseMachine as never, preflight);
    const second = buildExportManifest(job as never, baseProduct as never, baseMachine as never, preflight);

    expect(first.objects).toEqual(second.objects);
    expect(first.objects[0].id).toBe("a-obj");
  });
});
