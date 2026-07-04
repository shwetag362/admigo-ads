// // components/team/InvitesPage.jsx
// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";

// export default function InvitesPage({
//   ownedTeams,
//   receivedInvites,
//   currentUserId,
//   currentUserEmail,
// }) {
//   const [tab, setTab] = useState(
//     receivedInvites.length > 0 ? "received" : "sent"
//   );

//   const sentInvites = ownedTeams.flatMap((t) =>
//     t.invites.map((inv) => ({ ...inv, teamName: t.name }))
//   );

//   return (
//     <div style={styles.root}>
//       {/* Page header */}
//       <div style={styles.header}>
//         <div>
//           <h1 style={styles.pageTitle}>Invites</h1>
//           <p style={styles.pageSubtitle}>
//             Manage invitations you've sent and received
//           </p>
//         </div>
//       </div>

//       {/* Tabs */}
//       <div style={styles.tabBar}>
//         <button
//           style={{ ...styles.tab, ...(tab === "received" ? styles.tabActive : {}) }}
//           onClick={() => setTab("received")}
//         >
//           Received
//           {receivedInvites.length > 0 && (
//             <span style={styles.tabBadge}>{receivedInvites.length}</span>
//           )}
//         </button>
//         <button
//           style={{ ...styles.tab, ...(tab === "sent" ? styles.tabActive : {}) }}
//           onClick={() => setTab("sent")}
//         >
//           Sent
//           {sentInvites.length > 0 && (
//             <span style={styles.tabBadge}>{sentInvites.length}</span>
//           )}
//         </button>
//       </div>

//       {/* Content */}
//       <div style={styles.content}>
//         {tab === "received" && (
//           <ReceivedTab invites={receivedInvites} />
//         )}
//         {tab === "sent" && (
//           <SentTab invites={sentInvites} ownedTeams={ownedTeams} />
//         )}
//       </div>
//     </div>
//   );
// }

// // ── Received invites ──────────────────────────────────────────────────────────
// function ReceivedTab({ invites }) {
//   const router = useRouter();
//   const [loadingToken, setLoadingToken] = useState(null);
//   const [localInvites, setLocalInvites] = useState(invites);
//   const [errors, setErrors] = useState({});

//   async function handleAccept(token) {
//     setLoadingToken(token);
//     setErrors((e) => ({ ...e, [token]: null }));
//     try {
//       const res = await fetch(`/api/teams/invite/${token}/accept`, {
//         method: "POST",
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error);
//       setLocalInvites((prev) => prev.filter((i) => i.token !== token));
//       router.push("/dashboard/team");
//     } catch (e) {
//       setErrors((prev) => ({ ...prev, [token]: e.message }));
//     } finally {
//       setLoadingToken(null);
//     }
//   }

//   if (localInvites.length === 0) {
//     return (
//       <EmptyState
//         icon="✉"
//         title="No pending invites"
//         body="When someone invites you to their team, it will appear here."
//       />
//     );
//   }

//   return (
//     <div style={styles.cardList}>
//       {localInvites.map((inv) => {
//         const daysLeft = Math.ceil(
//           (new Date(inv.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)
//         );
//         return (
//           <div key={inv.token} style={styles.inviteCard}>
//             <div style={styles.inviteCardLeft}>
//               <div
//                 style={{
//                   ...styles.teamAvatarMd,
//                   background: colorFromName(inv.team.name),
//                 }}
//               >
//                 {inv.team.name[0].toUpperCase()}
//               </div>
//               <div>
//                 <div style={styles.inviteCardTitle}>{inv.team.name}</div>
//                 <div style={styles.inviteCardMeta}>
//                   Invited by{" "}
//                   <strong style={{ color: "#e4e4e7" }}>
//                     {inv.team.owner.name || inv.team.owner.email}
//                   </strong>
//                   {" · "}
//                   {inv.team._count.members} member
//                   {inv.team._count.members !== 1 ? "s" : ""}
//                 </div>
//                 <div style={styles.inviteCardMeta}>
//                   Role:{" "}
//                   <span style={styles.rolePill}>{inv.role}</span>
//                   {" · "}
//                   <span
//                     style={{
//                       color: daysLeft <= 2 ? "#f87171" : "#71717a",
//                     }}
//                   >
//                     Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
//                   </span>
//                 </div>
//                 {errors[inv.token] && (
//                   <div style={styles.inlineError}>{errors[inv.token]}</div>
//                 )}
//               </div>
//             </div>

