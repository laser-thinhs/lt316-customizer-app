export type ApiErrorShape = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    issues?: unknown;
  };
};

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 400, code = "APP_ERROR", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function toApiErrorShape(error: unknown): { status: number; body: ApiErrorShape } {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong."
      }
    }
  };
}
