"use client";
// app/events-manager/_components/ui.js

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ─── NAV CONFIG ───────────────────────────────────────────────────────────────
const NAV = [
  { href: "/events-manager/overview",             label: "Overview",            icon: "▦" },
  { href: "/events-manager/datasources",          label: "Data Sources",        icon: "◈" },
  { href: "/events-manager/pixel",                label: "Pixel Setup",         icon: "◉" },
  { href: "/events-manager/conversions-api",      label: "Conversions API",     icon: "⟳" },
  { href: "/events-manager/datasets",             label: "Datasets",            icon: "≡" },
  { href: "/events-manager/custom-events",        label: "Custom Events",       icon: "✦" },
  { href: "/events-manager/custom-conversions",   label: "Custom Conversions",  icon: "⊕" },
  { href: "/events-manager/offline-events",       label: "Offline Events",      icon: "↑" },
  { href: "/events-manager/test-events",          label: "Test Events",         icon: "▷" },
  { href: "/events-manager/diagnostics",          label: "Diagnostics",         icon: "◬" },
  { href: "/events-manager/domain-verification",  label: "Domain Verification", icon: "⬡" },
  { href: "/events-manager/partner-integrations", label: "Integrations",        icon: "⊞" },
  { href: "/events-manager/event-match-quality",  label: "Match Quality",       icon: "◎" },
  { href: "/events-manager/deduplication",        label: "Deduplication",       icon: "⇄" },
  { href: "/events-manager/privacy",              label: "Privacy",             icon: "⊛" },
  { href: "/events-manager/standard-events",      label: "Standard Events",     icon: "☰" },
];

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside style={{
      width: 224, minHeight: "100vh", background: "var(--bg-surface)",
      borderRight: "1px solid var(--border)", position: "fixed",
      top: 0, left: 0, zIndex: 50, display: "flex", flexDirection: "column",
      overflowY: "auto",
    }}>
      {/* Brand */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg, #1877f2 0%, #0a52c4 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--mono)", fontWeight: 700, fontSize: 15, color: "#fff",
            flexShrink: 0,
          }}>M</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
              Events Manager
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Meta Ads v22.0</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "8px 8px", flex: 1 }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "7px 9px", borderRadius: 8, marginBottom: 1,
              textDecoration: "none", fontSize: 12.5, fontWeight: active ? 600 : 400,
              color: active ? "#5b9cf6" : "var(--text-secondary)",
              background: active ? "var(--accent-dim)" : "transparent",
              borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
              transition: "all 0.12s",
            }}>
              <span style={{ fontSize: 13, width: 16, textAlign: "center", flexShrink: 0 }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>CAPI v2 · Graph API v22</div>
      </div>
    </aside>
  );
}

// ─── PAGE SHELL ───────────────────────────────────────────────────────────────
export function PageShell({ title, subtitle, actions, children }) {
  return (
    <div style={{ marginLeft: 224, minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Topbar */}
      <div style={{
        padding: "16px 28px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)", position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.4px" }}>
            {title}
          </h1>
          {subtitle && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>}
      </div>
      <div style={{ padding: "24px 28px" }}>{children}</div>
    </div>
  );
}

// ─── CARD ────────────────────────────────────────────────────────────────────
export function Card({ children, style = {}, className = "" }) {
  return (
    <div className={className} style={{
      background: "var(--bg-elevated)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: "18px 20px", ...style,
    }}>{children}</div>
  );
}

// ─── GRID ────────────────────────────────────────────────────────────────────
export function Grid({ cols = 3, gap = 14, children, style = {} }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, ...style }}>
      {children}
    </div>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
export function Stat({ label, value, sub, accent = "var(--accent-light)" }) {
  return (
    <Card>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, letterSpacing: "-1px", lineHeight: 1 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>{sub}</div>}
    </Card>
  );
}

// ─── BADGE ───────────────────────────────────────────────────────────────────
const BADGE = {
  active:    ["#0a2a18", "#10b981", "#0e3d24"],
  inactive:  ["#181825", "#44445a", "#252535"],
  pending:   ["#2a1e08", "#f59e0b", "#3d2c0a"],
  verified:  ["#0a2a18", "#10b981", "#0e3d24"],
  failed:    ["#2a0e0e", "#ef4444", "#3d1414"],
  critical:  ["#2a0e0e", "#ef4444", "#3d1414"],
  warning:   ["#2a1e08", "#f59e0b", "#3d2c0a"],
  info:      ["#0a1a2a", "#3b82f6", "#0e2640"],
  sent:      ["#0a2a18", "#10b981", "#0e3d24"],
  open:      ["#2a1e08", "#f59e0b", "#3d2c0a"],
  resolved:  ["#0a2a18", "#10b981", "#0e3d24"],
  completed: ["#0a2a18", "#10b981", "#0e3d24"],
  excellent: ["#0a2a18", "#10b981", "#0e3d24"],
  good:      ["#0a2a18", "#10b981", "#0e3d24"],
  fair:      ["#2a1e08", "#f59e0b", "#3d2c0a"],
  poor:      ["#2a0e0e", "#ef4444", "#3d1414"],
  healthy:   ["#0a2a18", "#10b981", "#0e3d24"],
};

export function Badge({ status, label }) {
  const [bg, color, border] = BADGE[status?.toLowerCase()] || BADGE.inactive;
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)",
      padding: "2px 8px", borderRadius: 20, letterSpacing: "0.5px", textTransform: "uppercase",
      background: bg, color, border: `1px solid ${border}`,
    }}>{label || status}</span>
  );
}

