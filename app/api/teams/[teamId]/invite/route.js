// // app/api/teams/[teamId]/invite/route.js
// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";
// import { createInvite, assertTeamRole } from "../../../../../lib/teams";

// export async function POST(req, { params }) {
//   const session = await getServerSession(authOptions);
//   if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

//   const { teamId } = await params;
//   const { email, role = "member" } = await req.json();

//   if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
//   if (!["member", "viewer"].includes(role)) {
//     return NextResponse.json({ error: "Invalid role" }, { status: 400 });
//   }

//   try {
//     await assertTeamRole(teamId, session.user.id, ["owner", "member"]);
//   } catch {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }

//   const invite = await createInvite(teamId, email.toLowerCase(), role, session.user.id);

//   const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${invite.token}`;

//   console.log(`📧 Invite URL for ${email}: ${inviteUrl}`);

//   return NextResponse.json({ invite, inviteUrl }, { status: 201 });
// }

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createInvite, assertTeamRole } from "../../../../../lib/teams";
import { sendInviteEmail } from "@/lib/integrations/email"; // ← add this

const VALID_ROLES   = ["member", "viewer"];
const ALLOWED_ROLES = ["owner"];

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { teamId } = await params;

  let email, role;
  try {
    ({ email, role = "member" } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await assertTeamRole(teamId, session.user.id, ALLOWED_ROLES);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const invite = await createInvite(
      teamId,
      email.toLowerCase().trim(),
      role,
      session.user.id
    );

    const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${invite.token}`;

    // ── Send email ──────────────────────────────────────────────────────────
    try {
      await sendInviteEmail({
        to         : email.toLowerCase().trim(),
        inviterName: session.user.name || session.user.email,
        teamName   : invite.team?.name || "your team",
        inviteUrl,
        role,
      });
    } catch (emailErr) {
      // Don't fail the whole request if email fails —
      // invite is already created in DB, return with a warning
      console.error("❌ Email send failed:", emailErr.message);
      return NextResponse.json({
        invite,
        inviteUrl,
        warning: "Invite created but email could not be sent. Share the link manually.",
      }, { status: 201 });
    }

    return NextResponse.json({ invite, inviteUrl }, { status: 201 });

  } catch (err) {
    const isDuplicate = err.message?.toLowerCase().includes("duplicate")
      || err.code === "P2002";

    if (isDuplicate) {
      return NextResponse.json(
        { error: "An active invite already exists for this email" },
        { status: 409 }
      );
    }

    console.error("❌ createInvite failed:", err.message);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}