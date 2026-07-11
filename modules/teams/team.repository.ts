// modules/teams/team.repository.ts — the PORT (interface).
// The service depends on THIS, never on Prisma. Swap the implementation
// (Prisma, a fake in tests, another DB) without touching business logic.
import type { CreateTeamInput } from "./team.schema";
import type { Team, TeamMembership, TeamDetail, TeamInvite } from "./team.types";

export interface TeamRepository {
  listMembershipsForUser(userId: string): Promise<TeamMembership[]>;
  createWithOwner(ownerId: string, input: CreateTeamInput): Promise<Team>;
  /** Full team detail — only if the requester is a member; else null. */
  findWithMembers(teamId: string, requesterId: string): Promise<TeamDetail | null>;
  getOwnerId(teamId: string): Promise<string | null>;
  /** Cascade-delete invites, memberships, then the team. */
  deleteById(teamId: string): Promise<void>;
  /** The requester's role in a team, or null if not a member. */
  getMemberRole(teamId: string, userId: string): Promise<string | null>;
  /** Replace any pending invite for this email, then create a fresh one. */
  createInvite(teamId: string, email: string, role: string, invitedBy: string): Promise<TeamInvite>;
}