// ─── BUTTON ──────────────────────────────────────────────────────────────────
const BTN_STYLES = {
  primary:  { background: "#1877f2", color: "#fff", border: "none" },
  secondary:{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-light)" },
  danger:   { background: "var(--red-dim)", color: "var(--red)", border: "1px solid #3d1414" },
  ghost:    { background: "transparent", color: "var(--accent-light)", border: "1px solid var(--accent-dim)" },
  success:  { background: "var(--green-dim)", color: "var(--green)", border: "1px solid #0e3d24" },
};
const BTN_SIZE = {
  sm: { padding: "4px 12px", fontSize: 11.5 },
  md: { padding: "8px 16px", fontSize: 13 },
  lg: { padding: "10px 22px", fontSize: 14 },
};

export function Btn({ children, onClick, variant = "primary", size = "md", disabled, loading, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      borderRadius: "var(--radius)", fontWeight: 600, fontFamily: "var(--sans)",
      cursor: (disabled || loading) ? "not-allowed" : "pointer",
      opacity: (disabled || loading) ? 0.55 : 1, transition: "opacity 0.15s, transform 0.1s",
      display: "inline-flex", alignItems: "center", gap: 6,
      ...BTN_STYLES[variant], ...BTN_SIZE[size], ...style,
    }}>
      {loading ? "..." : children}
    </button>
  );
}

// ─── INPUT ───────────────────────────────────────────────────────────────────
export function Input({ label, value, onChange, placeholder, type = "text", style = {}, note }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 5, fontWeight: 600 }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
        width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-light)",
        borderRadius: "var(--radius)", padding: "8px 12px", color: "var(--text-primary)", fontSize: 13,
        outline: "none", boxSizing: "border-box", fontFamily: "var(--sans)", ...style,
      }} />
      {note && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{note}</div>}
    </div>
  );
}

// ─── TEXTAREA ────────────────────────────────────────────────────────────────
export function Textarea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 5, fontWeight: 600 }}>{label}</label>}
      <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{
        width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-light)",
        borderRadius: "var(--radius)", padding: "8px 12px", color: "var(--text-primary)", fontSize: 13,
        outline: "none", boxSizing: "border-box", fontFamily: "var(--sans)", resize: "vertical",
      }} />
    </div>
  );
}

// ─── SELECT ──────────────────────────────────────────────────────────────────
export function Select({ label, value, onChange, options = [], style = {} }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 5, fontWeight: 600 }}>{label}</label>}
      <select value={value} onChange={onChange} style={{
        width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-light)",
        borderRadius: "var(--radius)", padding: "8px 12px", color: "var(--text-primary)", fontSize: 13,
        outline: "none", boxSizing: "border-box", fontFamily: "var(--sans)", ...style,
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── TOGGLE ──────────────────────────────────────────────────────────────────
export function Toggle({ label, value, onChange, desc }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ paddingRight: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>}
      </div>
      <div onClick={() => onChange(!value)} style={{
        width: 38, height: 21, borderRadius: 11, flexShrink: 0, cursor: "pointer",
        background: value ? "var(--accent)" : "var(--border-light)", position: "relative", transition: "background 0.18s",
      }}>
        <div style={{
          position: "absolute", top: 3, left: value ? 19 : 3, width: 15, height: 15,
          borderRadius: "50%", background: "#fff", transition: "left 0.18s",
        }} />
      </div>
    </div>
  );
}

