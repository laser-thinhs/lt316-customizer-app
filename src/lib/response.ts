import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { toApiErrorShape } from "./errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request payload",
          issues: error.issues
        }
      },
      { status: 400 }
    );
  }

  const normalized = toApiErrorShape(error);
  return NextResponse.json(normalized.body, { status: normalized.status });
}
