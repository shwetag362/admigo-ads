// modules/teams/team.schema.ts — input contracts (validation + inferred types).
import { z } from "zod";

export const CreateTeamInput = z.object({
  name: z.string().trim().min(1, "Name required").max(200),
  description: z.string().trim().max(2000).optional(),
});
export type CreateTeamInput = z.infer<typeof CreateTeamInput>;

export const CreateInviteInput = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["member", "viewer"]).default("member"),
});
export type CreateInviteInput = z.infer<typeof CreateInviteInput>;