// ─── CODE BLOCK ──────────────────────────────────────────────────────────────
export function Code({ children, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(String(children));
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5, fontWeight: 600 }}>{label}</div>}
      <div style={{ position: "relative" }}>
        <pre style={{
          margin: 0, background: "#03030a", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "14px 14px", fontSize: 12,
          color: "#88c4ff", overflowX: "auto", lineHeight: 1.65, fontFamily: "var(--mono)",
          whiteSpace: "pre-wrap", wordBreak: "break-all",
        }}>{children}</pre>
        <button onClick={copy} style={{
          position: "absolute", top: 8, right: 8, fontSize: 10.5, fontWeight: 700,
          fontFamily: "var(--sans)", padding: "3px 9px", borderRadius: 6, cursor: "pointer",
          background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
          color: copied ? "var(--green)" : "var(--text-muted)",
        }}>{copied ? "✓ Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

// ─── TABLE ───────────────────────────────────────────────────────────────────
export function Table({ columns, rows, empty = "No records found" }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {columns.map(c => (
              <th key={c.key} style={{
                textAlign: "left", padding: "8px 12px", color: "var(--text-muted)",
                fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                fontFamily: "var(--mono)",
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={columns.length} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)", fontSize: 13 }}>{empty}</td></tr>
            : rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                {columns.map(c => (
                  <td key={c.key} style={{ padding: "10px 12px", color: "var(--text-secondary)", verticalAlign: "middle" }}>
                    {c.render ? c.render(row) : row[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 500 }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#00000090", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)", width: "100%", maxWidth: width,
        maxHeight: "88vh", overflowY: "auto", padding: "22px 24px",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── TABS ────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 22, gap: 0 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding: "9px 16px", fontSize: 13, fontWeight: active === t.key ? 700 : 400,
          color: active === t.key ? "var(--accent-light)" : "var(--text-muted)",
          borderBottom: `2px solid ${active === t.key ? "var(--accent)" : "transparent"}`,
          background: "none", border: "none", borderBottom: `2px solid ${active === t.key ? "var(--accent)" : "transparent"}`,
          cursor: "pointer", marginBottom: -1, fontFamily: "var(--sans)", transition: "color 0.15s",
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ─── ALERT ───────────────────────────────────────────────────────────────────
const ALERT_STYLES = {
  info:    { bg: "#0a1a2a", border: "#0e2640", color: "#3b82f6" },
  success: { bg: "var(--green-dim)", border: "#0e3d24", color: "var(--green)" },
  warning: { bg: "var(--yellow-dim)", border: "#3d2c0a", color: "var(--yellow)" },
  error:   { bg: "var(--red-dim)", border: "#3d1414", color: "var(--red)" },
};

export function Alert({ type = "info", children }) {
  const s = ALERT_STYLES[type] || ALERT_STYLES.info;
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: "var(--radius)", padding: "11px 15px", color: s.color, fontSize: 13, marginBottom: 14 }}>
      {children}
    </div>
  );
}

// ─── LOADING ─────────────────────────────────────────────────────────────────
export function Loading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220, flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 24, color: "var(--text-muted)", animation: "spin 1.2s linear infinite" }}>◌</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading...</div>
    </div>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
export function Empty({ icon = "◌", title, desc, action }) {
  return (
    <div style={{ textAlign: "center", padding: "52px 24px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, marginBottom: 18 }}>{desc}</div>}
      {action}
    </div>
  );
}

// ─── SECTION LABEL ────────────────────────────────────────────────────────────
export function SLabel({ children }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 12, fontFamily: "var(--mono)" }}>
      {children}
    </div>
  );
}

// ─── ROW ─────────────────────────────────────────────────────────────────────
export function Row({ children, gap = 12, style = {} }) {
  return <div style={{ display: "flex", alignItems: "center", gap, ...style }}>{children}</div>;
}

// ─── PIXEL SELECTOR ──────────────────────────────────────────────────────────
export function PixelPicker({ pixels = [], value, onChange }) {
  return (
    <Select
      label="Active Pixel"
      value={value}
      onChange={e => onChange(e.target.value)}
      options={[
        { value: "", label: "— Select a pixel —" },
        ...pixels.map(p => ({ value: p.id, label: `${p.name} · ${p.metaPixelId}` })),
      ]}
    />
  );
}