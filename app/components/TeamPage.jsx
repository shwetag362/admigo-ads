//app/components/TeamPage.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeamPage({ memberships, currentUserId }) {
  const router = useRouter();
  const [teams, setTeams] = useState(memberships);
  const [view, setView] = useState(teams.length === 0 ? "create" : "list");
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [teamDetail, setTeamDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function loadTeamDetail(teamId) {
    setLoadingDetail(true);
    setSelectedTeamId(teamId);
    setView("detail");
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      const data = await res.json();
      setTeamDetail(data.team);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function refreshSidebar() {
    const res = await fetch("/api/teams");
    const data = await res.json();
    setTeams(data.memberships);
    // Re-run the server component so SSR props stay in sync
    router.refresh();
  }

  async function handleCreateTeam(name, description) {
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await refreshSidebar();
    setView("list");
    return data.team;
  }

  async function handleInvite(teamId, email, role) {
    const res = await fetch(`/api/teams/${teamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  async function handleDeleteTeam(teamId) {
    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    await refreshSidebar();
    setSelectedTeamId(null);
    setTeamDetail(null);
    setView(teams.length <= 1 ? "create" : "list");
  }

  async function handleUpdateMemberAccounts(teamId, memberId, assignments) {
    const res = await fetch(`/api/teams/${teamId}/members/${memberId}/accounts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    await loadTeamDetail(teamId);
    router.refresh();
  }

  async function handleRemoveMember(teamId, memberId) {
    const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    await loadTeamDetail(teamId);
    router.refresh();
  }

  return (
    <div style={styles.root}>
      {/* ── Sidebar ── */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarTitle}>Teams</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <RefreshButton onRefresh={async () => {
              await refreshSidebar();
              if (selectedTeamId) await loadTeamDetail(selectedTeamId);
            }} />
            <button
              style={styles.newBtn}
              onClick={() => setView("create")}
              onMouseEnter={e => Object.assign(e.currentTarget.style, styles.newBtnHover)}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: "var(--adm-royal-xs)", color: "var(--adm-royal)" })}
            >
              + New
            </button>
          </div>
        </div>

        {teams.length === 0 ? (
          <p style={styles.emptyNote}>No teams yet</p>
        ) : (
          <nav style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
            {teams.map(({ team, role }) => (
              <button
                key={team.id}
                style={{
                  ...styles.teamItem,
                  ...(selectedTeamId === team.id ? styles.teamItemActive : {}),
                }}
                onClick={() => loadTeamDetail(team.id)}
              >
                <div style={{ ...styles.teamAvatar, background: colorFromName(team.name) }}>
                  {team.name[0].toUpperCase()}
                </div>
                <div style={styles.teamItemInfo}>
                  <span style={styles.teamItemName}>{team.name}</span>
                  <span style={styles.teamItemMeta}>
                    {team._count.members} member{team._count.members !== 1 ? "s" : ""} · {role}
                  </span>
                </div>
              </button>
            ))}
          </nav>
        )}
      </aside>

      {/* ── Main content ── */}
      <main style={styles.main}>
        {view === "create" && (
          <CreateTeamView onSubmit={handleCreateTeam} onCancel={() => setView("list")} />
        )}
        {view === "list" && (
          <EmptyState onNew={() => setView("create")} />
        )}
        {view === "detail" && (
          loadingDetail
            ? <div style={styles.loading}><span style={styles.loadingDot} />Loading team…</div>
            : teamDetail
              ? <TeamDetailView
                  team={teamDetail}
                  currentUserId={currentUserId}
                  onInvite={handleInvite}
                  onRemove={handleRemoveMember}
                  onDelete={handleDeleteTeam}
                  onUpdateMemberAccounts={handleUpdateMemberAccounts}
                  onRefresh={async () => {
                    await loadTeamDetail(teamDetail.id);
                    router.refresh();
                  }}
                />
              : <div style={styles.loading}>Team not found</div>
        )}
      </main>
    </div>
  );
}

// ── Refresh button ────────────────────────────────────────────────────────────
function RefreshButton({ onRefresh }) {
  const [spinning, setSpinning] = useState(false);

  async function handleClick() {
    if (spinning) return;
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      // Keep spinner for at least 600ms so it feels intentional
      setTimeout(() => setSpinning(false), 600);
    }
  }

  return (
    <button
      style={styles.refreshBtn}
      onClick={handleClick}
      title="Refresh"
      disabled={spinning}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition: "transform 0.6s ease",
          transform: spinning ? "rotate(360deg)" : "rotate(0deg)",
        }}
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </button>
  );
}

