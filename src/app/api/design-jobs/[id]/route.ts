import { ZodError } from "zod";
import { fail, ok } from "@/lib/response";
import { getDesignJobById, updateDesignJobPlacement } from "@/services/design-job.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
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
