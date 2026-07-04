// app/dashboard/team/invites/page.jsx
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { prisma } from "../../../../lib/prisma";
// import InvitesPage from "../../../../components/team/InvitesPage";
import InvitesPage from "@/app/components/team/InvitesPage";

export default async function TeamInvitesPage() {
  const session = await getServerSession(authOptions);

  // Get all teams where user is owner (they can manage invites)
  const ownedTeams = await prisma.team.findMany({
    where: { ownerId: session.user.id },
    include: {
      invites: {
        orderBy: { createdAt: "desc" },
        include: {
          team: { select: { id: true, name: true } },
        },
      },
      _count: { select: { members: true } },
    },
  });

  // Get pending invites sent TO this user's email (invites they received)
  const receivedInvites = await prisma.teamInvite.findMany({
    where: {
      email: session.user.email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      team: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <InvitesPage
      ownedTeams={ownedTeams}
      receivedInvites={receivedInvites}
      currentUserId={session.user.id}
      currentUserEmail={session.user.email}
    />
  );
}