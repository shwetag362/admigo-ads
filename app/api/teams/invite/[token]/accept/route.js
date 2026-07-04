// app/api/teams/invite/[token]/accept/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { acceptInvite } from "../../../../../../lib/teams";


export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { token } = await params; // ✅ fix — was params.token directly

  try {
    const result = await acceptInvite(token, session.user.id);
    return NextResponse.json({ success: true, team: result.team });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}