// app/dashboard/team/page.jsx
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { getUserTeams } from "../../../lib/teams";
import TeamPage from "@/app/components/TeamPage";

export default async function TeamDashboardPage() {
  const session = await getServerSession(authOptions);
  const memberships = await getUserTeams(session.user.id);

  return <TeamPage memberships={memberships} currentUserId={session.user.id} />;
}