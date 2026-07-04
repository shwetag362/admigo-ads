import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host  : process.env.SMTP_HOST,
  port  : Number(process.env.SMTP_PORT),
  secure: false, // true for port 465, false for 587
  auth  : {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Verify connection on startup (dev only) ──────────────────────────────────
if (process.env.NODE_ENV === "development") {
  transporter.verify((err) => {
    if (err) console.error("❌ SMTP connection failed:", err.message);
    else     console.log("✅ SMTP connection verified");
  });
}

// ── Template ─────────────────────────────────────────────────────────────────
function buildInviteEmailHtml({ inviterName, teamName, inviteUrl, role }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>You're invited to ${teamName}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0"
              style="background:#ffffff;border-radius:8px;padding:40px;">

              <!-- Logo / Brand -->
              <tr>
                <td style="padding-bottom:24px;">
                  <span style="font-size:22px;font-weight:700;color:#6366f1;">Admigo</span>
                </td>
              </tr>

              <!-- Heading -->
              <tr>
                <td style="font-size:20px;font-weight:600;color:#0f172a;padding-bottom:16px;">
                  You've been invited to join ${teamName}
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="font-size:15px;color:#475569;line-height:1.6;padding-bottom:28px;">
                  <strong>${inviterName}</strong> has invited you to join
                  <strong>${teamName}</strong> on Admigo as a
                  <strong>${role}</strong>.
                  <br/><br/>
                  Click the button below to accept the invitation and get started.
                </td>
              </tr>

              <!-- CTA Button -->
              <tr>
                <td style="padding-bottom:32px;">
                  <a href="${inviteUrl}"
                    style="background:#6366f1;color:#ffffff;padding:12px 28px;
                           border-radius:6px;text-decoration:none;font-size:15px;
                           font-weight:600;display:inline-block;">
                    Accept Invitation
                  </a>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="border-top:1px solid #e2e8f0;padding-top:24px;">
                  <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">
                    This invite expires in <strong>7 days</strong>.
                    If you weren't expecting this, you can safely ignore it.
                  </p>
                  <p style="font-size:12px;color:#94a3b8;margin:0;word-break:break-all;">
                    Or copy this link: <a href="${inviteUrl}" style="color:#6366f1;">${inviteUrl}</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ── Send Invite Email ─────────────────────────────────────────────────────────
export async function sendInviteEmail({ to, inviterName, teamName, inviteUrl, role }) {
  const html = buildInviteEmailHtml({ inviterName, teamName, inviteUrl, role });

  const info = await transporter.sendMail({
    from   : `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to,
    subject: `You're invited to join ${teamName} on Admigo`,
    html,
    // Plain text fallback
    text: `
${inviterName} has invited you to join ${teamName} on Admigo as a ${role}.

Accept your invitation here: ${inviteUrl}

This invite expires in 7 days.
    `.trim(),
  });

  console.log("📧 Email sent:", info.messageId);
  return info;
}