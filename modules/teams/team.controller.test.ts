import { describe, it, expect, vi } from "vitest";
import { makeTeamController } from "./team.controller";
import { UnauthorizedError } from "@/lib/errors/AppError";

const service = {
  listForUser: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: "t1" }),
};

describe("teamController", () => {
  it("list throws Unauthorized without a session", async () => {
    const c = makeTeamController(service as any);
    await expect(c.list(null)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("list returns memberships for a valid session", async () => {
    const c = makeTeamController(service as any);
    const res = await c.list({ user: { id: "u1" } });
    expect(service.listForUser).toHaveBeenCalledWith("u1");
    expect(res).toEqual({ memberships: [] });
  });

  it("create rejects invalid input via zod", async () => {
    const c = makeTeamController(service as any);
    await expect(c.create({ user: { id: "u1" } }, { name: "" })).rejects.toThrow();
  });

  it("create passes trimmed, validated input to the service", async () => {
    const c = makeTeamController(service as any);
    const res = await c.create({ user: { id: "u1" } }, { name: "  Acme  " });
    expect(service.create).toHaveBeenCalledWith("u1", { name: "Acme" });
    expect(res).toEqual({ team: { id: "t1" } });
  });
});
