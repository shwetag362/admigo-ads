import { describe, it, expect, vi } from "vitest";
import { makeCustomConversionController } from "./custom-conversion.controller";
import { UnauthorizedError } from "@/lib/errors/AppError";

const service = { list: vi.fn().mockResolvedValue([{ id: "cc1" }]) };
const sp = (o: Record<string, string>) => new URLSearchParams(o);

describe("customConversionController.list", () => {
  it("throws Unauthorized without a session", async () => {
    await expect(makeCustomConversionController(service as any).list(null, sp({}))).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("applies default limit and returns data + count", async () => {
    const res = await makeCustomConversionController(service as any).list({ user: { id: "u1" } }, sp({}));
    expect(service.list).toHaveBeenCalledWith("u1", { limit: 100 });
    expect(res).toEqual({ success: true, data: [{ id: "cc1" }], count: 1 });
  });
  it("rejects a non-uuid pixelId", async () => {
    await expect(makeCustomConversionController(service as any).list({ user: { id: "u1" } }, sp({ pixelId: "bad" }))).rejects.toThrow();
  });
});
