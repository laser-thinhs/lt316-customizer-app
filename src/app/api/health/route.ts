import { fail, ok } from "@/lib/response";
import { assertDatabaseConnectivity, assertDatabaseUrl } from "@/lib/startup";

export async function GET() {
  try {
    assertDatabaseUrl();
    await assertDatabaseConnectivity();

    return ok({
      status: "ok",
      checks: {
        app: "ok",
        database: "ok"
      }
    });
  } catch (error) {
    return fail(error);
  }
}
