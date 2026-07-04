// lib/errors/AppError.ts
// Typed error hierarchy for API routes and services. Throw these anywhere; the
// route wrapper (lib/http/route.ts) maps them to correct HTTP responses without
// leaking internals. `expose: false` errors return a generic message to clients.

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  /** Whether `message` is safe to send to the client. */
  readonly expose: boolean;

  constructor(message: string, status = 500, code = "INTERNAL", expose = true) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.expose = expose;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, 400, "BAD_REQUEST");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  readonly retryAfter: number;
  constructor(retryAfter = 60, message = "Too many requests") {
    super(message, 429, "RATE_LIMITED");
    this.retryAfter = retryAfter;
  }
}

/** Unexpected failures: never expose the internal message to the client. */
export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(message, 500, "INTERNAL", false);
  }
}
