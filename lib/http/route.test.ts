import { describe, it, expect } from "vitest";
import { handleRoute } from "./route";
import { NotFoundError, RateLimitError } from "@/lib/errors/AppError";
import { z } from "zod";

const req = () => ({ nextUrl: { pathname: "/api/test" } }) as any;
const ctx = {} as any;

describe("handleRoute", () => {
  it("passes a successful response through", async () => {
    const res = await handleRoute(async () => Response.json({ ok: true }))(req(), ctx);
    expect(res.status).toBe(200);
  });

  it("maps an AppError to its status + safe message + code", async () => {
    const res = await handleRoute(async () => {
      throw new NotFoundError("nope");
    })(req(), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "nope", code: "NOT_FOUND" });
  });

  it("maps a ZodError to 400 VALIDATION", async () => {
    const res = await handleRoute(async () => {
      z.string().parse(123);
      return Response.json({});
    })(req(), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION");
  });

  it("adds Retry-After for a RateLimitError (429)", async () => {
    const res = await handleRoute(async () => {
      throw new RateLimitError(42);
    })(req(), ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("maps unknown errors to a generic 500 and never leaks internals", async () => {
    const res = await handleRoute(async () => {
      throw new Error("secret db connection string");
    })(req(), ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("secret db connection string");
  });
});
