// modules/teams — public API (barrel) + composition root.
// Import this module ONLY via this file: `import { teamController } from "@/modules/teams"`.
//
// The composition root wires the concrete Prisma adapter into the service and
// controller. This is the single place the domain binds to infrastructure; in
// the future monorepo this moves to apps/web/src/server/container.ts.
import { prismaTeamRepository } from "./team.repository.prisma";
import { makeTeamService } from "./team.service";
import { makeTeamController } from "./team.controller";

export const teamService = makeTeamService(prismaTeamRepository);
export const teamController = makeTeamController(teamService);

// Public types + contracts
export { CreateTeamInput } from "./team.schema";
export type { TeamRepository } from "./team.repository";
export type { Team, TeamMembership } from "./team.types";
export type { TeamService } from "./team.service";
export type { TeamController } from "./team.controller";