//             <button
//               style={styles.acceptBtn}
//               disabled={loadingToken === inv.token}
//               onClick={() => handleAccept(inv.token)}
//             >
//               {loadingToken === inv.token ? "Joining..." : "Accept"}
//             </button>
//           </div>
//         );
//       })}
//     </div>
//   );
// }

// // ── Sent invites ──────────────────────────────────────────────────────────────
// function SentTab({ invites, ownedTeams }) {
//   const [localInvites, setLocalInvites] = useState(invites);
//   const [loadingToken, setLoadingToken] = useState(null);
//   const [copiedToken, setCopiedToken] = useState(null);
//   const [sendingEmail, setSendingEmail] = useState(null);

//   // New invite form state per team
//   const [showFormFor, setShowFormFor] = useState(null);
//   const [newEmail, setNewEmail] = useState("");
//   const [newRole, setNewRole] = useState("member");
//   const [formLoading, setFormLoading] = useState(false);
//   const [formError, setFormError] = useState(null);

//   async function handleRevoke(token) {
//     setLoadingToken(token);
//     try {
//       const res = await fetch(`/api/teams/invite/${token}/revoke`, {
//         method: "DELETE",
//       });
//       if (!res.ok) throw new Error("Failed to revoke");
//       setLocalInvites((prev) => prev.filter((i) => i.token !== token));
//     } finally {
//       setLoadingToken(null);
//     }
//   }

//   async function handleResend(token) {
//     setLoadingToken(token);
//     try {
//       const res = await fetch(`/api/teams/invite/${token}/resend`, {
//         method: "POST",
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error);
//       // Update local expiry
//       setLocalInvites((prev) =>
//         prev.map((i) =>
//           i.token === token ? { ...i, expiresAt: data.invite.expiresAt } : i
//         )
//       );
//       await copyLink(data.inviteUrl, token);
//     } finally {
//       setLoadingToken(null);
//     }
//   }

//   async function copyLink(url, token) {
//     await navigator.clipboard.writeText(url);
//     setCopiedToken(token);
//     setTimeout(() => setCopiedToken(null), 2000);
//   }

//   async function handleNewInvite(teamId, e) {
//     e.preventDefault();
//     if (!newEmail.trim()) return;
//     setFormLoading(true);
//     setFormError(null);
//     try {
//       const res = await fetch(`/api/teams/${teamId}/invite`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email: newEmail, role: newRole }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error);

//       const team = ownedTeams.find((t) => t.id === teamId);
//       setLocalInvites((prev) => [
//         {
//           ...data.invite,
//           teamName: team?.name ?? "",
//           _inviteUrl: data.inviteUrl,
//         },
//         ...prev,
//       ]);
//       setNewEmail("");
//       setNewRole("member");
//       setShowFormFor(null);
//     } catch (e) {
//       setFormError(e.message);
//     } finally {
//       setFormLoading(false);
//     }
//   }

//   // Group invites by team
//   const byTeam = ownedTeams.map((team) => ({
//     team,
//     invites: localInvites.filter((i) => i.teamId === team.id),
//   }));

//   if (ownedTeams.length === 0) {
//     return (
//       <EmptyState
//         icon="◎"
//         title="You don't own any teams"
//         body="Create a team first to start inviting members."
//         cta={{ label: "Create a team", href: "/dashboard/team" }}
//       />
//     );
//   }

//   return (
//     <div style={styles.cardList}>
//       {byTeam.map(({ team, invites: teamInvites }) => (
//         <div key={team.id} style={styles.teamSection}>
//           {/* Team header */}
//           <div style={styles.teamSectionHeader}>
//             <div style={styles.teamSectionLeft}>
//               <div
//                 style={{
//                   ...styles.teamAvatarSm,
//                   background: colorFromName(team.name),
//                 }}
//               >
//                 {team.name[0].toUpperCase()}
//               </div>
//               <div>
//                 <span style={styles.teamSectionName}>{team.name}</span>
//                 <span style={styles.teamSectionMeta}>
//                   {team._count.members} member
//                   {team._count.members !== 1 ? "s" : ""}
//                 </span>
//               </div>
//             </div>
//             <button
//               style={styles.newInviteBtn}
//               onClick={() =>
//                 setShowFormFor(showFormFor === team.id ? null : team.id)
//               }
//             >
//               {showFormFor === team.id ? "Cancel" : "+ Invite"}
//             </button>
//           </div>

