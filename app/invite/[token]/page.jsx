import { prisma } from "../../../lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import InviteAccept from "@/app/components/InviteAccept";

export default async function InvitePage({ params }) {
  const { token } = await params; // ✅ fixed

  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: { team: { select: { name: true } } },
  });

  if (!invite) return <InviteAccept status="not_found" />;
  if (invite.acceptedAt) return <InviteAccept status="used" />;
  if (invite.expiresAt < new Date()) return <InviteAccept status="expired" />;

  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(`/register?invite=${token}&email=${encodeURIComponent(invite.email)}`);
  }

  return (
    <InviteAccept
      status="pending"
      token={token}
      teamName={invite.team.name}
      invitedEmail={invite.email}
      role={invite.role}
      userEmail={session.user.email}
    />
  );
}