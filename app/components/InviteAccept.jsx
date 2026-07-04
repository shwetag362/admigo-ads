// components/InviteAccept.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteAccept({
  status, token, teamName, invitedEmail, role, userEmail,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/invite/${token}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/dashboard/team");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const messages = {
    not_found: { title: "Invite not found",  body: "This invite link is invalid." },
    used:      { title: "Already accepted",  body: "This invite has already been used." },
    expired:   { title: "Invite expired",    body: "This invite link has expired. Ask the team owner to send a new one." },
  };

  if (status !== "pending") {
    const msg = messages[status];
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.icon}>⚠</div>
          <h1 style={styles.title}>{msg.title}</h1>
          <p style={styles.body}>{msg.body}</p>
          <a href="/dashboard" style={styles.btn}>Go to dashboard</a>
        </div>
      </div>
    );
  }

  const emailMismatch = userEmail && invitedEmail && userEmail !== invitedEmail;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>✉</div>
        <h1 style={styles.title}>You've been invited</h1>
        <p style={styles.body}>
          Join <strong style={{ color: "#f4f4f5" }}>{teamName}</strong> as a{" "}
          <span style={styles.rolePill}>{role}</span>
        </p>

        {emailMismatch && (
          <div style={styles.warning}>
            This invite was sent to <strong>{invitedEmail}</strong> but you're
            logged in as <strong>{userEmail}</strong>. You can still accept, but
            make sure this is the right account.
          </div>
        )}

        {error && <div style={styles.errorBox}>{error}</div>}

        <button style={styles.acceptBtn} onClick={handleAccept} disabled={loading}>
          {loading ? "Joining..." : "Accept invite"}
        </button>
        <a href="/dashboard" style={styles.skipLink}>Maybe later</a>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f0f11",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    background: "#18181b",
    border: "1px solid #27272a",
    borderRadius: 16,
    padding: "40px 36px",
    maxWidth: 420,
    width: "100%",
    textAlign: "center",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  icon: { fontSize: 36, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 700, color: "#f4f4f5", margin: "0 0 10px", letterSpacing: "-0.02em" },
  body:  { fontSize: 15, color: "#a1a1aa", margin: "0 0 24px", lineHeight: 1.6 },
  rolePill: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    background: "#312e81",
    color: "#a5b4fc",
    fontSize: 13,
    fontWeight: 600,
  },
  warning: {
    background: "#451a03",
    border: "1px solid #78350f",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#fcd34d",
    marginBottom: 20,
    textAlign: "left",
    lineHeight: 1.5,
  },
  errorBox: {
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#fca5a5",
    marginBottom: 16,
  },
  acceptBtn: {
    display: "block",
    width: "100%",
    padding: "12px 24px",
    borderRadius: 10,
    border: "none",
    background: "#6366f1",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 12,
  },
  skipLink: {
    display: "block",
    fontSize: 13,
    color: "#52525b",
    textDecoration: "none",
  },
  btn: {
    display: "inline-block",
    marginTop: 20,
    padding: "10px 22px",
    borderRadius: 8,
    background: "#27272a",
    color: "#e4e4e7",
    fontSize: 14,
    textDecoration: "none",
  },
};