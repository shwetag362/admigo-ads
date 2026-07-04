// modules/teams/team.repository.ts — the PORT (interface).
// The service depends on THIS, never on Prisma. Swap the implementation
// (Prisma, a fake in tests, another DB) without touching business logic.
import type { CreateTeamInput } from "./team.schema";
import type { Team, TeamMembership } from "./team.types";

export interface TeamRepository {
  listMembershipsForUser(userId: string): Promise<TeamMembership[]>;
  createWithOwner(ownerId: string, input: CreateTeamInput): Promise<Team>;
}
