import { POST as preflightPost } from "@/app/api/design-jobs/[id]/preflight/route";
import { POST as exportPost } from "@/app/api/design-jobs/[id]/export/route";
import { AppError } from "@/lib/errors";
import { exportDesignJob, preflightDesignJob } from "@/services/export-artifact.service";

jest.mock("@/services/export-artifact.service", () => ({
  preflightDesignJob: jest.fn(),
  exportDesignJob: jest.fn()
}));

describe("design job preflight/export routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /api/design-jobs/:id/preflight returns typed payload", async () => {
    (preflightDesignJob as jest.Mock).mockResolvedValue({ status: "pass", issues: [] });

    const res = await preflightPost(new Request("http://localhost"), { params: Promise.resolve({ id: "job_1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("pass");
  });

  it("POST /api/design-jobs/:id/export returns artifacts", async () => {
    (exportDesignJob as jest.Mock).mockResolvedValue({
      manifest: { designJobId: "job_1" },
      svg: "<svg />",
      metadata: { preflightStatus: "warn", issueCount: 1 }
    });

    const res = await exportPost(new Request("http://localhost"), { params: Promise.resolve({ id: "job_1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.metadata.preflightStatus).toBe("warn");
  });

  it("POST /api/design-jobs/:id/export returns 422 on preflight fail", async () => {
    (exportDesignJob as jest.Mock).mockRejectedValue(
      new AppError("Preflight failed", 422, "PREFLIGHT_FAILED", { status: "fail", issues: [{ code: "OBJECT_OUT_OF_CANVAS" }] })
    );

    const res = await exportPost(new Request("http://localhost"), { params: Promise.resolve({ id: "job_1" }) });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("PREFLIGHT_FAILED");
  });
});
