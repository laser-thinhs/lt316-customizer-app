import { POST as createJobPost } from "@/app/api/tracer/jobs/route";
import { GET as getJobGet } from "@/app/api/tracer/jobs/[jobId]/route";
import { POST as tracePost } from "@/app/api/tracer/trace/route";
import { createTracerJob, toTracerJobResult, triggerTracerQueue } from "@/services/tracer-job.service";

jest.mock("@/services/tracer-job.service", () => ({
  createTracerJob: jest.fn(),
  toTracerJobResult: jest.fn(),
  triggerTracerQueue: jest.fn(),
  tracerApiSuccess: (requestId: string, result: unknown) => ({ requestId, ok: true, result }),
  tracerApiError: (_requestId: string, status: number, error: unknown) => ({ status, body: { ok: false, error } })
}));

describe("tracer routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates tracer job", async () => {
    (createTracerJob as jest.Mock).mockResolvedValue({ id: "job_1" });

    const req = new Request("http://localhost/api/tracer/jobs", {
      method: "POST",
      body: JSON.stringify({ assetId: "asset_1", settings: { threshold: 2 } }),
      headers: { "content-type": "application/json" }
    });

    const res = await createJobPost(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.result.jobId).toBe("job_1");
    expect(triggerTracerQueue).toHaveBeenCalled();
  });

  it("returns job payload", async () => {
    (toTracerJobResult as jest.Mock).mockResolvedValue({
      jobId: "job_1",
      status: "done",
      progress: 100,
      result: { svgAssetId: "asset_svg", svgUrl: "/api/assets/asset_svg" }
    });

    const res = await getJobGet(new Request("http://localhost/api/tracer/jobs/job_1"), {
      params: Promise.resolve({ jobId: "job_1" })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.status).toBe("done");
    expect(json.result.result.svgAssetId).toBe("asset_svg");
  });

  it("trace endpoint can return processing envelope", async () => {
    (createTracerJob as jest.Mock).mockResolvedValue({ id: "job_2" });
    (toTracerJobResult as jest.Mock).mockResolvedValue({ jobId: "job_2", status: "processing", progress: 60 });

    const req = new Request("http://localhost/api/tracer/trace", {
      method: "POST",
      body: JSON.stringify({ assetId: "asset_1", settings: {}, mode: "sync", waitMs: 500 }),
      headers: { "content-type": "application/json" }
    });

    const res = await tracePost(req);
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(json.ok).toBe(true);
    expect(json.result.jobId).toBe("job_2");
  });
});
