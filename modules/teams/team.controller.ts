// modules/teams/team.controller.ts — the CONTROLLER (interface adapter).
// Thin: authorize + validate input + call the service + shape the response DTO.
// No business logic, no Prisma. Reusable by any driver (route handler, server action).
import { UnauthorizedError } from "@/lib/errors/AppError";
import { CreateTeamInput } from "./team.schema";
import type { TeamService } from "./team.service";

type Session = { user?: { id?: string | null } | null } | null;

function requireUserId(session: Session): string {
  const userId = session?.user?.id;
  if (!userId) throw new UnauthorizedError();
  return userId;
}

export function makeTeamController(service: TeamService) {
  return {
    async list(session: Session) {
      const userId = requireUserId(session);
      return { memberships: await service.listForUser(userId) };
    },
    async create(session: Session, body: unknown) {
      const userId = requireUserId(session);
      const input = CreateTeamInput.parse(body); // ZodError → 400 (see handleRoute)
      return { team: await service.create(userId, input) };
    },
  };
}

export type TeamController = ReturnType<typeof makeTeamController>;
