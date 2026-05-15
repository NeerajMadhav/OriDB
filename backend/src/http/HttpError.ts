/**
 * HTTP errors with status codes for API handlers.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = "ERR_HTTP") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
