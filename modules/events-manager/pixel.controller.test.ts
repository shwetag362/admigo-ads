import { describe, it, expect, vi } from "vitest";
import { makePixelController } from "./pixel.controller";
import { UnauthorizedError } from "@/lib/errors/AppError";

const service = { list: vi.fn().mockResolvedValue([{ id: "px1" }]) };
const sp = (o: Record<string, string>) => new URLSearchParams(o);

describe("pixelController.list", () => {
  it("throws Unauthorized without a session", async () => {
    await expect(makePixelController(service as any).list(null, sp({}))).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("applies default limit and returns data + count", async () => {
    const res = await makePixelController(service as any).list({ user: { id: "u1" } }, sp({}));
    expect(service.list).toHaveBeenCalledWith("u1", { limit: 100 });
    expect(res).toEqual({ success: true, data: [{ id: "px1" }], count: 1 });
  });
  it("rejects a non-uuid adAccountId", async () => {
    await expect(makePixelController(service as any).list({ user: { id: "u1" } }, sp({ adAccountId: "bad" }))).rejects.toThrow();
  });
});