//           {/* Inline invite form */}
//           {showFormFor === team.id && (
//             <form
//               onSubmit={(e) => handleNewInvite(team.id, e)}
//               style={styles.inlineForm}
//             >
//               <input
//                 style={styles.inlineInput}
//                 type="email"
//                 placeholder="colleague@example.com"
//                 value={newEmail}
//                 onChange={(e) => setNewEmail(e.target.value)}
//                 required
//                 autoFocus
//               />
//               <select
//                 style={styles.inlineSelect}
//                 value={newRole}
//                 onChange={(e) => setNewRole(e.target.value)}
//               >
//                 <option value="member">Member</option>
//                 <option value="viewer">Viewer</option>
//               </select>
//               <button
//                 type="submit"
//                 style={styles.inlineSubmit}
//                 disabled={formLoading}
//               >
//                 {formLoading ? "Sending..." : "Send"}
//               </button>
//               {formError && (
//                 <div style={styles.inlineError}>{formError}</div>
//               )}
//             </form>
//           )}

//           {/* Invite rows */}
//           {teamInvites.length === 0 ? (
//             <div style={styles.noInvites}>No pending invites for this team</div>
//           ) : (
//             teamInvites.map((inv) => {
//               const isExpired = new Date(inv.expiresAt) < new Date();
//               const daysLeft = Math.ceil(
//                 (new Date(inv.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)
//               );
//               const inviteUrl =
//                 inv._inviteUrl ||
//                 `${window.location.origin}/invite/${inv.token}`;

//               return (
//                 <div key={inv.token} style={styles.sentRow}>
//                   <div style={styles.sentRowLeft}>
//                     <div style={styles.sentEmail}>{inv.email}</div>
//                     <div style={styles.sentMeta}>
//                       <span style={styles.rolePill}>{inv.role}</span>
//                       {" · "}
//                       {isExpired ? (
//                         <span style={{ color: "#f87171" }}>Expired</span>
//                       ) : (
//                         <span
//                           style={{
//                             color: daysLeft <= 2 ? "#fbbf24" : "#71717a",
//                           }}
//                         >
//                           {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
//                         </span>
//                       )}
//                       {" · "}
//                       <span style={{ color: "#52525b" }}>
//                         Sent{" "}
//                         {new Date(inv.createdAt).toLocaleDateString("en-US", {
//                           month: "short",
//                           day: "numeric",
//                         })}
//                       </span>
//                     </div>
//                   </div>

//                   <div style={styles.sentActions}>
//                     {/* Copy link */}
//                     <button
//                       style={styles.actionBtn}
//                       onClick={() => copyLink(inviteUrl, inv.token)}
//                       title="Copy invite link"
//                     >
//                       {copiedToken === inv.token ? "✓ Copied" : "Copy link"}
//                     </button>

//                     {/* Resend / refresh expiry */}
//                     {isExpired && (
//                       <button
//                         style={styles.actionBtn}
//                         disabled={loadingToken === inv.token}
//                         onClick={() => handleResend(inv.token)}
//                         title="Refresh expiry and copy new link"
//                       >
//                         {loadingToken === inv.token ? "..." : "Resend"}
//                       </button>
//                     )}

//                     {/* Revoke */}
//                     <button
//                       style={styles.revokeBtn}
//                       disabled={loadingToken === inv.token}
//                       onClick={() => handleRevoke(inv.token)}
//                       title="Revoke invite"
//                     >
//                       {loadingToken === inv.token ? "..." : "Revoke"}
//                     </button>
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       ))}
//     </div>
//   );
// }

// // ── Empty state ───────────────────────────────────────────────────────────────
// function EmptyState({ icon, title, body, cta }) {
//   return (
//     <div style={styles.empty}>
//       <div style={styles.emptyIcon}>{icon}</div>
//       <h2 style={styles.emptyTitle}>{title}</h2>
//       <p style={styles.emptyBody}>{body}</p>
//       {cta && (
//         <a href={cta.href} style={styles.emptyBtn}>
//           {cta.label}
//         </a>
//       )}
//     </div>
//   );
// }

