// // lib/teams.js
// import { prisma } from "./prisma";
// import crypto from "crypto";

// // Get all teams a user belongs to (owned + member)
// export async function getUserTeams(userId) {
//   const memberships = await prisma.teamMember.findMany({
//     where: { userId },
//     include: {
//       team: {
//         include: {
//           owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
//           _count: { select: { members: true } },
//         },
//       },
//     },
//     orderBy: { joinedAt: "asc" },
//   });
//   return memberships;
// }

// // Get a single team with full member list (only if requester is a member)
// export async function getTeamWithMembers(teamId, requestingUserId) {
//   const membership = await prisma.teamMember.findUnique({
//     where: { teamId_userId: { teamId, userId: requestingUserId } },
//   });
//   if (!membership) return null;

//   return prisma.team.findUnique({
//     where: { id: teamId },
//     include: {
//       owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
//       members: {
//         include: {
//           user: { select: { id: true, name: true, email: true, avatarUrl: true } },
//         },
//         orderBy: { joinedAt: "asc" },
//       },
//       invites: {
//         where: { acceptedAt: null, expiresAt: { gt: new Date() } },
//         orderBy: { createdAt: "desc" },
//       },
//     },
//   });
// }

// // Create a team and auto-add the creator as owner member
// export async function createTeam(ownerId, name, description) {
//   return prisma.$transaction(async (tx) => {
//     const team = await tx.team.create({
//       data: { name, description, ownerId },
//     });
//     await tx.teamMember.create({
//       data: { teamId: team.id, userId: ownerId, role: "owner" },
//     });
//     return team;
//   });
// }

// // Create an invite token (7-day expiry)
// export async function createInvite(teamId, email, role, invitedBy) {
//   // Cancel any existing pending invite for this email+team
//   await prisma.teamInvite.deleteMany({
//     where: { teamId, email, acceptedAt: null },
//   });

//   const token = crypto.randomBytes(32).toString("hex");
//   const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

//   return prisma.teamInvite.create({
//     data: { teamId, email, role, token, invitedBy, expiresAt },
//     include: { team: { select: { name: true } } },
//   });
// }

// // Accept an invite — creates user account if they don't exist yet
// export async function acceptInvite(token, userId) {
//   const invite = await prisma.teamInvite.findUnique({
//     where: { token },
//     include: { team: true },
//   });

//   if (!invite) throw new Error("Invite not found");
//   if (invite.acceptedAt) throw new Error("Invite already used");
//   if (invite.expiresAt < new Date()) throw new Error("Invite expired");

//   // Check not already a member
//   const existing = await prisma.teamMember.findUnique({
//     where: { teamId_userId: { teamId: invite.teamId, userId } },
//   });
//   if (existing) throw new Error("Already a member");

//   return prisma.$transaction(async (tx) => {
//     const member = await tx.teamMember.create({
//       data: { teamId: invite.teamId, userId, role: invite.role },
//     });
//     await tx.teamInvite.update({
//       where: { token },
//       data: { acceptedAt: new Date() },
//     });
//     return { member, team: invite.team };
//   });
// }

// // Check if user is owner or specific role in a team
// export async function assertTeamRole(teamId, userId, allowedRoles = ["owner"]) {
//   const membership = await prisma.teamMember.findUnique({
//     where: { teamId_userId: { teamId, userId } },
//   });
//   if (!membership || !allowedRoles.includes(membership.role)) {
//     throw new Error("Insufficient team permissions");
//   }
//   return membership;
// }


// lib/teams.js
import { prisma } from "./prisma";
import crypto from "crypto";

// Get all teams a user belongs to (owned + member)
export async function getUserTeams(userId) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
  return memberships;
}

// Get a single team with full member list (only if requester is a member).
// Also attaches team.ownerAdAccounts so the UI can render the account-access
// checkbox panel without a separate round-trip.
export async function getTeamWithMembers(teamId, requestingUserId) {
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: requestingUserId } },
  });
  if (!membership) return null;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          // Per-member ad-account access rows + the account's display fields
          accountAccess: {
            include: {
              adAccount: {
                select: {
                  id: true,
                  name: true,
                  metaAccountId: true,
                  currency: true,
                },
              },
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      invites: {
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!team) return null;

  // Attach the owner's ad accounts so callers can build the permission checkbox
  // list without issuing a second query.
  team.ownerAdAccounts = await prisma.metaAdAccount.findMany({
    where: { userId: team.ownerId },
    select: { id: true, name: true, metaAccountId: true, currency: true },
    orderBy: { name: "asc" },
  });

  return team;
}

// Create a team and auto-add the creator as owner member
export async function createTeam(ownerId, name, description) {
  return prisma.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: { name, description, ownerId },
    });
    await tx.teamMember.create({
      data: { teamId: team.id, userId: ownerId, role: "owner" },
    });
    return team;
  });
}

