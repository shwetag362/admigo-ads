import { describe, it, expect, vi } from "vitest";
import { makeCampaignController } from "./campaign.controller";
import { UnauthorizedError } from "@/lib/errors/AppError";

const service = { list: vi.fn().mockResolvedValue([{ id: "c1" }]) };

function params(obj: Record<string, string | string[]>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    (Array.isArray(v) ? v : [v]).forEach((x) => sp.append(k, x));
  }
  return sp;
}

describe("campaignController.list", () => {
  it("throws Unauthorized without a session", async () => {
    const c = makeCampaignController(service as any);
    await expect(c.list(null, params({}))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("parses query, applies default limit, returns data + count", async () => {
    const c = makeCampaignController(service as any);
    const res = await c.list({ user: { id: "u1" } }, params({ status: ["ACTIVE", "PAUSED"] }));
    expect(service.list).toHaveBeenCalledWith("u1", {
      status: ["ACTIVE", "PAUSED"],
      limit: 50, // schema default
    });
    expect(res).toEqual({ success: true, data: [{ id: "c1" }], count: 1 });
  });

  it("rejects an invalid accountId (not a uuid)", async () => {
    const c = makeCampaignController(service as any);
    await expect(
      c.list({ user: { id: "u1" } }, params({ accountId: "not-a-uuid" })),
    ).rejects.toThrow();
  });

  it("clamps limit above the max", async () => {
    const c = makeCampaignController(service as any);
    await expect(
      c.list({ user: { id: "u1" } }, params({ limit: "9999" })),
    ).rejects.toThrow(); // > max(100) is rejected by zod
  });
});