// // ── Helpers ───────────────────────────────────────────────────────────────────
// function colorFromName(name = "") {
//   const colors = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6"];
//   let hash = 0;
//   for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
//   return colors[Math.abs(hash) % colors.length];
// }

// // ── Styles ────────────────────────────────────────────────────────────────────
// const styles = {
//   root: { minHeight: "100vh", background: "#0f0f11", color: "#e8e8ea", fontFamily: "'DM Sans', system-ui, sans-serif" },
//   header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "32px 36px 0" },
//   pageTitle: { fontSize: 22, fontWeight: 700, color: "#f4f4f5", margin: "0 0 4px", letterSpacing: "-0.02em" },
//   pageSubtitle: { fontSize: 14, color: "#71717a", margin: 0 },
//   tabBar: { display: "flex", gap: 4, padding: "24px 36px 0", borderBottom: "1px solid #27272a", marginBottom: 0 },
//   tab: { padding: "8px 16px", border: "none", background: "transparent", color: "#71717a", fontSize: 14, fontWeight: 500, cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: -1, display: "flex", alignItems: "center", gap: 8 },
//   tabActive: { color: "#f4f4f5", borderBottomColor: "#6366f1" },
//   tabBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: 999, background: "#312e81", color: "#a5b4fc", fontSize: 11, fontWeight: 700, padding: "0 5px" },
//   content: { padding: "24px 36px" },
//   cardList: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 780 },

//   // Received invite card
//   inviteCard: { background: "#18181b", border: "1px solid #27272a", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 },
//   inviteCardLeft: { display: "flex", alignItems: "flex-start", gap: 14 },
//   inviteCardTitle: { fontSize: 15, fontWeight: 600, color: "#f4f4f5", marginBottom: 4 },
//   inviteCardMeta: { fontSize: 13, color: "#71717a", marginBottom: 4, lineHeight: 1.5 },
//   acceptBtn: { padding: "9px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", flexShrink: 0 },

//   // Sent — team section
//   teamSection: { background: "#18181b", border: "1px solid #27272a", borderRadius: 12, overflow: "hidden" },
//   teamSectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #27272a" },
//   teamSectionLeft: { display: "flex", alignItems: "center", gap: 10 },
//   teamSectionName: { fontSize: 14, fontWeight: 600, color: "#f4f4f5", marginRight: 8 },
//   teamSectionMeta: { fontSize: 12, color: "#71717a" },
//   newInviteBtn: { padding: "6px 14px", borderRadius: 7, border: "1px solid #3f3f46", background: "transparent", color: "#a5b4fc", fontSize: 13, fontWeight: 500, cursor: "pointer" },

//   // Inline invite form
//   inlineForm: { display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", background: "#111113", borderBottom: "1px solid #27272a", flexWrap: "wrap" },
//   inlineInput: { flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 7, border: "1px solid #3f3f46", background: "#27272a", color: "#f4f4f5", fontSize: 13, outline: "none" },
//   inlineSelect: { padding: "8px 12px", borderRadius: 7, border: "1px solid #3f3f46", background: "#27272a", color: "#f4f4f5", fontSize: 13, outline: "none", cursor: "pointer" },
//   inlineSubmit: { padding: "8px 16px", borderRadius: 7, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
//   inlineError: { width: "100%", fontSize: 12, color: "#fca5a5", marginTop: 2 },

//   // Sent invite row
//   noInvites: { padding: "14px 18px", fontSize: 13, color: "#52525b" },
//   sentRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid #1f1f22", gap: 12 },
//   sentRowLeft: { display: "flex", flexDirection: "column", gap: 4 },
//   sentEmail: { fontSize: 14, fontWeight: 500, color: "#e4e4e7" },
//   sentMeta: { fontSize: 12, color: "#71717a", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" },
//   sentActions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
//   actionBtn: { padding: "5px 12px", borderRadius: 6, border: "1px solid #3f3f46", background: "transparent", color: "#a1a1aa", fontSize: 12, cursor: "pointer" },
//   revokeBtn: { padding: "5px 12px", borderRadius: 6, border: "1px solid #3f3f46", background: "transparent", color: "#f87171", fontSize: 12, cursor: "pointer" },

//   // Shared
//   teamAvatarSm: { width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 },
//   teamAvatarMd: { width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 },
//   rolePill: { display: "inline-block", padding: "1px 7px", borderRadius: 999, background: "#312e81", color: "#a5b4fc", fontSize: 11, fontWeight: 600 },

