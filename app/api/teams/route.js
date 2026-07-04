// app/api/teams/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getUserTeams, createTeam } from "../../../lib/teams";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const memberships = await getUserTeams(session.user.id);
  return NextResponse.json({ memberships });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const team = await createTeam(session.user.id, name.trim(), description?.trim());
  return NextResponse.json({ team }, { status: 201 });
}