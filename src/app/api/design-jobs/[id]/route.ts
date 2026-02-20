import { ZodError } from "zod";
import { fail, ok } from "@/lib/response";
import { requireApiRole } from "@/lib/api-auth";
import { getDesignJobById, updateDesignJobPlacement } from "@/services/design-job.service";
import { getV2Job, isV2JobId, updateV2Job } from "@/lib/v2/jobs-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (isV2JobId(id)) {
      const v2 = await getV2Job(id);
      if (!v2) {
        return Response.json({ error: { code: "NOT_FOUND", message: "Design job not found" } }, { status: 404 });
      }
      return ok(v2);
    }
    const data = await getDesignJobById(id);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (isV2JobId(id)) {
      const updated = await updateV2Job(id, {
        objectDefinitionId: body.objectDefinitionId,
        placement: body.placement,
        customerName: body.customerName,
        customerEmail: body.customerEmail
      });
      if (!updated) {
        return Response.json({ error: { code: "NOT_FOUND", message: "Design job not found" } }, { status: 404 });
      }
      return ok(updated);
    }

    requireApiRole(request, ["admin", "operator"]);
    const data = await updateDesignJobPlacement(id, body);
    return ok(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request payload",
            issues: error.issues
          }
        },
        { status: 422 }
      );
    }

    return fail(error);
  }
}