//   // Empty state
//   empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", textAlign: "center", gap: 12 },
//   emptyIcon: { fontSize: 40, color: "#3f3f46" },
//   emptyTitle: { fontSize: 18, fontWeight: 600, color: "#f4f4f5", margin: 0 },
//   emptyBody: { fontSize: 14, color: "#71717a", margin: 0, lineHeight: 1.6, maxWidth: 340 },
//   emptyBtn: { display: "inline-block", marginTop: 8, padding: "10px 22px", borderRadius: 8, background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" },
// };

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InvitesPage({
  ownedTeams,
  receivedInvites,
  currentUserId,
  currentUserEmail,
}) {
  const [tab, setTab] = useState(
    receivedInvites.length > 0 ? "received" : "sent"
  );

  const sentInvites = ownedTeams.flatMap((t) =>
    t.invites.map((inv) => ({ ...inv, teamName: t.name }))
  );

  return (
    <div style={styles.root}>
      {/* Page header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Invites</h1>
          <p style={styles.pageSubtitle}>
            Manage invitations you've sent and received
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {["received", "sent"].map((t) => {
          const count = t === "received" ? receivedInvites.length : sentInvites.length;
          return (
            <button
              key={t}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {count > 0 && (
                <span style={{
                  ...styles.tabBadge,
                  ...(tab === t ? styles.tabBadgeActive : {}),
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {tab === "received" && <ReceivedTab invites={receivedInvites} />}
        {tab === "sent" && <SentTab invites={sentInvites} ownedTeams={ownedTeams} />}
      </div>
    </div>
  );
}

// ── Received invites ──────────────────────────────────────────────────────────
function ReceivedTab({ invites }) {
  const router = useRouter();
  const [loadingToken, setLoadingToken] = useState(null);
  const [localInvites, setLocalInvites] = useState(invites);
  const [errors, setErrors] = useState({});

  async function handleAccept(token) {
    setLoadingToken(token);
    setErrors((e) => ({ ...e, [token]: null }));
    try {
      const res = await fetch(`/api/teams/invite/${token}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLocalInvites((prev) => prev.filter((i) => i.token !== token));
      router.push("/dashboard/team");
    } catch (e) {
      setErrors((prev) => ({ ...prev, [token]: e.message }));
    } finally {
      setLoadingToken(null);
    }
  }

  if (localInvites.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--adm-royal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        }
        title="No pending invites"
        body="When someone invites you to their team, it will appear here."
      />
    );
  }

  return (
    <div style={styles.cardList}>
      {localInvites.map((inv) => {
        const daysLeft = Math.ceil(
          (new Date(inv.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)
        );
        const urgent = daysLeft <= 2;
        return (
          <div key={inv.token} style={styles.inviteCard}>
            {/* Left accent strip based on urgency */}
            <div style={{
              ...styles.cardAccent,
              background: urgent ? "#ef4444" : "var(--adm-royal)",
            }} />

            <div style={styles.inviteCardLeft}>
              <div style={{ ...styles.teamAvatarMd, background: colorFromName(inv.team.name) }}>
                {inv.team.name[0].toUpperCase()}
              </div>
              <div>
                <div style={styles.inviteCardTitle}>{inv.team.name}</div>
                <div style={styles.inviteCardMeta}>
                  Invited by{" "}
                  <strong style={{ color: "var(--adm-text)", fontWeight: 600 }}>
                    {inv.team.owner.name || inv.team.owner.email}
                  </strong>
                  {" · "}
                  {inv.team._count.members} member{inv.team._count.members !== 1 ? "s" : ""}
                </div>
                <div style={styles.inviteCardMeta}>
                  <span style={styles.rolePill}>{inv.role}</span>
                  {" · "}
                  <span style={{ color: urgent ? "#dc2626" : "var(--adm-faint)", fontWeight: urgent ? 600 : 400 }}>
                    {urgent ? "⚠ " : ""}Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                  </span>
                </div>
                {errors[inv.token] && (
                  <div style={styles.inlineError}>{errors[inv.token]}</div>
                )}
              </div>
            </div>

            <button
              style={{ ...styles.acceptBtn, opacity: loadingToken === inv.token ? 0.7 : 1 }}
              disabled={loadingToken === inv.token}
              onClick={() => handleAccept(inv.token)}
            >
              {loadingToken === inv.token ? "Joining…" : "Accept invite"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Sent invites ──────────────────────────────────────────────────────────────
function SentTab({ invites, ownedTeams }) {
  const [localInvites, setLocalInvites] = useState(invites);
  const [loadingToken, setLoadingToken] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);

  const [showFormFor, setShowFormFor] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("member");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  async function handleRevoke(token) {
    setLoadingToken(token);
    try {
      const res = await fetch(`/api/teams/invite/${token}/revoke`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke");
      setLocalInvites((prev) => prev.filter((i) => i.token !== token));
    } finally {
      setLoadingToken(null);
    }
  }

  async function handleResend(token) {
    setLoadingToken(token);
    try {
      const res = await fetch(`/api/teams/invite/${token}/resend`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLocalInvites((prev) =>
        prev.map((i) => (i.token === token ? { ...i, expiresAt: data.invite.expiresAt } : i))
      );
      await copyLink(data.inviteUrl, token);
    } finally {
      setLoadingToken(null);
    }
  }

  async function copyLink(url, token) {
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function handleNewInvite(teamId, e) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const team = ownedTeams.find((t) => t.id === teamId);
      setLocalInvites((prev) => [
        { ...data.invite, teamName: team?.name ?? "", _inviteUrl: data.inviteUrl },
        ...prev,
      ]);
      setNewEmail("");
      setNewRole("member");
      setShowFormFor(null);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setFormLoading(false);
    }
  }

  const byTeam = ownedTeams.map((team) => ({
    team,
    invites: localInvites.filter((i) => i.teamId === team.id),
  }));

  if (ownedTeams.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--adm-royal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        }
        title="You don't own any teams"
        body="Create a team first to start inviting members."
        cta={{ label: "Create a team", href: "/dashboard/team" }}
      />
    );
  }

  return (
    <div style={styles.cardList}>
      {byTeam.map(({ team, invites: teamInvites }) => (
        <div key={team.id} style={styles.teamSection}>
          {/* Team header */}
          <div style={styles.teamSectionHeader}>
            <div style={styles.teamSectionLeft}>
              <div style={{ ...styles.teamAvatarSm, background: colorFromName(team.name) }}>
                {team.name[0].toUpperCase()}
              </div>
              <div>
                <span style={styles.teamSectionName}>{team.name}</span>
                <span style={styles.teamSectionMeta}>
                  {team._count.members} member{team._count.members !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <button
              style={{
                ...styles.newInviteBtn,
                ...(showFormFor === team.id ? styles.newInviteBtnCancel : {}),
              }}
              onClick={() => setShowFormFor(showFormFor === team.id ? null : team.id)}
            >
              {showFormFor === team.id ? "Cancel" : "+ Invite"}
            </button>
          </div>

          {/* Inline invite form */}
          {showFormFor === team.id && (
            <div style={styles.inlineFormWrap}>
              <div style={styles.inlineForm}>
                <input
                  style={styles.inlineInput}
                  type="email"
                  placeholder="colleague@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  autoFocus
                />
                <select
                  style={styles.inlineSelect}
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  style={{ ...styles.inlineSubmit, opacity: formLoading ? 0.7 : 1 }}
                  disabled={formLoading}
                  onClick={(e) => handleNewInvite(team.id, e)}
                >
                  {formLoading ? "Sending…" : "Send invite"}
                </button>
              </div>
              {formError && <div style={styles.inlineError}>{formError}</div>}
            </div>
          )}

          {/* Invite rows */}
          {teamInvites.length === 0 ? (
            <div style={styles.noInvites}>No pending invites for this team</div>
          ) : (
            teamInvites.map((inv, i) => {
              const isExpired = new Date(inv.expiresAt) < new Date();
              const daysLeft = Math.ceil(
                (new Date(inv.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)
              );
              const inviteUrl =
                inv._inviteUrl || `${window.location.origin}/invite/${inv.token}`;

              return (
                <div
                  key={inv.token}
                  style={{
                    ...styles.sentRow,
                    ...(i === teamInvites.length - 1 ? { borderBottom: "none" } : {}),
                  }}
                >
                  <div style={styles.sentRowLeft}>
                    <div style={styles.sentEmail}>{inv.email}</div>
                    <div style={styles.sentMeta}>
                      <span style={styles.rolePill}>{inv.role}</span>
                      <span style={styles.metaDot}>·</span>
                      {isExpired ? (
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>Expired</span>
                      ) : (
                        <span style={{ color: daysLeft <= 2 ? "#d97706" : "var(--adm-faint)" }}>
                          {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                        </span>
                      )}
                      <span style={styles.metaDot}>·</span>
                      <span style={{ color: "var(--adm-faint)" }}>
                        Sent{" "}
                        {new Date(inv.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <div style={styles.sentActions}>
                    <button
                      style={{
                        ...styles.actionBtn,
                        ...(copiedToken === inv.token ? styles.actionBtnCopied : {}),
                      }}
                      onClick={() => copyLink(inviteUrl, inv.token)}
                    >
                      {copiedToken === inv.token ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Copied
                        </>
                      ) : "Copy link"}
                    </button>

                    {isExpired && (
                      <button
                        style={styles.actionBtn}
                        disabled={loadingToken === inv.token}
                        onClick={() => handleResend(inv.token)}
                      >
                        {loadingToken === inv.token ? "…" : "Resend"}
                      </button>
                    )}

                    <button
                      style={styles.revokeBtn}
                      disabled={loadingToken === inv.token}
                      onClick={() => handleRevoke(inv.token)}
                    >
                      {loadingToken === inv.token ? "…" : "Revoke"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, body, cta }) {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIconWrap}>{icon}</div>
      <h2 style={styles.emptyTitle}>{title}</h2>
      <p style={styles.emptyBody}>{body}</p>
      {cta && (
        <a href={cta.href} style={styles.emptyBtn}>{cta.label}</a>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function colorFromName(name = "") {
  const colors = [
    "var(--adm-royal)",
    "var(--adm-royal-l)",
    "var(--adm-sky)",
    "#7C3AED",
    "#0891B2",
    "#0D9488",
    "#D97706",
  ];
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ── Styles (Admigo-themed) ────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    background: "var(--adm-bg2)",
    color: "var(--adm-text)",
    fontFamily: "var(--adm-sans)",
  },

  // Header
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "36px 40px 0",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--adm-text)",
    margin: "0 0 4px",
    letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    fontSize: 14,
    color: "var(--adm-muted)",
    margin: 0,
  },

  // Tabs
  tabBar: {
    display: "flex",
    gap: 0,
    padding: "24px 40px 0",
    borderBottom: "1px solid var(--adm-border)",
  },
  tab: {
    padding: "9px 18px",
    border: "none",
    background: "transparent",
    color: "var(--adm-muted)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: -1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--adm-sans)",
    transition: "color 0.15s",
  },
  tabActive: {
    color: "var(--adm-royal)",
    borderBottomColor: "var(--adm-royal)",
    fontWeight: 600,
  },
  tabBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    background: "var(--adm-bg2)",
    border: "1px solid var(--adm-border)",
    color: "var(--adm-muted)",
    fontSize: 11,
    fontWeight: 700,
    padding: "0 5px",
  },
  tabBadgeActive: {
    background: "var(--adm-royal-xs)",
    border: "1px solid var(--adm-br)",
    color: "var(--adm-royal)",
  },

  content: { padding: "28px 40px" },
  cardList: { display: "flex", flexDirection: "column", gap: 14, maxWidth: 800 },

  // Received invite card
  inviteCard: {
    background: "var(--adm-bg)",
    border: "1px solid var(--adm-border)",
    borderRadius: 14,
    padding: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    overflow: "hidden",
    boxShadow: "var(--adm-sh-xs)",
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch",
    flexShrink: 0,
  },
  inviteCardLeft: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    flex: 1,
    padding: "18px 8px 18px 16px",
  },
  inviteCardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--adm-text)",
    marginBottom: 5,
  },
  inviteCardMeta: {
    fontSize: 13,
    color: "var(--adm-muted)",
    marginBottom: 4,
    lineHeight: 1.6,
    display: "flex",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  acceptBtn: {
    margin: "0 20px 0 0",
    padding: "9px 20px",
    borderRadius: 9,
    border: "none",
    background: "var(--adm-royal)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
    fontFamily: "var(--adm-sans)",
    boxShadow: "0 2px 8px rgba(43,92,230,0.28)",
    whiteSpace: "nowrap",
  },

  // Team section (sent tab)
  teamSection: {
    background: "var(--adm-bg)",
    border: "1px solid var(--adm-border)",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "var(--adm-sh-xs)",
  },
  teamSectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid var(--adm-border)",
    background: "var(--adm-bg2)",
  },
  teamSectionLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  teamSectionName: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--adm-text)",
    marginRight: 8,
  },
  teamSectionMeta: {
    fontSize: 12,
    color: "var(--adm-faint)",
  },
  newInviteBtn: {
    padding: "6px 14px",
    borderRadius: 8,
    border: "1px solid var(--adm-br)",
    background: "var(--adm-royal-xs)",
    color: "var(--adm-royal)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
    transition: "all 0.15s",
  },
  newInviteBtnCancel: {
    background: "transparent",
    border: "1px solid var(--adm-border)",
    color: "var(--adm-muted)",
  },

  // Inline invite form
  inlineFormWrap: {
    padding: "14px 18px",
    borderBottom: "1px solid var(--adm-border)",
    background: "var(--adm-bg2)",
  },
  inlineForm: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  inlineInput: {
    flex: 1,
    minWidth: 200,
    padding: "9px 13px",
    borderRadius: 8,
    border: "1px solid var(--adm-border)",
    background: "var(--adm-bg)",
    color: "var(--adm-text)",
    fontSize: 13,
    outline: "none",
    fontFamily: "var(--adm-sans)",
  },
  inlineSelect: {
    padding: "9px 13px",
    borderRadius: 8,
    border: "1px solid var(--adm-border)",
    background: "var(--adm-bg)",
    color: "var(--adm-text)",
    fontSize: 13,
    outline: "none",
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
  },
  inlineSubmit: {
    padding: "9px 18px",
    borderRadius: 8,
    border: "none",
    background: "var(--adm-royal)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
    boxShadow: "0 2px 6px rgba(43,92,230,0.25)",
  },
  inlineError: {
    marginTop: 8,
    fontSize: 12,
    color: "#dc2626",
    fontWeight: 500,
  },

  // Sent invite rows
  noInvites: {
    padding: "16px 20px",
    fontSize: 13,
    color: "var(--adm-faint)",
    fontStyle: "italic",
  },
  sentRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "13px 20px",
    borderBottom: "1px solid var(--adm-border)",
    gap: 12,
    transition: "background 0.1s",
  },
  sentRowLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  sentEmail: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--adm-text)",
  },
  sentMeta: {
    fontSize: 12,
    color: "var(--adm-muted)",
    display: "flex",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  metaDot: {
    color: "var(--adm-faint)",
  },
  sentActions: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexShrink: 0,
  },
  actionBtn: {
    padding: "5px 12px",
    borderRadius: 7,
    border: "1px solid var(--adm-border)",
    background: "transparent",
    color: "var(--adm-muted)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    transition: "all 0.15s",
  },
  actionBtnCopied: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#16a34a",
  },
  revokeBtn: {
    padding: "5px 12px",
    borderRadius: 7,
    border: "1px solid #fecaca",
    background: "#fff5f5",
    color: "#dc2626",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
    transition: "all 0.15s",
  },

  // Shared avatars
  teamAvatarSm: {
    width: 30,
    height: 30,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
  },
  teamAvatarMd: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
    boxShadow: "var(--adm-sh-xs)",
  },
  rolePill: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    background: "var(--adm-royal-xs)",
    border: "1px solid var(--adm-br)",
    color: "var(--adm-royal)",
    fontSize: 11,
    fontWeight: 600,
  },

  // Empty state
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "72px 24px",
    textAlign: "center",
    gap: 14,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    background: "var(--adm-royal-xs)",
    border: "1px solid var(--adm-br)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--adm-text)",
    margin: 0,
    letterSpacing: "-0.01em",
  },
  emptyBody: {
    fontSize: 14,
    color: "var(--adm-muted)",
    margin: 0,
    lineHeight: 1.7,
    maxWidth: 340,
  },
  emptyBtn: {
    display: "inline-block",
    marginTop: 6,
    padding: "10px 24px",
    borderRadius: 9,
    background: "var(--adm-royal)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    boxShadow: "0 2px 8px rgba(43,92,230,0.30)",
    fontFamily: "var(--adm-sans)",
  },
};