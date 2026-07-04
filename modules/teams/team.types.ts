// modules/teams/team.types.ts — domain types for the teams bounded context.

export interface Team {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMembership {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  team: Team & {
    owner: { id: string; name: string | null; email: string; avatarUrl: string | null };
    _count: { members: number };
  };
}
