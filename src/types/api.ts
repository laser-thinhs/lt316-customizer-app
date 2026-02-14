export type ApiSuccess<T> = { data: T };
export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    issues?: unknown;
  };
};