// Create an invite token (7-day expiry)
export async function createInvite(teamId, email, role, invitedBy) {
  // Cancel any existing pending invite for this email+team
  await prisma.teamInvite.deleteMany({
    where: { teamId, email, acceptedAt: null },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return prisma.teamInvite.create({
    data: { teamId, email, role, token, invitedBy, expiresAt },
    include: { team: { select: { name: true } } },
  });
}

// Accept an invite — creates user account if they don't exist yet
export async function acceptInvite(token, userId) {
  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: { team: true },
  });

  if (!invite) throw new Error("Invite not found");
  if (invite.acceptedAt) throw new Error("Invite already used");
  if (invite.expiresAt < new Date()) throw new Error("Invite expired");

  // Check not already a member
  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: invite.teamId, userId } },
  });
  if (existing) throw new Error("Already a member");

  return prisma.$transaction(async (tx) => {
    const member = await tx.teamMember.create({
      data: { teamId: invite.teamId, userId, role: invite.role },
    });
    await tx.teamInvite.update({
      where: { token },
      data: { acceptedAt: new Date() },
    });
    return { member, team: invite.team };
  });
}

// Check if user is owner or specific role in a team
export async function assertTeamRole(teamId, userId, allowedRoles = ["owner"]) {
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new Error("Insufficient team permissions");
  }
  return membership;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Ad-account access management for team members
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replace a team member's ad-account access list in one transaction.
 *
 * @param {string} teamId          - Team the member belongs to
 * @param {string} targetUserId    - The member whose access is being updated
 * @param {string} requestingUserId - Must be the team owner
 * @param {Array<{ adAccountId: string, permissions: string[] }>} accountAccess
 *   - Full desired state; existing rows not in this list are deleted.
 *
 * @returns {TeamMemberAccount[]} The newly upserted rows (with adAccount included).
 *
 * @example
 * await updateMemberAccountAccess(teamId, memberId, ownerId, [
 *   { adAccountId: "uuid-1", permissions: ["view_campaigns", "view_analytics"] },
 *   { adAccountId: "uuid-2", permissions: ["view_campaigns"] },
 * ]);
 */
export async function updateMemberAccountAccess(
  teamId,
  targetUserId,
  requestingUserId,
  accountAccess = []
) {
  // Only the team owner may manage member access
  await assertTeamRole(teamId, requestingUserId, ["owner"]);

  // Resolve the TeamMember row for targetUserId
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } },
  });
  if (!member) throw new Error("User is not a member of this team");
  if (member.role === "owner") throw new Error("Cannot restrict owner access");

  const incomingIds = accountAccess.map((a) => a.adAccountId);

  return prisma.$transaction(async (tx) => {
    // 1. Remove rows that are no longer in the desired list
    await tx.teamMemberAccount.deleteMany({
      where: {
        teamMemberId: member.id,
        adAccountId: { notIn: incomingIds },
      },
    });

    // 2. Upsert each entry in the desired list
    const upserts = accountAccess.map(({ adAccountId, permissions }) =>
      tx.teamMemberAccount.upsert({
        where: {
          teamMemberId_adAccountId: {
            teamMemberId: member.id,
            adAccountId,
          },
        },
        create: {
          teamMemberId: member.id,
          adAccountId,
          permissions: permissions ?? [],
        },
        update: {
          permissions: permissions ?? [],
        },
        include: {
          adAccount: {
            select: { id: true, name: true, metaAccountId: true, currency: true },
          },
        },
      })
    );

    return Promise.all(upserts);
  });
}

/**
 * Return the ad accounts a member can access within a team, with their
 * granted permissions. Useful for enforcing per-account guards in API routes.
 *
 * @param {string} teamId
 * @param {string} userId
 * @returns {Array<{ adAccountId, permissions, adAccount }>}
 */
export async function getMemberAccountAccess(teamId, userId) {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: {
      accountAccess: {
        include: {
          adAccount: {
            select: { id: true, name: true, metaAccountId: true, currency: true },
          },
        },
      },
    },
  });

  if (!member) return [];

  // Owners implicitly have full access — callers should check role first
  return member.accountAccess;
}