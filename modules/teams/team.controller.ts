// modules/teams/team.controller.ts — the CONTROLLER (interface adapter).
// Thin: authorize + validate input + call the service + shape the response DTO.
// No business logic, no Prisma. Reusable by any driver (route handler, server action).
import { ConflictError, NotFoundError, UnauthorizedError } from "@/lib/errors/AppError";
import { sendInviteEmail } from "@/lib/integrations/email";
import { CreateInviteInput, CreateTeamInput } from "./team.schema";
import type { TeamService } from "./team.service";

type Session = {
  user?: { id?: string | null; name?: string | null; email?: string | null } | null;
} | null;

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
    async getOne(session: Session, teamId: string) {
      const userId = requireUserId(session);
      const team = await service.getOne(userId, teamId);
      if (!team) throw new NotFoundError("Team not found or you are not a member");
      return { team };
    },
    async remove(session: Session, teamId: string) {
      const userId = requireUserId(session);
      await service.remove(userId, teamId);
      return { success: true };
    },
    async invite(session: Session, teamId: string, body: unknown) {
      const userId = requireUserId(session);
      const input = CreateInviteInput.parse(body);
      const email = input.email.toLowerCase().trim();

      let invite;
      try {
        invite = await service.invite(userId, teamId, email, input.role);
      } catch (e: any) {
        if (e?.code === "P2002") {
          throw new ConflictError("An active invite already exists for this email");
        }
        throw e;
      }

      const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${invite.token}`;

      // Email failure must not fail the request — the invite already exists.
      try {
        await sendInviteEmail({
          to: email,
          inviterName: session?.user?.name || session?.user?.email || "A teammate",
          teamName: invite.team?.name || "your team",
          inviteUrl,
          role: input.role,
        });
      } catch {
        return {
          invite,
          inviteUrl,
          warning: "Invite created but email could not be sent. Share the link manually.",
        };
      }

      return { invite, inviteUrl };
    },
    async acceptInvite(session: Session, token: string) {
      const userId = requireUserId(session);
      const result = await service.acceptInvite(userId, token);
      return { success: true, team: result.team };
    },
    async resendInvite(session: Session, token: string) {
      const userId = requireUserId(session);
      const invite = await service.resendInvite(userId, token);
      const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${invite.token}`;
      return { invite, inviteUrl };
    },
    async revokeInvite(session: Session, token: string) {
      const userId = requireUserId(session);
      await service.revokeInvite(userId, token);
      return { success: true };
    },
  };
}

export type TeamController = ReturnType<typeof makeTeamController>;
