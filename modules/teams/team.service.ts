// modules/teams/team.service.ts — business logic (pure).
// No HTTP, no Prisma, no Next. Depends only on the TeamRepository port, so it
// is fully unit-testable with a fake repo.
import { ForbiddenError, NotFoundError } from "@/lib/errors/AppError";
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
  };
}

export type TeamService = ReturnType<typeof makeTeamService>;
