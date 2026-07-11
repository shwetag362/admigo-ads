import { describe, it, expect } from "vitest";
import { rateLimit, clientIp } from "./index";

describe("rateLimit (in-memory fallback, no REDIS_URL)", () => {
  it("allows up to the limit, then blocks with a retryAfter", async () => {
    const key = "unit-test-key-1";
    const a = await rateLimit(key, { limit: 2, windowSec: 60 });
    const b = await rateLimit(key, { limit: 2, windowSec: 60 });
    const c = await rateLimit(key, { limit: 2, windowSec: 60 });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    expect(c.allowed).toBe(false);
    expect(c.retryAfter).toBeGreaterThan(0);
    expect(a.remaining).toBe(1);
  });
});

describe("clientIp", () => {
  it("reads the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip then 'unknown'", () => {
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({}))).toBe("unknown");
  });
});
