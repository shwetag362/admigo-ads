import { describe, it, expect, vi } from "vitest";
import { makeDatasetController } from "./dataset.controller";
import { UnauthorizedError } from "@/lib/errors/AppError";

const service = { list: vi.fn().mockResolvedValue([{ id: "ds1" }]) };
const sp = (o: Record<string, string>) => new URLSearchParams(o);

describe("datasetController.list", () => {
  it("throws Unauthorized without a session", async () => {
    await expect(makeDatasetController(service as any).list(null, sp({}))).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("applies default limit and returns data + count", async () => {
    const res = await makeDatasetController(service as any).list({ user: { id: "u1" } }, sp({}));
    expect(service.list).toHaveBeenCalledWith("u1", { limit: 100 });
    expect(res).toEqual({ success: true, data: [{ id: "ds1" }], count: 1 });
  });
  it("rejects an invalid 'active' value", async () => {
    await expect(makeDatasetController(service as any).list({ user: { id: "u1" } }, sp({ active: "maybe" }))).rejects.toThrow();
  });
});
