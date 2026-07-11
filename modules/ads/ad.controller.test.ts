import { describe, it, expect, vi } from "vitest";
import { makeAdController } from "./ad.controller";
import { UnauthorizedError } from "@/lib/errors/AppError";

const service = { list: vi.fn().mockResolvedValue([{ id: "ad1" }]) };
const sp = (o: Record<string, string | string[]>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) (Array.isArray(v) ? v : [v]).forEach((x) => p.append(k, x));
  return p;
};

describe("adController.list", () => {
  it("throws Unauthorized without a session", async () => {
    await expect(makeAdController(service as any).list(null, sp({}))).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("parses adSetId filter + default limit", async () => {
    const res = await makeAdController(service as any).list({ user: { id: "u1" } }, sp({ adSetId: "as1" }));
    expect(service.list).toHaveBeenCalledWith("u1", { adSetId: "as1", limit: 50 });
    expect(res).toEqual({ success: true, data: [{ id: "ad1" }], count: 1 });
  });
  it("rejects a non-uuid accountId", async () => {
    await expect(makeAdController(service as any).list({ user: { id: "u1" } }, sp({ accountId: "bad" }))).rejects.toThrow();
  });
});
