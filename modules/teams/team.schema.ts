// modules/teams/team.schema.ts — input contracts (validation + inferred types).
import { z } from "zod";

export const CreateTeamInput = z.object({
  name: z.string().trim().min(1, "Name required").max(200),
  description: z.string().trim().max(2000).optional(),
});
export type CreateTeamInput = z.infer<typeof CreateTeamInput>;
