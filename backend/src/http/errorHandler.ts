/**
 * Central JSON error handler — stable shape, no credential leakage.
 */
import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./HttpError.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : "Internal error";
  let code = "ERR_INTERNAL";
  let status = 500;
  if (err instanceof HttpError) {
    code = err.code;
    status = err.status;
  } else if (err && typeof err === "object" && "code" in err && typeof err.code === "string") {
    code = err.code;
  }
  if (!(err instanceof HttpError) && err && typeof err === "object" && "status" in err && typeof err.status === "number") {
    status = err.status;
  }
  if (status >= 500) {
    console.error("[oridb]", message);
  }
  res.status(status).json({
    error: { code, message },
  });
}
