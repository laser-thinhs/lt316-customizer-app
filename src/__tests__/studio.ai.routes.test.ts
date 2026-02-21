import { POST as postCodePropose } from "@/app/api/studio/ai/code-propose/route";
import { POST as postLayoutPropose } from "@/app/api/studio/ai/propose/route";
import { requireStudioAccess } from "@/lib/studio/auth";
import { checkStudioProposeRateLimit } from "@/lib/studio/rate-limit";
import { validatePatchAgainstPolicy } from "@/lib/studio/patch-policy";
import { checkStudioRateLimit, getRequestIp, requireStudioSession } from "@/lib/studio/security";
import fs from "node:fs/promises";

jest.mock("@/lib/studio/auth", () => ({
  requireStudioAccess: jest.fn(),
}));

jest.mock("@/lib/studio/rate-limit", () => ({
  checkStudioProposeRateLimit: jest.fn(),
}));

jest.mock("@/lib/studio/patch-policy", () => ({
  validatePatchAgainstPolicy: jest.fn(),
}));

jest.mock("@/lib/studio/security", () => ({
  requireStudioSession: jest.fn(),
  getRequestIp: jest.fn(),
  checkStudioRateLimit: jest.fn(),
}));

jest.mock("node:fs/promises", () => ({
  __esModule: true,
  default: {
    readFile: jest.fn(),
    readdir: jest.fn(),
  },
}));

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("studio ai routes", () => {
  const originalStudioAiUrl = process.env.STUDIO_AI_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as unknown as typeof fetch;

    (requireStudioAccess as jest.Mock).mockReturnValue(undefined);
    (checkStudioProposeRateLimit as jest.Mock).mockReturnValue(true);
    (validatePatchAgainstPolicy as jest.Mock).mockReturnValue({
      files: ["src/studio/new-block.tsx"],
      errors: [],
      warnings: ["non-blocking warning"],
    });

    (requireStudioSession as jest.Mock).mockResolvedValue({ csrfToken: "token" });
    (getRequestIp as jest.Mock).mockResolvedValue("127.0.0.1");
    (checkStudioRateLimit as jest.Mock).mockReturnValue(undefined);

    (fs.readFile as jest.Mock).mockResolvedValue("export const registry = [];");
    (fs.readdir as jest.Mock).mockResolvedValue(["BlockA.tsx", "notes.md"]);

    process.env.STUDIO_AI_URL = "http://studio-ai:8010";
  });

  afterAll(() => {
    process.env.STUDIO_AI_URL = originalStudioAiUrl;
  });

  it("POST /api/studio/ai/code-propose returns normalized payload on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        proposal_id: "proposal_abc123",
        patch:
          "diff --git a/src/studio/new-block.tsx b/src/studio/new-block.tsx\n--- a/src/studio/new-block.tsx\n+++ b/src/studio/new-block.tsx\n@@ -1 +1 @@\n-old\n+new",
        summary: "Added a new block",
        warnings: ["upstream warning"],
      })
    );

    const request = new Request("http://localhost/api/studio/ai/code-propose", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.1.2.3",
      },
      body: JSON.stringify({
        instruction: "Create a new studio block component and register it.",
        target: "src/studio",
        context: { branch: "feat/test" },
      }),
    });

    const response = await postCodePropose(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.proposal_id).toBe("proposal_abc123");
    expect(body.data.files).toEqual(["src/studio/new-block.tsx"]);
    expect(body.data.warnings).toEqual(["upstream warning", "non-blocking warning"]);

    expect(global.fetch).toHaveBeenCalledWith(
      "http://studio-ai:8010/v1/code/propose",
      expect.objectContaining({ method: "POST" })
    );

    const fetchInit = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const upstreamBody = JSON.parse(String(fetchInit.body));
    expect(upstreamBody.repo_context.existing_blocks).toEqual(["BlockA.tsx"]);
    expect(upstreamBody.repo_context.branch).toBe("feat/test");
  });

  it("POST /api/studio/ai/code-propose returns 400 on patch policy rejection", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        proposal_id: "proposal_bad",
        patch: "diff --git a/outside.ts b/outside.ts\n--- a/outside.ts\n+++ b/outside.ts",
        summary: "Bad patch",
      })
    );
    (validatePatchAgainstPolicy as jest.Mock).mockReturnValueOnce({
      files: ["outside.ts"],
      errors: ["Path outside allowlist: outside.ts"],
      warnings: [],
    });

    const request = new Request("http://localhost/api/studio/ai/code-propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instruction: "Apply patch" }),
    });

    const response = await postCodePropose(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe("PATCH_POLICY_REJECTED");
  });

  it("POST /api/studio/ai/propose returns next layout payload", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        proposal_id: "proposal_layout_1",
        next_layout: {
          id: "home",
          name: "Home",
          blocks: [
            {
              id: "text-1",
              type: "text",
              props: { text: "Updated", align: "left" },
            },
          ],
        },
        json_patch: [{ op: "replace", path: "/blocks/0/props/text", value: "Updated" }],
        summary: "Text updated",
        warnings: [],
      })
    );

    const request = new Request("http://localhost/api/studio/ai/propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instruction: "change text",
        layout: {
          id: "home",
          name: "Home",
          blocks: [
            {
              id: "text-1",
              type: "text",
              props: { text: "Hello", align: "left" },
            },
          ],
        },
      }),
    });

    const response = await postLayoutPropose(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.next_layout.blocks[0].props.text).toBe("Updated");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://studio-ai:8010/v1/layout/propose",
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
  });

  it("POST /api/studio/ai/propose forwards upstream error response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ detail: "upstream failure" }, 500));

    const request = new Request("http://localhost/api/studio/ai/propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instruction: "change text",
        layout: {
          id: "home",
          name: "Home",
          blocks: [
            {
              id: "text-1",
              type: "text",
              props: { text: "Hello", align: "left" },
            },
          ],
        },
      }),
    });

    const response = await postLayoutPropose(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.code).toBe("STUDIO_AI_ERROR");
  });
});
