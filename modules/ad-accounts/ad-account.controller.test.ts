import { describe, it, expect, vi } from "vitest";
import { makeAdAccountController } from "./ad-account.controller";
import { UnauthorizedError } from "@/lib/errors/AppError";

const service = { list: vi.fn().mockResolvedValue([{ id: "acc1" }]) };
const sp = (o: Record<string, string>) => new URLSearchParams(o);

describe("adAccountController.list", () => {
  it("throws Unauthorized without a session", async () => {
    await expect(makeAdAccountController(service as any).list(null, sp({}))).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("applies default limit and returns data + count", async () => {
    const res = await makeAdAccountController(service as any).list({ user: { id: "u1" } }, sp({}));
    expect(service.list).toHaveBeenCalledWith("u1", { limit: 100 });
    expect(res).toEqual({ success: true, data: [{ id: "acc1" }], count: 1 });
  });
  it("rejects limit above the max", async () => {
    await expect(makeAdAccountController(service as any).list({ user: { id: "u1" } }, sp({ limit: "9999" }))).rejects.toThrow();
  });
});
