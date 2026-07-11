import { describe, it, expect, vi } from "vitest";
import { makeAdSetController } from "./adset.controller";
import { UnauthorizedError } from "@/lib/errors/AppError";

const service = { list: vi.fn().mockResolvedValue([{ id: "as1" }]) };
const sp = (o: Record<string, string | string[]>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) (Array.isArray(v) ? v : [v]).forEach((x) => p.append(k, x));
  return p;
};

describe("adSetController.list", () => {
  it("throws Unauthorized without a session", async () => {
    await expect(makeAdSetController(service as any).list(null, sp({}))).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("parses query (campaignId + default limit) and returns data + count", async () => {
    const res = await makeAdSetController(service as any).list({ user: { id: "u1" } }, sp({ campaignId: "cmp1" }));
    expect(service.list).toHaveBeenCalledWith("u1", { campaignId: "cmp1", limit: 50 });
    expect(res).toEqual({ success: true, data: [{ id: "as1" }], count: 1 });
  });
  it("rejects a non-uuid accountId", async () => {
    await expect(makeAdSetController(service as any).list({ user: { id: "u1" } }, sp({ accountId: "bad" }))).rejects.toThrow();
  });
});
