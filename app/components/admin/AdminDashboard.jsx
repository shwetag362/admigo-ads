// components/admin/AdminDashboard.jsx
"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function AdminDashboard({ admin, stats, recentUsers }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div style={styles.root}>
      {/* ── Sidebar ── */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>A</div>
          <span style={styles.brandText}>Admin</span>
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              style={{
                ...styles.navItem,
                ...(activeTab === item.id ? styles.navItemActive : {}),
              }}
              onClick={() => setActiveTab(item.id)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.adminInfo}>
            <div style={styles.adminAvatar}>
              {admin?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div>
              <div style={styles.adminName}>{admin?.name ?? "Admin"}</div>
              <div style={styles.adminEmail}>{admin?.email}</div>
            </div>
          </div>
          <button
            style={styles.signOutBtn}
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>
              {NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "Overview"}
            </h1>
            <p style={styles.pageSubtitle}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
          <div style={styles.roleBadge}>Admin</div>
        </header>

        {/* Content */}
        {activeTab === "overview" && (
          <OverviewTab stats={stats} recentUsers={recentUsers} />
        )}
        {activeTab === "users" && <UsersTab users={recentUsers} />}
        {activeTab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ stats, recentUsers }) {
  const statCards = [
    { label: "Total users",       value: stats.totalUsers,       color: "#6366f1" },
    { label: "Total campaigns",   value: stats.totalCampaigns,   color: "#10b981" },
    { label: "Ad accounts",       value: stats.totalAdAccounts,  color: "#f59e0b" },
  ];

  return (
    <div>
      {/* Stat cards */}
      <div style={styles.statsGrid}>
        {statCards.map((s) => (
          <div key={s.label} style={styles.statCard}>
            <div style={{ ...styles.statAccent, background: s.color }} />
            <div style={styles.statValue}>{s.value.toLocaleString()}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent users table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h2 style={styles.tableTitle}>Recent users</h2>
        </div>
        <UserTable users={recentUsers} />
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab({ users }) {
  return (
    <div style={styles.tableCard}>
      <div style={styles.tableHeader}>
        <h2 style={styles.tableTitle}>All users</h2>
        <span style={styles.tableCount}>{users.length} shown</span>
      </div>
      <UserTable users={users} showPromote />
    </div>
  );
}

// ── Shared user table ─────────────────────────────────────────────────────────
function UserTable({ users, showPromote = false }) {
  const [loadingId, setLoadingId] = useState(null);
  const [localUsers, setLocalUsers] = useState(users);

  async function handleRoleToggle(userId, currentRole) {
    setLoadingId(userId);
    const newRole = currentRole === "admin" ? "user" : "admin";
    try {
      const res = await fetch("/api/admin/users/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        setLocalUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      }
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {["User", "Email", "Role", "Ad accounts", "Campaigns", "Joined", ...(showPromote ? ["Action"] : [])].map(
              (h) => <th key={h} style={styles.th}>{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {localUsers.map((u) => (
            <tr key={u.id} style={styles.tr}>
              <td style={styles.td}>
                <div style={styles.userCell}>
                  <div style={styles.userAvatar}>
                    {u.name?.[0]?.toUpperCase() ?? u.email[0].toUpperCase()}
                  </div>
                  <span style={styles.userName}>{u.name ?? "—"}</span>
                </div>
              </td>
              <td style={{ ...styles.td, ...styles.emailCell }}>{u.email}</td>
              <td style={styles.td}>
                <span style={{
                  ...styles.badge,
                  ...(u.role === "admin" ? styles.badgeAdmin : styles.badgeUser),
                }}>
                  {u.role}
                </span>
              </td>
              <td style={{ ...styles.td, ...styles.numCell }}>
                {u._count?.metaAdAccounts ?? 0}
              </td>
              <td style={{ ...styles.td, ...styles.numCell }}>
                {u._count?.campaigns ?? 0}
              </td>
              <td style={{ ...styles.td, ...styles.dateCell }}>
                {new Date(u.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </td>
              {showPromote && (
                <td style={styles.td}>
                  <button
                    style={{
                      ...styles.promoteBtn,
                      ...(u.role === "admin" ? styles.demoteBtn : {}),
                    }}
                    disabled={loadingId === u.id}
                    onClick={() => handleRoleToggle(u.id, u.role)}
                  >
                    {loadingId === u.id
                      ? "..."
                      : u.role === "admin"
                      ? "Demote"
                      : "Make admin"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab() {
  return (
    <div style={styles.settingsGrid}>
      <div style={styles.settingsCard}>
        <h3 style={styles.settingsTitle}>Platform info</h3>
        <div style={styles.settingsRow}>
          <span style={styles.settingsKey}>Environment</span>
          <span style={styles.settingsValue}>{process.env.NODE_ENV ?? "production"}</span>
        </div>
        <div style={styles.settingsRow}>
          <span style={styles.settingsKey}>Meta API version</span>
          <span style={styles.settingsValue}>v24.0</span>
        </div>
      </div>

      <div style={styles.settingsCard}>
        <h3 style={styles.settingsTitle}>Roles</h3>
        <div style={styles.settingsRow}>
          <span style={styles.settingsKey}>Default role</span>
          <span style={styles.settingsValue}>user</span>
        </div>
        <div style={styles.settingsRow}>
          <span style={styles.settingsKey}>Admin role</span>
          <span style={styles.settingsValue}>admin</span>
        </div>
        <p style={styles.settingsNote}>
          Promote users from the Users tab. Role changes take effect on next login.
        </p>
      </div>
    </div>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "overview", label: "Overview",  icon: "▦" },
  { id: "users",    label: "Users",     icon: "◎" },
  { id: "settings", label: "Settings",  icon: "⚙" },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    display: "flex",
    minHeight: "100vh",
    background: "#0f0f11",
    color: "#e8e8ea",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: "#18181b",
    borderRight: "1px solid #27272a",
    display: "flex",
    flexDirection: "column",
    padding: "24px 0",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 20px 28px",
    borderBottom: "1px solid #27272a",
    marginBottom: 16,
  },
  brandIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "#6366f1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 13,
    color: "#fff",
  },
  brandText: {
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: "-0.01em",
    color: "#f4f4f5",
  },
  nav: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "0 12px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "#a1a1aa",
    fontSize: 13.5,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s",
  },
  navItemActive: {
    background: "#27272a",
    color: "#f4f4f5",
  },
  navIcon: { fontSize: 14, width: 16, textAlign: "center" },
  sidebarFooter: {
    padding: "16px 16px 0",
    borderTop: "1px solid #27272a",
    marginTop: 16,
  },
  adminInfo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  adminAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#6366f1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    flexShrink: 0,
  },
  adminName: { fontSize: 13, fontWeight: 600, color: "#f4f4f5" },
  adminEmail: { fontSize: 11, color: "#71717a", marginTop: 1 },
  signOutBtn: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #27272a",
    background: "transparent",
    color: "#a1a1aa",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "center",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "28px 32px 20px",
    borderBottom: "1px solid #27272a",
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: "#f4f4f5",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    fontSize: 12,
    color: "#71717a",
    margin: "4px 0 0",
  },
  roleBadge: {
    padding: "4px 12px",
    borderRadius: 999,
    background: "#312e81",
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.03em",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    padding: "24px 32px",
  },
  statCard: {
    background: "#18181b",
    border: "1px solid #27272a",
    borderRadius: 12,
    padding: "20px 24px",
    position: "relative",
    overflow: "hidden",
  },
  statAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: "12px 12px 0 0",
  },
  statValue: {
    fontSize: 32,
    fontWeight: 700,
    color: "#f4f4f5",
    letterSpacing: "-0.03em",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: "#71717a",
    marginTop: 4,
  },
  tableCard: {
    margin: "0 32px 24px",
    background: "#18181b",
    border: "1px solid #27272a",
    borderRadius: 12,
    overflow: "hidden",
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #27272a",
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#f4f4f5",
    margin: 0,
  },
  tableCount: { fontSize: 12, color: "#71717a" },
  tableWrap: { overflowX: "auto" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    padding: "10px 16px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 600,
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    background: "#18181b",
    borderBottom: "1px solid #27272a",
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid #27272a" },
  td: { padding: "12px 16px", verticalAlign: "middle" },
  userCell: { display: "flex", alignItems: "center", gap: 10 },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#27272a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    color: "#a1a1aa",
    flexShrink: 0,
  },
  userName: { fontWeight: 500, color: "#e4e4e7" },
  emailCell: { color: "#a1a1aa" },
  numCell: { textAlign: "center", color: "#a1a1aa" },
  dateCell: { color: "#71717a", whiteSpace: "nowrap" },
  badge: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
  },
  badgeAdmin: { background: "#312e81", color: "#a5b4fc" },
  badgeUser:  { background: "#27272a", color: "#a1a1aa" },
  promoteBtn: {
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid #3f3f46",
    background: "transparent",
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  },
  demoteBtn: { color: "#f87171", borderColor: "#3f3f46" },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
    padding: "24px 32px",
  },
  settingsCard: {
    background: "#18181b",
    border: "1px solid #27272a",
    borderRadius: 12,
    padding: "20px 24px",
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#f4f4f5",
    margin: "0 0 16px",
  },
  settingsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #27272a",
  },
  settingsKey: { fontSize: 13, color: "#71717a" },
  settingsValue: { fontSize: 13, fontWeight: 500, color: "#e4e4e7" },
  settingsNote: {
    fontSize: 12,
    color: "#52525b",
    marginTop: 14,
    lineHeight: 1.6,
  },
};