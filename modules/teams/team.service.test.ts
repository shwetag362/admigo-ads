import { describe, it, expect, vi } from "vitest";
import { makeTeamService } from "./team.service";
import type { TeamRepository } from "./team.repository";

function fakeRepo(over: Partial<TeamRepository> = {}): TeamRepository {
  return {
    listMembershipsForUser: vi.fn().mockResolvedValue([]),
    createWithOwner: vi.fn().mockResolvedValue({ id: "t1" }),
    ...over,
  };
}

describe("teamService", () => {
  it("listForUser delegates to the repository", async () => {
    const repo = fakeRepo({ listMembershipsForUser: vi.fn().mockResolvedValue([{ id: "m1" }]) as any });
    const res = await makeTeamService(repo).listForUser("u1");
    expect(repo.listMembershipsForUser).toHaveBeenCalledWith("u1");
    expect(res).toEqual([{ id: "m1" }]);
  });

  it("create delegates owner + input to the repository", async () => {
    const repo = fakeRepo();
    const res = await makeTeamService(repo).create("owner1", { name: "Acme" });
    expect(repo.createWithOwner).toHaveBeenCalledWith("owner1", { name: "Acme" });
    expect(res).toEqual({ id: "t1" });
  });
});
