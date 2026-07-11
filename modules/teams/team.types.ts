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

// Full team detail (owner + members + pending invites). Nested member/invite
// shapes are broad — the client consumes them structurally.
export interface TeamDetail extends Team {
  owner: { id: string; name: string | null; email: string; avatarUrl: string | null };
  members: unknown[];
  invites: unknown[];
}

export interface TeamInvite {
  id: string;
  teamId: string;
  email: string;
  role: string;
  token: string;
  invitedBy: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  team?: { name: string } | null;
}

export interface TeamInviteWithTeam extends TeamInvite {
  team: { id: string; name: string; ownerId: string } & { name: string };
}