// ── Create team form ──────────────────────────────────────────────────────────
function CreateTeamView({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(name, desc);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.formOuter}>
      <div style={styles.formCard}>
        <div style={styles.formAccentBar} />
        <div style={styles.formWrap}>
          <div style={styles.formIconWrap}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--adm-royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h2 style={styles.formTitle}>Create a team</h2>
          <p style={styles.formSubtitle}>Teams let you collaborate and share access with others.</p>

          {error && <div style={styles.errorBox}>{error}</div>}

          <div onSubmit={handleSubmit}>
            <label style={styles.label}>Team name</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing team"
              required
            />
            <label style={styles.label}>
              Description <span style={styles.optional}>(optional)</span>
            </label>
            <input
              style={styles.input}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What is this team for?"
            />
            <div style={styles.formActions}>
              <button type="button" style={styles.cancelBtn} onClick={onCancel}>Cancel</button>
              <button
                style={{ ...styles.submitBtn, opacity: (loading || !name.trim()) ? 0.6 : 1 }}
                disabled={loading || !name.trim()}
                onClick={handleSubmit}
              >
                {loading ? "Creating…" : "Create team"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Team detail ───────────────────────────────────────────────────────────────
function TeamDetailView({ team, currentUserId, onInvite, onRemove, onDelete, onUpdateMemberAccounts, onRefresh }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmName, setConfirmName] = useState("");
  const [managingAccessFor, setManagingAccessFor] = useState(null);

  const myMembership = team.members.find((m) => m.user.id === currentUserId);
  const isOwner = myMembership?.role === "owner";

  async function handleDelete() {
    if (confirmName !== team.name) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await onDelete(team.id);
    } catch (e) {
      setDeleteError(e.message);
      setDeleteLoading(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteResult(null);
    try {
      const data = await onInvite(team.id, inviteEmail, inviteRole);
      setInviteResult(data.inviteUrl);
      setInviteEmail("");
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRemove(memberId) {
    setRemovingId(memberId);
    try {
      await onRemove(team.id, memberId);
    } catch (e) {
      alert(e.message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div style={styles.detailRoot}>
      {/* Team header card */}
      <div style={styles.detailHeaderCard}>
        <div style={{ ...styles.teamAvatarLg, background: colorFromName(team.name) }}>
          {team.name[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={styles.detailTitle}>{team.name}</h1>
          {team.description && <p style={styles.detailDesc}>{team.description}</p>}
          <div style={styles.detailMeta}>
            <span style={styles.metaPill}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {team.members.length} member{team.members.length !== 1 ? "s" : ""}
            </span>
            <span style={styles.rolePill}>{myMembership?.role}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          {/* Refresh button in detail header */}
          <RefreshButton onRefresh={onRefresh} />
          {isOwner && (
            <button
              style={styles.deleteHeaderBtn}
              onClick={() => { setShowDeleteConfirm(true); setConfirmName(""); setDeleteError(null); }}
              title="Delete team"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Delete team
            </button>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div style={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div style={styles.modalDangerIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 style={styles.modalTitle}>Delete "{team.name}"?</h3>
            <p style={styles.modalBody}>
              This will permanently delete the team and remove all {team.members.length} member{team.members.length !== 1 ? "s" : ""}. This action <strong>cannot be undone</strong>.
            </p>
            <label style={styles.label}>
              Type <strong>{team.name}</strong> to confirm
            </label>
            <input
              style={{ ...styles.input, marginTop: 6 }}
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={team.name}
              autoFocus
            />
            {deleteError && <div style={{ ...styles.errorBox, marginTop: 12, marginBottom: 0 }}>{deleteError}</div>}
            <div style={{ ...styles.formActions, marginTop: 20 }}>
              <button style={styles.cancelBtn} onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                style={{
                  ...styles.dangerBtn,
                  opacity: (confirmName !== team.name || deleteLoading) ? 0.45 : 1,
                  cursor: confirmName !== team.name ? "not-allowed" : "pointer",
                }}
                disabled={confirmName !== team.name || deleteLoading}
                onClick={handleDelete}
              >
                {deleteLoading ? "Deleting…" : "Delete team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite section */}
      {isOwner && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Invite a team member</h2>
          <div style={styles.sectionCard}>
            <div style={styles.inviteRow}>
              <input
                style={{ ...styles.input, flex: 1, marginBottom: 0 }}
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
              />
              <select
                style={styles.select}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                style={{ ...styles.submitBtn, opacity: inviteLoading ? 0.6 : 1 }}
                disabled={inviteLoading}
                onClick={handleInvite}
              >
                {inviteLoading ? "Sending…" : "Send invite"}
              </button>
            </div>

            {inviteError && <div style={{ ...styles.errorBox, marginTop: 12, marginBottom: 0 }}>{inviteError}</div>}

            {inviteResult && (
              <div style={styles.inviteSuccess}>
                <div style={styles.inviteSuccessLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Invite created — share this link:
                </div>
                <div style={styles.inviteLinkRow}>
                  <code style={styles.inviteLink}>{inviteResult}</code>
                  <button
                    style={styles.copyBtn}
                    onClick={() => navigator.clipboard.writeText(inviteResult)}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending invites */}
      {isOwner && team.invites?.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Pending invites</h2>
          <div style={styles.tableCard}>
            {team.invites.map((inv) => (
              <div key={inv.id} style={styles.memberRow}>
                <div style={styles.memberInfo}>
                  <div style={styles.memberAvatarGray}>?</div>
                  <div>
                    <div style={styles.memberName}>{inv.email}</div>
                    <div style={styles.memberMeta}>
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <span style={{ ...styles.badge, ...styles.badgePending }}>{inv.role} · pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members list */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Members</h2>
        <div style={styles.tableCard}>
          {team.members.map((m, i) => (
            <div key={m.id}>
              <div
                style={{
                  ...styles.memberRow,
                  ...(i === team.members.length - 1 && managingAccessFor !== m.id ? { borderBottom: "none" } : {}),
                  ...(managingAccessFor === m.id ? { background: "var(--adm-royal-xs)" } : {}),
                }}
              >
                <div style={styles.memberInfo}>
                  <div style={{ ...styles.memberAvatar, background: colorFromName(m.user.name || m.user.email) }}>
                    {(m.user.name || m.user.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={styles.memberName}>
                      {m.user.name || "—"}
                      {m.user.id === currentUserId && (
                        <span style={styles.youBadge}>you</span>
                      )}
                    </div>
                    <div style={styles.memberMeta}>
                      {m.user.email}
                      {m.accountAccess?.length > 0 && (
                        <span style={styles.accessCountPill}>
                          {m.accountAccess.length} account{m.accountAccess.length !== 1 ? "s" : ""} assigned
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={styles.memberActions}>
                  <span style={{
                    ...styles.badge,
                    ...(m.role === "owner" ? styles.badgeOwner : m.role === "member" ? styles.badgeMember : styles.badgeViewer),
                  }}>
                    {m.role}
                  </span>

                  {isOwner && m.user.id !== currentUserId && (
                    <>
                      <button
                        style={{
                          ...styles.manageAccessBtn,
                          ...(managingAccessFor === m.id ? styles.manageAccessBtnActive : {}),
                        }}
                        onClick={() => setManagingAccessFor(managingAccessFor === m.id ? null : m.id)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        {managingAccessFor === m.id ? "Done" : "Manage Access"}
                      </button>
                      <button
                        style={styles.removeBtn}
                        disabled={removingId === m.id}
                        onClick={() => handleRemove(m.id)}
                      >
                        {removingId === m.id ? "…" : "Remove"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {managingAccessFor === m.id && isOwner && (
                <AccountAccessPanel
                  member={m}
                  team={team}
                  onSave={async (assignments) => {
                    await onUpdateMemberAccounts(team.id, m.id, assignments);
                    setManagingAccessFor(null);
                  }}
                  onClose={() => setManagingAccessFor(null)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Account Access Panel ──────────────────────────────────────────────────────
const ALL_PERMISSIONS = [
  { key: "view_campaigns",   label: "View campaigns",   desc: "See all campaigns & their stats" },
  { key: "create_campaigns", label: "Create campaigns", desc: "Launch new campaigns & ad sets" },
  { key: "edit_campaigns",   label: "Edit campaigns",   desc: "Modify existing campaigns" },
  { key: "view_analytics",   label: "View analytics",   desc: "Access reporting & insights" },
  { key: "manage_budgets",   label: "Manage budgets",   desc: "Change spend limits & bids" },
];

function AccountAccessPanel({ member, team, onSave, onClose }) {
  const existing = member.accountAccess || [];
  const initState = () => {
    const s = {};
    for (const acc of team.ownerAdAccounts || []) {
      const found = existing.find(a => a.adAccountId === acc.id);
      s[acc.id] = {
        enabled: !!found,
        permissions: found?.permissions ?? [],
      };
    }
    return s;
  };

  const [state, setState] = useState(initState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const accounts = team.ownerAdAccounts || [];

  function toggleAccount(accId) {
    setState(prev => ({
      ...prev,
      [accId]: {
        enabled: !prev[accId].enabled,
        permissions: prev[accId].enabled ? [] : ["view_campaigns", "view_analytics"],
      },
    }));
  }

  function togglePerm(accId, perm) {
    setState(prev => {
      const cur = prev[accId].permissions;
      return {
        ...prev,
        [accId]: {
          ...prev[accId],
          permissions: cur.includes(perm) ? cur.filter(p => p !== perm) : [...cur, perm],
        },
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const assignments = Object.entries(state)
        .filter(([, v]) => v.enabled)
        .map(([adAccountId, v]) => ({ adAccountId, permissions: v.permissions }));
      await onSave(assignments);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <div style={styles.accessPanel}>
        <p style={{ fontSize: 13, color: "var(--adm-muted)", margin: 0 }}>
          No Meta Ad Accounts found on your profile. Connect an account first.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.accessPanel}>
      <div style={styles.accessPanelHeader}>
        <div>
          <div style={styles.accessPanelTitle}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--adm-royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Account access for <strong>{member.user.name || member.user.email}</strong>
          </div>
          <div style={styles.accessPanelSubtitle}>
            Toggle which ad accounts this member can access, then set permissions per account.
          </div>
        </div>
      </div>

      <div style={styles.accessAccountList}>
        {accounts.map((acc) => {
          const s = state[acc.id] || { enabled: false, permissions: [] };
          return (
            <div key={acc.id} style={{ ...styles.accessAccountItem, ...(s.enabled ? styles.accessAccountItemOn : {}) }}>
              <div style={styles.accessAccountRow}>
                <div style={styles.accessAccountLeft}>
                  <button
                    style={{ ...styles.accessToggle, ...(s.enabled ? styles.accessToggleOn : {}) }}
                    onClick={() => toggleAccount(acc.id)}
                    role="switch"
                    aria-checked={s.enabled}
                  >
                    <span style={{ ...styles.accessToggleThumb, ...(s.enabled ? styles.accessToggleThumbOn : {}) }} />
                  </button>
                  <div>
                    <div style={styles.accessAccountName}>{acc.name}</div>
                    <div style={styles.accessAccountMeta}>
                      {acc.currency} · {acc.metaAccountId}
                    </div>
                  </div>
                </div>
                {s.enabled && (
                  <span style={styles.accessEnabledBadge}>
                    {s.permissions.length} permission{s.permissions.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {s.enabled && (
                <div style={styles.permsGrid}>
                  {ALL_PERMISSIONS.map(p => {
                    const on = s.permissions.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        style={{ ...styles.permChip, ...(on ? styles.permChipOn : {}) }}
                        onClick={() => togglePerm(acc.id, p.key)}
                      >
                        <span style={{ ...styles.permChipDot, ...(on ? styles.permChipDotOn : {}) }} />
                        <div>
                          <div style={styles.permChipLabel}>{p.label}</div>
                          <div style={styles.permChipDesc}>{p.desc}</div>
                        </div>
                        {on && (
                          <svg style={{ marginLeft: "auto", flexShrink: 0 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--adm-royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <div style={{ ...styles.errorBox, margin: "12px 20px 0" }}>{error}</div>}

      <div style={styles.accessPanelFooter}>
        <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
        <button
          style={{ ...styles.submitBtn, opacity: saving ? 0.7 : 1 }}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save access"}
        </button>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onNew }) {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIllustration}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--adm-royal)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <h2 style={styles.emptyTitle}>No team selected</h2>
      <p style={styles.emptyBody}>Select a team from the sidebar or create a new one to get started.</p>
      <button style={styles.submitBtn} onClick={onNew}>Create a team</button>
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

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    display: "flex",
    minHeight: "100vh",
    background: "var(--adm-bg2)",
    color: "var(--adm-text)",
    fontFamily: "var(--adm-sans)",
  },
  sidebar: {
    width: 268,
    flexShrink: 0,
    background: "var(--adm-bg)",
    borderRight: "1px solid var(--adm-border)",
    display: "flex",
    flexDirection: "column",
    boxShadow: "var(--adm-sh-xs)",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 16px 14px",
    borderBottom: "1px solid var(--adm-border)",
  },
  sidebarTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--adm-faint)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  newBtn: {
    padding: "5px 12px",
    borderRadius: 8,
    border: "1px solid var(--adm-br)",
    background: "var(--adm-royal-xs)",
    color: "var(--adm-royal)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
    fontFamily: "var(--adm-sans)",
  },
  newBtnHover: {
    background: "var(--adm-royal)",
    color: "#fff",
  },
  // Refresh button
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 7,
    border: "1px solid var(--adm-border)",
    background: "transparent",
    color: "var(--adm-muted)",
    cursor: "pointer",
    padding: 0,
    fontFamily: "var(--adm-sans)",
    transition: "border-color 0.15s, color 0.15s, background 0.15s",
  },
  emptyNote: {
    fontSize: 13,
    color: "var(--adm-faint)",
    textAlign: "center",
    padding: "24px 16px",
  },
  teamItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 10px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    borderRadius: 10,
    transition: "background 0.12s",
  },
  teamItemActive: {
    background: "var(--adm-royal-xs)",
    outline: "1px solid var(--adm-br)",
  },
  teamAvatar: {
    width: 34,
    height: 34,
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
    letterSpacing: "-0.01em",
  },
  teamAvatarLg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
    boxShadow: "var(--adm-sh-md)",
  },
  teamItemInfo: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  teamItemName: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--adm-text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  teamItemMeta: {
    fontSize: 11,
    color: "var(--adm-faint)",
    marginTop: 2,
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "auto",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    color: "var(--adm-muted)",
    fontSize: 14,
    gap: 10,
  },
  loadingDot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--adm-royal)",
    opacity: 0.6,
  },
  formOuter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    padding: "48px 24px",
  },
  formCard: {
    width: "100%",
    maxWidth: 480,
    background: "var(--adm-bg)",
    borderRadius: 16,
    border: "1px solid var(--adm-border)",
    boxShadow: "var(--adm-sh-sm)",
    overflow: "hidden",
  },
  formAccentBar: {
    height: 4,
    background: "linear-gradient(90deg, var(--adm-royal) 0%, var(--adm-royal-l) 100%)",
  },
  formWrap: {
    padding: "32px 36px 36px",
  },
  formIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "var(--adm-royal-xs)",
    border: "1px solid var(--adm-br)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--adm-text)",
    margin: "0 0 6px",
    letterSpacing: "-0.02em",
  },
  formSubtitle: {
    fontSize: 14,
    color: "var(--adm-muted)",
    margin: "0 0 28px",
    lineHeight: 1.6,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--adm-text)",
    marginBottom: 6,
    marginTop: 18,
  },
  optional: {
    fontSize: 12,
    color: "var(--adm-faint)",
    fontWeight: 400,
  },
  input: {
    display: "block",
    width: "100%",
    padding: "10px 14px",
    borderRadius: 9,
    border: "1px solid var(--adm-border)",
    background: "var(--adm-bg2)",
    color: "var(--adm-text)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--adm-sans)",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  select: {
    padding: "10px 14px",
    borderRadius: 9,
    border: "1px solid var(--adm-border)",
    background: "var(--adm-bg2)",
    color: "var(--adm-text)",
    fontSize: 14,
    outline: "none",
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
  },
  formActions: {
    display: "flex",
    gap: 10,
    marginTop: 28,
    justifyContent: "flex-end",
  },
  cancelBtn: {
    padding: "10px 18px",
    borderRadius: 9,
    border: "1px solid var(--adm-border)",
    background: "transparent",
    color: "var(--adm-muted)",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
    fontWeight: 500,
  },
  submitBtn: {
    padding: "10px 20px",
    borderRadius: 9,
    border: "none",
    background: "var(--adm-royal)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
    boxShadow: "0 2px 8px rgba(43,92,230,0.30)",
    transition: "background 0.15s, box-shadow 0.15s",
  },
  errorBox: {
    background: "#fff5f5",
    border: "1px solid #fecaca",
    borderRadius: 9,
    padding: "10px 14px",
    fontSize: 13,
    color: "#b91c1c",
    marginBottom: 16,
  },
  detailRoot: {
    padding: "32px 40px",
    maxWidth: 820,
  },
  detailHeaderCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 18,
    marginBottom: 32,
    padding: "24px 28px",
    background: "var(--adm-bg)",
    borderRadius: 16,
    border: "1px solid var(--adm-border)",
    boxShadow: "var(--adm-sh-xs)",
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--adm-text)",
    margin: "0 0 4px",
    letterSpacing: "-0.02em",
  },
  detailDesc: {
    fontSize: 14,
    color: "var(--adm-muted)",
    margin: "0 0 10px",
    lineHeight: 1.6,
  },
  detailMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--adm-muted)",
  },
  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 999,
    background: "var(--adm-bg2)",
    border: "1px solid var(--adm-border)",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--adm-muted)",
  },
  rolePill: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    background: "var(--adm-royal-xs)",
    border: "1px solid var(--adm-br)",
    color: "var(--adm-royal)",
    fontSize: 12,
    fontWeight: 600,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--adm-faint)",
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    margin: "0 0 10px",
  },
  sectionCard: {
    background: "var(--adm-bg)",
    border: "1px solid var(--adm-border)",
    borderRadius: 14,
    padding: "20px 20px",
    boxShadow: "var(--adm-sh-xs)",
  },
  inviteRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  inviteSuccess: {
    marginTop: 14,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "12px 16px",
  },
  inviteSuccessLabel: {
    fontSize: 13,
    color: "#15803d",
    marginBottom: 8,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
  },
  inviteLinkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  inviteLink: {
    flex: 1,
    fontSize: 12,
    color: "#166534",
    background: "#dcfce7",
    padding: "7px 12px",
    borderRadius: 7,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
    fontFamily: "var(--adm-mono)",
  },
  copyBtn: {
    padding: "6px 14px",
    borderRadius: 7,
    border: "1px solid #86efac",
    background: "transparent",
    color: "#16a34a",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
    fontFamily: "var(--adm-sans)",
  },
  tableCard: {
    background: "var(--adm-bg)",
    border: "1px solid var(--adm-border)",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "var(--adm-sh-xs)",
  },
  memberRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "13px 18px",
    borderBottom: "1px solid var(--adm-border)",
    transition: "background 0.1s",
  },
  memberInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
  },
  memberAvatarGray: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--adm-faint)",
    background: "var(--adm-bg2)",
    border: "1px dashed var(--adm-border)",
    flexShrink: 0,
  },
  memberName: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--adm-text)",
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  memberMeta: {
    fontSize: 12,
    color: "var(--adm-faint)",
    marginTop: 2,
  },
  memberActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  youBadge: {
    fontSize: 11,
    color: "var(--adm-royal)",
    fontWeight: 600,
    background: "var(--adm-royal-xs)",
    border: "1px solid var(--adm-br)",
    padding: "1px 7px",
    borderRadius: 999,
  },
  badge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.03em",
  },
  badgeOwner:   { background: "var(--adm-royal-xs)", color: "var(--adm-royal)", border: "1px solid var(--adm-br)" },
  badgeMember:  { background: "var(--adm-bg2)", color: "var(--adm-muted)", border: "1px solid var(--adm-border)" },
  badgeViewer:  { background: "#fafaf9", color: "#78716c", border: "1px solid #e7e5e4" },
  badgePending: { background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" },
  removeBtn: {
    padding: "5px 12px",
    borderRadius: 7,
    border: "1px solid #fecaca",
    background: "#fff5f5",
    color: "#dc2626",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
  },
  manageAccessBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 12px",
    borderRadius: 7,
    border: "1px solid var(--adm-border)",
    background: "transparent",
    color: "var(--adm-muted)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
    transition: "all 0.15s",
  },
  manageAccessBtnActive: {
    border: "1px solid var(--adm-br)",
    background: "var(--adm-royal-xs)",
    color: "var(--adm-royal)",
    fontWeight: 600,
  },
  accessCountPill: {
    display: "inline-block",
    marginLeft: 8,
    padding: "1px 7px",
    borderRadius: 999,
    background: "var(--adm-royal-xs)",
    border: "1px solid var(--adm-br)",
    color: "var(--adm-royal)",
    fontSize: 10,
    fontWeight: 600,
  },
  accessPanel: {
    borderTop: "1px solid var(--adm-border)",
    background: "var(--adm-bg2)",
  },
  accessPanelHeader: {
    padding: "16px 20px 12px",
    borderBottom: "1px solid var(--adm-border)",
  },
  accessPanelTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--adm-text)",
    display: "flex",
    alignItems: "center",
    marginBottom: 3,
  },
  accessPanelSubtitle: {
    fontSize: 12,
    color: "var(--adm-muted)",
    lineHeight: 1.5,
  },
  accessAccountList: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  accessAccountItem: {
    borderBottom: "1px solid var(--adm-border)",
    transition: "background 0.12s",
  },
  accessAccountItemOn: {
    background: "var(--adm-bg)",
  },
  accessAccountRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    gap: 12,
  },
  accessAccountLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  accessAccountName: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--adm-text)",
  },
  accessAccountMeta: {
    fontSize: 11,
    color: "var(--adm-faint)",
    marginTop: 2,
    fontFamily: "var(--adm-mono)",
  },
  accessEnabledBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--adm-royal)",
    background: "var(--adm-royal-xs)",
    border: "1px solid var(--adm-br)",
    padding: "2px 9px",
    borderRadius: 999,
  },
  accessToggle: {
    width: 36,
    height: 20,
    borderRadius: 999,
    border: "none",
    background: "var(--adm-border)",
    cursor: "pointer",
    padding: 2,
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    transition: "background 0.18s",
    position: "relative",
  },
  accessToggleOn: {
    background: "var(--adm-royal)",
  },
  accessToggleThumb: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
    transition: "transform 0.18s",
    transform: "translateX(0)",
    display: "block",
  },
  accessToggleThumbOn: {
    transform: "translateX(16px)",
  },
  permsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 8,
    padding: "0 20px 14px",
  },
  permChip: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--adm-border)",
    background: "var(--adm-bg)",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "var(--adm-sans)",
    transition: "all 0.13s",
  },
  permChipOn: {
    border: "1px solid var(--adm-br)",
    background: "var(--adm-royal-xs)",
  },
  permChipDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--adm-border)",
    flexShrink: 0,
    marginTop: 4,
    transition: "background 0.13s",
  },
  permChipDotOn: {
    background: "var(--adm-royal)",
  },
  permChipLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--adm-text)",
    marginBottom: 2,
  },
  permChipDesc: {
    fontSize: 11,
    color: "var(--adm-faint)",
    lineHeight: 1.4,
  },
  accessPanelFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    padding: "12px 20px",
    borderTop: "1px solid var(--adm-border)",
    background: "var(--adm-bg)",
  },
  deleteHeaderBtn: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    borderRadius: 8,
    border: "1px solid #fecaca",
    background: "#fff5f5",
    color: "#dc2626",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--adm-sans)",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(13,27,62,0.45)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 24,
  },
  modalCard: {
    background: "var(--adm-bg)",
    border: "1px solid #fecaca",
    borderRadius: 16,
    padding: "32px 32px 28px",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 8px 40px hsla(0, 72%, 51%, 0.12), var(--adm-sh-sm)",
  },
  modalDangerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "#fff5f5",
    border: "1px solid #fecaca",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "var(--adm-text)",
    margin: "0 0 10px",
    letterSpacing: "-0.01em",
  },
  modalBody: {
    fontSize: 14,
    color: "var(--adm-muted)",
    lineHeight: 1.65,
    margin: "0 0 20px",
  },
  dangerBtn: {
    padding: "10px 20px",
    borderRadius: 9,
    border: "none",
    background: "#dc2626",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "var(--adm-sans)",
    boxShadow: "0 2px 8px rgba(220,38,38,0.28)",
    transition: "opacity 0.15s",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 14,
    padding: 64,
    textAlign: "center",
  },
  emptyIllustration: {
    width: 88,
    height: 88,
    borderRadius: 24,
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
    maxWidth: 320,
  },
};