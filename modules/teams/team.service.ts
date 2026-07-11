// modules/teams/team.service.ts — business logic (pure).
// No HTTP, no Prisma, no Next. Depends only on the TeamRepository port, so it
// is fully unit-testable with a fake repo.
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors/AppError";
import type { TeamRepository } from "./team.repository";
import type { CreateTeamInput } from "./team.schema";

export function makeTeamService(repo: TeamRepository) {
  return {
    listForUser(userId: string) {
      return repo.listMembershipsForUser(userId);
    },
    create(ownerId: string, input: CreateTeamInput) {
      return repo.createWithOwner(ownerId, input);
    },
    getOne(userId: string, teamId: string) {
      return repo.findWithMembers(teamId, userId);
    },
    async remove(userId: string, teamId: string) {
      const ownerId = await repo.getOwnerId(teamId);
      if (!ownerId) throw new NotFoundError("Team not found");
      if (ownerId !== userId) throw new ForbiddenError("Only the team owner can delete this team");
      await repo.deleteById(teamId);
    },
    async invite(userId: string, teamId: string, email: string, role: string) {
      const memberRole = await repo.getMemberRole(teamId, userId);
      if (memberRole !== "owner") {
        throw new ForbiddenError("Only the team owner can invite members");
      }
      return repo.createInvite(teamId, email, role, userId);
    },
    async acceptInvite(userId: string, token: string) {
      const invite = await repo.findInviteByToken(token);
      if (!invite) throw new BadRequestError("Invite not found");
      if (invite.acceptedAt) throw new BadRequestError("Invite already used");
      if (invite.expiresAt < new Date()) throw new BadRequestError("Invite expired");
      if (await repo.isMember(invite.teamId, userId)) {
        throw new BadRequestError("Already a member");
      }
      return repo.acceptInviteTx(token, invite.teamId, userId, invite.role);
    },
    async resendInvite(userId: string, token: string) {
      const invite = await repo.findInviteByToken(token);
      if (!invite) throw new NotFoundError("Invite not found");
      if (invite.team.ownerId !== userId) throw new ForbiddenError();
      return repo.extendInvite(token);
    },
    async revokeInvite(userId: string, token: string) {
      const invite = await repo.findInviteByToken(token);
      if (!invite) throw new NotFoundError("Invite not found");
      if (invite.team.ownerId !== userId) throw new ForbiddenError();
      await repo.deleteInvite(token);
    },
    async removeMember(userId: string, teamId: string, memberId: string) {
      const role = await repo.getMemberRole(teamId, userId);
      if (role !== "owner") throw new ForbiddenError("Only owners can remove members");
      const target = await repo.getMemberById(memberId);
      if (!target) throw new NotFoundError("Member not found");
      if (target.userId === userId) throw new BadRequestError("Cannot remove yourself");
      await repo.deleteMember(memberId);
    },
    async setMemberAccounts(
      userId: string,
      teamId: string,
      memberId: string,
      assignments: unknown,
    ) {
      const ownerId = await repo.getOwnerId(teamId);
      if (!ownerId) throw new NotFoundError("Team not found");
      if (ownerId !== userId) {
        throw new ForbiddenError("Only the team owner can manage account access");
      }
      const membership = await repo.getMemberById(memberId);
      if (!membership || membership.teamId !== teamId) {
        throw new NotFoundError("Member not found in this team");
      }
      if (!Array.isArray(assignments)) {
        throw new BadRequestError("assignments must be an array");
      }
      if (assignments.length > 0) {
        const accountIds = assignments.map((a) => a.adAccountId);
        const validIds = await repo.ownedAccountIds(accountIds, userId);
        const invalid = accountIds.find((id) => !validIds.has(id));
        if (invalid) throw new ForbiddenError(`Ad account ${invalid} does not belong to you`);
      }
      return repo.replaceMemberAccounts(memberId, assignments);
    },
    async getMemberAccounts(userId: string, teamId: string, memberId: string) {
      const role = await repo.getMemberRole(teamId, userId);
      if (role === null) throw new ForbiddenError("Not a team member");
      return repo.listMemberAccounts(memberId);
    },
  };
}

export type TeamService = ReturnType<typeof makeTeamService>;
