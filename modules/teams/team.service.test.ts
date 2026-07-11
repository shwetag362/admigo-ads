import { describe, it, expect, vi } from "vitest";
import { makeTeamService } from "./team.service";
import type { TeamRepository } from "./team.repository";

function fakeRepo(over: Partial<TeamRepository> = {}): TeamRepository {
  return {
    listMembershipsForUser: vi.fn().mockResolvedValue([]),
    createWithOwner: vi.fn().mockResolvedValue({ id: "t1" }),
    findWithMembers: vi.fn().mockResolvedValue(null),
    getOwnerId: vi.fn().mockResolvedValue(null),
    deleteById: vi.fn().mockResolvedValue(undefined),
    getMemberRole: vi.fn().mockResolvedValue(null),
    createInvite: vi.fn().mockResolvedValue({ token: "tok" }),
    findInviteByToken: vi.fn().mockResolvedValue(null),
    isMember: vi.fn().mockResolvedValue(false),
    acceptInviteTx: vi.fn().mockResolvedValue({ team: { id: "t1" } }),
    extendInvite: vi.fn().mockResolvedValue({ token: "tok" }),
    deleteInvite: vi.fn().mockResolvedValue(undefined),
    getMemberById: vi.fn().mockResolvedValue(null),
    deleteMember: vi.fn().mockResolvedValue(undefined),
    ownedAccountIds: vi.fn().mockResolvedValue(new Set<string>()),
    replaceMemberAccounts: vi.fn().mockResolvedValue([]),
    listMemberAccounts: vi.fn().mockResolvedValue([]),
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

  it("remove throws NotFound when the team does not exist", async () => {
    const repo = fakeRepo({ getOwnerId: vi.fn().mockResolvedValue(null) as any });
    await expect(makeTeamService(repo).remove("u1", "t1")).rejects.toThrow(/not found/i);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it("remove throws Forbidden when the requester is not the owner", async () => {
    const repo = fakeRepo({ getOwnerId: vi.fn().mockResolvedValue("owner1") as any });
    await expect(makeTeamService(repo).remove("someone-else", "t1")).rejects.toThrow(/owner/i);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it("remove deletes when the requester is the owner", async () => {
    const repo = fakeRepo({ getOwnerId: vi.fn().mockResolvedValue("owner1") as any });
    await makeTeamService(repo).remove("owner1", "t1");
    expect(repo.deleteById).toHaveBeenCalledWith("t1");
  });
});
