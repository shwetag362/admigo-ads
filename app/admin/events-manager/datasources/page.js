
"use client";
// app/dashboard/events-manager/datasources/page.js
import { useState, useEffect, useRef } from "react";
import EventsManagerShell from "../components/EventsManagerShell";

// ─── Safe error string extractor ─────────────────────────────────────────────
function extractErrorMessage(e, fallback = "An unexpected error occurred.") {
  if (!e) return fallback;
  if (typeof e === "string") return e || fallback;
  if (typeof e === "object") {
    const msg =
      e?.message ||
      e?.error?.message ||
      (typeof e?.error === "string" ? e.error : null) ||
      e?.detail;
    if (msg && typeof msg === "string") return msg;
    try { return JSON.stringify(e); } catch { return fallback; }
  }
  return String(e) || fallback;
}

// ─── API helpers (all use ?adAccountId= query param) ─────────────────────────
const api = {
  async datasources(adAccountId) {
    try {
      const res  = await fetch(`/api/events-manager/datasources?adAccountId=${adAccountId}`);
      const json = await res.json();
      if (!res.ok) return { data: null, error: json?.error?.message || json?.error || `HTTP ${res.status}` };
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: err.message || "Network error" };
    }
  },

  async createPixel(adAccountId, body) {
    try {
      const res  = await fetch(`/api/events-manager/datasources?adAccountId=${adAccountId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json?.error?.message || json?.error || `HTTP ${res.status}` };
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: err.message || "Network error" };
    }
  },

  async syncPixel(adAccountId, body) {
    try {
      const res  = await fetch(`/api/events-manager/datasources?adAccountId=${adAccountId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json?.error?.message || json?.error || `HTTP ${res.status}` };
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: err.message || "Network error" };
    }
  },
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  pageBg      : "#f0f2f5",
  white       : "#ffffff",
  border      : "#dddfe2",
  borderLight : "#f0f2f5",
  text1       : "#1c1e21",
  text2       : "#444950",
  text3       : "#65676b",
  text4       : "#8a8d91",
  blue        : "#1877f2",
  blueLight   : "#e7f3ff",
  blueBorder  : "#bcd4f5",
  green       : "#1e7e34",
  greenLight  : "#e6f4ea",
  greenBorder : "#b7dfbe",
  yellow      : "#e65100",
  yellowLight : "#fff8e1",
  yellowBorder: "#ffe0b2",
  red         : "#c5221f",
  redLight    : "#fce8e6",
  redBorder   : "#f5c6c5",
  purple      : "#6b4fbb",
  purpleLight : "#f0ebff",
  purpleBorder: "#d4c5f9",
  teal        : "#0084c7",
  tealLight   : "#e8f5fb",
  surface     : "#f7f8fa",
};

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes shimmer   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes fadeUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes dropIn    { from{opacity:0;transform:translateY(-4px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }

  *, *::before, *::after { box-sizing: border-box; }

  .ds-root { font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,sans-serif; }
  .ds-animate { animation: fadeUp .22s ease both; }
  .ds-spinning { animation: spin 1s linear infinite; }
  .ds-modal-anim { animation: slideDown .18s ease both; }
  .ds-drop-anim { animation: dropIn .14s ease both; }

  .ds-refresh:hover:not(:disabled) { background:#f7f8fa !important; }
  .ds-refresh:disabled { opacity:0.55; cursor:not-allowed !important; }

  .ds-btn-primary { display:inline-flex; align-items:center; gap:6px; background:#1877f2; border:none; color:#fff; border-radius:6px; padding:7px 13px; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .15s; white-space:nowrap; }
  .ds-btn-primary:hover:not(:disabled) { background:#145dbf; }
  .ds-btn-primary:disabled { opacity:0.55; cursor:not-allowed; }

  .ds-btn-secondary { display:inline-flex; align-items:center; gap:6px; background:#fff; border:1px solid #dddfe2; color:#444950; border-radius:6px; padding:7px 13px; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .15s; white-space:nowrap; }
  .ds-btn-secondary:hover:not(:disabled) { background:#f7f8fa; }
  .ds-btn-secondary:disabled { opacity:0.55; cursor:not-allowed; }

  .ds-btn-sm { padding:4px 10px !important; font-size:11.5px !important; border-radius:5px !important; }

  .ds-input { width:100%; border:1px solid #dddfe2; border-radius:6px; padding:8px 11px; font-size:13px; color:#1c1e21; outline:none; transition:border .15s, box-shadow .15s; background:#fff; }
  .ds-input:focus { border-color:#1877f2; box-shadow:0 0 0 3px rgba(24,119,242,0.12); }
  .ds-input::placeholder { color:#8a8d91; }

  .ds-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; }
  .ds-modal { background:#fff; border-radius:10px; width:100%; max-width:440px; box-shadow:0 8px 40px rgba(0,0,0,0.18); }

  .ds-acct-btn { display:inline-flex; align-items:center; gap:7px; background:#fff; border:1px solid #dddfe2; color:#1c1e21; border-radius:7px; padding:6px 11px; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .15s, border-color .15s; white-space:nowrap; max-width:220px; }
  .ds-acct-btn:hover { background:#f7f8fa; border-color:#bcd4f5; }
  .ds-acct-btn.open { border-color:#1877f2; background:#e7f3ff; color:#1877f2; box-shadow:0 0 0 3px rgba(24,119,242,0.10); }

  .ds-acct-drop { position:absolute; top:calc(100% + 6px); left:0; min-width:260px; max-width:340px; background:#fff; border:1px solid #dddfe2; border-radius:8px; box-shadow:0 6px 28px rgba(0,0,0,0.13); z-index:500; overflow:hidden; }
  .ds-acct-item { display:flex; align-items:center; gap:10px; padding:9px 13px; cursor:pointer; transition:background .1s; border-bottom:1px solid #f0f2f5; }
  .ds-acct-item:last-child { border-bottom:none; }
  .ds-acct-item:hover { background:#f7f8fa; }
  .ds-acct-item.selected { background:#e7f3ff; }

  .ds-grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px; }

  .ds-subheader { background:#fff; border-bottom:1px solid #dddfe2; padding:8px 24px; display:flex; align-items:center; justify-content:space-between; min-height:52px; flex-wrap:wrap; gap:8px; }
  .ds-subheader-left  { display:flex; flex-direction:column; justify-content:center; padding:8px 0; }
  .ds-subheader-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }

  .ds-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .ds-table-wrap table { min-width:600px; }

  .ds-section-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 18px; border-bottom:1px solid #f0f2f5; flex-wrap:wrap; gap:8px; }

  .ds-body { padding:18px 0px; max-width:1280px; margin:0 auto; }
  .ds-tr:hover td { background:#f7f8fa; }

  @media (max-width:960px)  { .ds-grid4 { grid-template-columns:repeat(2,1fr); } }
  @media (max-width:680px)  { .ds-grid4 { grid-template-columns:repeat(2,1fr); gap:10px; } .ds-body { padding:14px 2px; } .ds-subheader { padding:0 16px; } }
  @media (max-width:480px)  { .ds-grid4 { grid-template-columns:1fr; gap:8px; margin-bottom:8px; } .ds-body { padding:2px; } .ds-subheader { padding:8px 12px; } .ds-refresh-label { display:none; } .ds-subheader-right { width:100%; justify-content:flex-end; } .ds-stat-value { font-size:22px !important; } .ds-acct-btn { max-width:140px; } }
  @media (max-width:360px)  { .ds-grid4 { grid-template-columns:1fr; } .ds-body { padding:2px; } }
`;

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const skBase = {
  borderRadius: 5,
  background: "linear-gradient(90deg,#e4e6eb 25%,#f0f2f5 50%,#e4e6eb 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s infinite",
};
function Skel({ w = "100%", h = 14, mb = 0 }) {
  return <div style={{ ...skBase, width: w, height: h, marginBottom: mb }} />;
}
function SkeletonCard() {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 16px 14px" }}>
      <Skel w="55%" h={10} mb={10} />
      <Skel w="65%" h={24} mb={8} />
      <Skel w="40%" h={9} />
    </div>
  );
}
function LoadingSkeleton() {
  return (
    <div className="ds-root" style={{ background: C.pageBg, minHeight: "calc(100vh - 64px)" }}>
      <div className="ds-subheader" style={{ padding: "13px 24px" }}>
        <div><Skel w={160} h={15} mb={6} /><Skel w={220} h={10} /></div>
        <div style={{ display: "flex", gap: 8 }}>
          <Skel w={180} h={32} /><Skel w={100} h={32} /><Skel w={80} h={32} />
        </div>
      </div>
      <div className="ds-body">
        <div className="ds-grid4">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, height: 220, marginBottom: 14 }} />
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, height: 140 }} />
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function badgeStyle(type) {
  const map = {
    active  : { bg: C.greenLight,  color: C.green,  border: C.greenBorder  },
    inactive: { bg: C.pageBg,      color: C.text3,  border: C.border       },
    warning : { bg: C.yellowLight, color: C.yellow, border: C.yellowBorder },
    info    : { bg: "#e8f0fe",     color: "#1a73e8", border: "#c5d8fd"     },
    purple  : { bg: C.purpleLight, color: C.purple, border: C.purpleBorder },
    teal    : { bg: C.tealLight,   color: C.teal,   border: "#b3dff5"      },
  };
  const t = map[type] || map.inactive;
  return { display:"inline-flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:4, fontSize:11, fontWeight:700, letterSpacing:"0.15px", background:t.bg, color:t.color, border:`1px solid ${t.border}`, whiteSpace:"nowrap", lineHeight:1.6 };
}
function Dot({ color }) {
  return <span style={{ display:"inline-block", width:5, height:5, borderRadius:"50%", background:color, flexShrink:0 }} />;
}
function getInitials(name = "") {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "?";
}

const TH_S = { padding:"9px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.text3, textTransform:"uppercase", letterSpacing:"0.5px", background:C.surface, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" };
const TD_S = { padding:"11px 14px", fontSize:13, color:C.text1, borderBottom:`1px solid ${C.borderLight}`, verticalAlign:"middle" };

// ─── Account Dropdown ─────────────────────────────────────────────────────────
function AccountDropdown({ accounts, selectedId, onChange, accountsLoading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = accounts.find(a => a.id === selectedId);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (accountsLoading) return <div style={{ ...skBase, width: 180, height: 32, borderRadius: 7 }} />;

  if (!accounts.length) return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.redLight, border:`1px solid ${C.redBorder}`, borderRadius:7, padding:"6px 11px", fontSize:12, fontWeight:600, color:C.red }}>
      <span>⚠️</span> No accounts connected
    </div>
  );

  return (
    <div ref={ref} style={{ position:"relative", flexShrink:0 }}>
      <button className={`ds-acct-btn${open ? " open" : ""}`} onClick={() => setOpen(o => !o)} title={selected?.name}>
        <div style={{ width:20, height:20, borderRadius:4, flexShrink:0, background:open?"#1877f2":"#e4e6eb", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:open?"#fff":"#444950", transition:"background .15s,color .15s" }}>
          {getInitials(selected?.name)}
        </div>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, minWidth:0 }}>
          {selected?.name || "Select account"}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink:0, transform:open?"rotate(180deg)":"rotate(0deg)", transition:"transform .15s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="ds-acct-drop ds-drop-anim">
          <div style={{ padding:"8px 13px 6px", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:C.text4, textTransform:"uppercase", letterSpacing:"0.5px" }}>
              Ad Accounts ({accounts.length})
            </div>
          </div>
          <div style={{ maxHeight:280, overflowY:"auto" }}>
            {accounts.map(acc => (
              <div key={acc.id} className={`ds-acct-item${acc.id === selectedId ? " selected" : ""}`} onClick={() => { onChange(acc); setOpen(false); }}>
                <div style={{ width:30, height:30, borderRadius:6, flexShrink:0, background:acc.id===selectedId?"#1877f2":"#e4e6eb", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:acc.id===selectedId?"#fff":"#65676b" }}>
                  {getInitials(acc.name)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color:acc.id===selectedId?C.blue:C.text1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {acc.name}
                  </div>
                  <div style={{ fontSize:10.5, color:C.text4, fontFamily:"monospace", marginTop:1 }}>
                    {acc.metaAccountId}{acc.currency ? ` · ${acc.currency}` : ""}
                  </div>
                </div>
                {acc.id === selectedId && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1877f2" strokeWidth="2.5" style={{ flexShrink:0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = C.blue }) {
  return (
    <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"16px 16px 14px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:accent, borderRadius:"8px 8px 0 0" }} />
      <div style={{ fontSize:11, fontWeight:700, color:C.text3, textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:8 }}>{label}</div>
      <div className="ds-stat-value" style={{ fontSize:26, fontWeight:800, color:C.text1, lineHeight:1, letterSpacing:"-0.5px", marginBottom:6 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize:11.5, color:C.text4, lineHeight:1.5 }}>{sub}</div>}
    </div>
  );
}

// ─── SectionCard ─────────────────────────────────────────────────────────────
function SectionCard({ title, count, action, children }) {
  return (
    <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", marginBottom:14 }}>
      <div className="ds-section-hdr">
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{title}</span>
          {count != null && (
            <span style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"1px 7px", fontSize:11, fontWeight:700, color:C.text2 }}>{count}</span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function TableEmpty({ icon, title, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"32px 20px" }}>
      <div style={{ fontSize:28, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:12, color:C.text4 }}>{sub}</div>
    </div>
  );
}

function EMQScore({ score }) {
  if (score == null) return <span style={{ color:C.text4, fontSize:12 }}>—</span>;
  const color = score >= 7 ? C.green : score >= 5 ? C.yellow : C.red;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
      <div style={{ width:44, height:4, background:"#e4e6eb", borderRadius:3, overflow:"hidden", flexShrink:0 }}>
        <div style={{ width:`${(score/10)*100}%`, height:"100%", background:color, borderRadius:3 }} />
      </div>
      <span style={{ fontFamily:"monospace", fontSize:11.5, fontWeight:700, color, whiteSpace:"nowrap" }}>{score.toFixed(1)}/10</span>
    </div>
  );
}

function SourceChips({ types = [] }) {
  if (!types.length) return <span style={{ color:C.text4, fontSize:12 }}>—</span>;
  const colorMap = { web:"info", app:"purple", server:"teal", offline:"warning" };
  return (
    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
      {types.map(s => <span key={s} style={badgeStyle(colorMap[s]||"info")}>{s}</span>)}
    </div>
  );
}

// ─── Create Pixel Modal ───────────────────────────────────────────────────────
function CreatePixelModal({ open, onClose, onSubmit, saving }) {
  const [name, setName] = useState("");
  if (!open) return null;
  function handleSubmit() { if (name.trim()) onSubmit(name.trim()); }
  return (
    <div className="ds-overlay" onClick={onClose}>
      <div className="ds-modal ds-modal-anim" onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:`1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:C.text1 }}>Create New Pixel</div>
            <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>A new Meta pixel will be created and linked to your account.</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.text3, fontSize:20, lineHeight:1, padding:4 }}>×</button>
        </div>
        <div style={{ padding:"18px 20px" }}>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text2, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.4px" }}>Pixel Name</label>
          <input className="ds-input" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSubmit()} placeholder="e.g. Main Website Pixel" autoFocus />
          <div style={{ fontSize:11.5, color:C.text4, marginTop:6 }}>Choose a descriptive name — you can rename it later in pixel settings.</div>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", padding:"12px 20px", borderTop:`1px solid ${C.border}`, background:C.surface }}>
          <button className="ds-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="ds-btn-primary" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ds-spinning"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Creating…</>
            ) : "Create Pixel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onDismiss }) {
  if (!msg) return null;
  const isErr = msg.type === "error";
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:2000, background:isErr?C.redLight:C.greenLight, border:`1px solid ${isErr?C.redBorder:C.greenBorder}`, borderRadius:8, padding:"11px 16px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 4px 20px rgba(0,0,0,0.1)", fontSize:13, fontWeight:600, color:isErr?C.red:C.green, animation:"fadeUp .2s ease both", maxWidth:340 }}>
      <span style={{ fontSize:16 }}>{isErr?"❌":"✅"}</span>
      <span style={{ flex:1 }}>{msg.text}</span>
      <button onClick={onDismiss} style={{ background:"none", border:"none", cursor:"pointer", color:"inherit", fontSize:16, opacity:0.7, padding:0 }}>×</button>
    </div>
  );
}

// ─── No Accounts screen ───────────────────────────────────────────────────────
function NoAccountsScreen() {
  return (
    <div className="ds-root" style={{ background:C.pageBg, minHeight:"calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>
      <div className="ds-body" style={{ paddingTop:48, display:"flex", justifyContent:"center" }}>
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"44px 36px", textAlign:"center", maxWidth:460, width:"100%" }}>
          <div style={{ fontSize:52, marginBottom:18 }}>📡</div>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:10 }}>No Ad Accounts Connected</div>
          <div style={{ fontSize:13.5, color:C.text3, lineHeight:1.65, marginBottom:28 }}>
            You don't have any Meta ad accounts linked yet. Connect a Facebook account to start managing pixels and data sources.
          </div>
          <a href="/dashboard/settings" style={{ display:"inline-flex", alignItems:"center", gap:7, background:C.blue, color:"#fff", borderRadius:7, padding:"10px 20px", fontSize:13.5, fontWeight:700, textDecoration:"none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Connect Facebook Account
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DatasourcesPage() {
  const [allAccounts,     setAllAccounts    ] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError,   setAccountsError  ] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const [data,        setData       ] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError,   setDataError  ] = useState(null);

  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving,     setSaving    ] = useState(false);
  const [syncing,    setSyncing   ] = useState(null);
  const [msg,        setMsg       ] = useState(null);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  // ── STEP 1: Load all ad accounts on mount ────────────────────────────────────
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res  = await fetch("/api/meta-accounts");
        const json = await res.json();

        if (res.status === 401) throw new Error("Not authenticated — please log in again.");
        if (!res.ok) throw new Error(extractErrorMessage(json.error || json, "Failed to load accounts"));

        const accounts = json.accounts || [];
        setAllAccounts(accounts);

        if (accounts.length > 0) {
          setSelectedAccount(accounts[0]);
        }
      } catch (err) {
        setAccountsError(extractErrorMessage(err));
      } finally {
        setAccountsLoading(false);
      }
    }
    loadAccounts();
  }, []);

  // ── STEP 2: Fetch datasources when selected account changes ──────────────────
  useEffect(() => {
    if (!selectedAccount?.id) return;
    fetchDatasources(selectedAccount.id, false);
  }, [selectedAccount?.id]);

  // ── Core fetch function — sends adAccountId as ?adAccountId= query param ─────
  async function fetchDatasources(adAccountId, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else           setDataLoading(true);
    setDataError(null);

    const { data: d, error: e } = await api.datasources(adAccountId);

    if (e) {
      setDataError(extractErrorMessage(e));
      setDataLoading(false);
      setRefreshing(false);
      return;
    }

    setData(d);
    setDataLoading(false);
    setRefreshing(false);
  }

  // ── Account switch ────────────────────────────────────────────────────────────
  function handleAccountChange(acc) {
    if (acc.id === selectedAccount?.id) return;
    setData(null);
    setDataError(null);
    setSelectedAccount(acc);
    // useEffect will fire fetchDatasources via selectedAccount?.id dependency
  }

  // ── Create pixel — POST ?adAccountId=<id> ────────────────────────────────────
  async function handleCreatePixel(name) {
    if (!selectedAccount?.id) return;
    setSaving(true);
    const { error: e } = await api.createPixel(selectedAccount.id, { name });
    setSaving(false);
    if (e) { setMsg({ type: "error", text: extractErrorMessage(e) }); return; }
    setMsg({ type: "success", text: `Pixel "${name}" created successfully!` });
    setShowCreate(false);
    fetchDatasources(selectedAccount.id, true);
  }

  // ── Sync pixel — PUT ?adAccountId=<id> ───────────────────────────────────────
  async function handleSync(pixel) {
    if (!selectedAccount?.id) return;
    setSyncing(pixel.id);
    const { error: e } = await api.syncPixel(selectedAccount.id, { meta_pixel_id: pixel.id, name: pixel.name });
    setSyncing(null);
    if (e) { setMsg({ type: "error", text: `Sync failed: ${extractErrorMessage(e)}` }); return; }
    setMsg({ type: "success", text: `"${pixel.name}" synced successfully!` });
    fetchDatasources(selectedAccount.id, true);
  }

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (accountsLoading) return <><style>{GLOBAL_CSS}</style><LoadingSkeleton /></>;

  if (accountsError) return (
    <div className="ds-root" style={{ background: C.pageBg, minHeight: "calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>
      <div className="ds-body" style={{ paddingTop: 24 }}>
        <div style={{ background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "16px 20px", display: "flex", gap: 12 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 4 }}>Failed to load accounts</div>
            <div style={{ fontSize: 13, color: C.red, opacity: 0.85 }}>{accountsError}</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!allAccounts.length) return <NoAccountsScreen />;

  const pixels         = data?.pixels              || [];
  const unsyncedPixels = data?.unsynced_meta_pixels || [];
  const totalPixels    = data?.total    ?? pixels.length;
  const activePixels   = pixels.filter(p => p.status === "active").length;
  const capiPixels     = pixels.filter(p => p.capiConfig?.status === "active").length;
  const totalEvents    = pixels.reduce((sum, p) => sum + (p.totalEventsReceived || 0), 0);

  return (
    <div className="ds-root" style={{ background: C.pageBg, minHeight: "calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Sub-header ──────────────────────────────────────────────────────── */}
      <div className="ds-subheader">
        <div className="ds-subheader-left">
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text1, letterSpacing: "-0.2px" }}>Data Sources</div>
          {selectedAccount && (
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              {selectedAccount.currency && <span>{selectedAccount.currency}</span>}
              {selectedAccount.timezone && <><span style={{ color: C.border }}>·</span><span>{selectedAccount.timezone}</span></>}
              {selectedAccount.metaAccountId && <><span style={{ color: C.border }}>·</span><span style={{ fontFamily: "monospace" }}>{selectedAccount.metaAccountId}</span></>}
            </div>
          )}
        </div>

        <div className="ds-subheader-right">
          <AccountDropdown
            accounts={allAccounts}
            selectedId={selectedAccount?.id}
            onChange={handleAccountChange}
            accountsLoading={accountsLoading}
          />
          <button
            className="ds-btn-primary"
            onClick={() => setShowCreate(true)}
            disabled={!selectedAccount || dataLoading}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            New Pixel
          </button>
          <button
            className="ds-refresh ds-btn-secondary"
            disabled={refreshing || dataLoading || !selectedAccount}
            onClick={() => fetchDatasources(selectedAccount.id, true)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={refreshing ? "ds-spinning" : ""}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            <span className="ds-refresh-label">{refreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <EventsManagerShell>
        <div className="ds-body ds-animate">

          {/* Non-fatal data error banner */}
          {dataError && (
            <div style={{ background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 2 }}>Failed to load pixel data</div>
                <div style={{ fontSize: 12, color: C.red, opacity: 0.85 }}>{dataError}</div>
              </div>
              <button className="ds-btn-secondary ds-btn-sm" style={{ flexShrink: 0 }} onClick={() => fetchDatasources(selectedAccount.id, true)}>
                Retry
              </button>
            </div>
          )}

          {/* Stat cards */}
          <div className="ds-grid4">
            {dataLoading
              ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
              : <>
                  <StatCard label="Total Pixels"    value={totalPixels}                  sub="Connected to this account"                               accent={C.blue}   />
                  <StatCard label="Active Pixels"   value={activePixels}                 sub={`${totalPixels - activePixels} inactive`}                 accent="#42b72a"  />
                  <StatCard label="CAPI Configured" value={capiPixels}                   sub={`of ${totalPixels} pixel${totalPixels !== 1 ? "s" : ""}`} accent={C.purple} />
                  <StatCard label="Total Events"    value={totalEvents.toLocaleString()} sub="Across all pixels, all time"                              accent={C.teal}   />
                </>
            }
          </div>

          {/* Connected Pixels table */}
          <SectionCard
            title="Connected Pixels"
            count={dataLoading ? null : totalPixels}
            action={
              <button className="ds-btn-primary ds-btn-sm" onClick={() => setShowCreate(true)} disabled={!selectedAccount || dataLoading}>
                + New Pixel
              </button>
            }
          >
            {dataLoading ? (
              <div style={{ padding: "20px 18px" }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center" }}>
                    <Skel w="18%" h={13} /><Skel w="14%" h={13} /><Skel w="10%" h={13} />
                    <Skel w="16%" h={13} /><Skel w="10%" h={13} /><Skel w="10%" h={13} /><Skel w="14%" h={13} />
                  </div>
                ))}
              </div>
            ) : pixels.length === 0 ? (
              <TableEmpty
                icon="🔲"
                title="No pixels found"
                sub={dataError ? "Could not load pixel data. Try refreshing." : "Create your first pixel to start tracking events."}
              />
            ) : (
              <div className="ds-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>{["Pixel Name","Pixel ID","Status","Sources","CAPI","Events","Match Quality"].map(h => <th key={h} style={TH_S}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {pixels.map((p, i) => (
                      <tr key={p.id || i} className="ds-tr" style={{ background: C.white }}>
                        <td style={TD_S}>
                          <div style={{ fontWeight: 600, color: C.text1, fontSize: 13 }}>{p.name}</div>
                          {p.privacySettings?.gdprMode && <div style={{ fontSize: 10, color: C.text4, marginTop: 2 }}>🔒 GDPR mode</div>}
                        </td>
                        <td style={TD_S}>
                          <span style={{ fontFamily:"monospace", fontSize:11, background:C.surface, padding:"2px 6px", borderRadius:4, color:C.text2, border:`1px solid ${C.border}`, display:"inline-block", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {p.metaPixelId || "—"}
                          </span>
                        </td>
                        <td style={TD_S}>
                          {p.status === "active"
                            ? <span style={badgeStyle("active")}><Dot color={C.green} />Active</span>
                            : <span style={badgeStyle("inactive")}>{p.status || "Unknown"}</span>}
                        </td>
                        <td style={TD_S}><SourceChips types={p.source_types} /></td>
                        <td style={TD_S}>
                          {p.capiConfig?.status === "active"
                            ? <span style={badgeStyle("active")}><Dot color={C.green} />Active</span>
                            : <span style={badgeStyle("inactive")}>Off</span>}
                        </td>
                        <td style={{ ...TD_S, fontWeight: 600 }}>{p.totalEventsReceived?.toLocaleString() ?? "0"}</td>
                        <td style={TD_S}><EMQScore score={p.eventMatchQualityScore} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Unsynced pixels */}
          {!dataLoading && unsyncedPixels.length > 0 && (
            <SectionCard
              title="Pixels on Meta — Not Yet Synced"
              count={unsyncedPixels.length}
              action={<span style={{ fontSize: 11.5, color: C.text4 }}>Found in your Meta account but not imported locally.</span>}
            >
              <div style={{ background: C.yellowLight, borderBottom: `1px solid ${C.yellowBorder}`, padding: "9px 18px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.yellow, fontWeight: 600 }}>
                <span>⚠️</span><span>Sync these pixels to track their events and manage them in your dashboard.</span>
              </div>
              <div className="ds-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>{["Meta Pixel ID","Name","Action"].map(h => <th key={h} style={TH_S}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {unsyncedPixels.map((p, i) => (
                      <tr key={p.id || i} className="ds-tr" style={{ background: C.white }}>
                        <td style={TD_S}>
                          <span style={{ fontFamily:"monospace", fontSize:11, background:C.surface, padding:"2px 6px", borderRadius:4, color:C.text2, border:`1px solid ${C.border}`, display:"inline-block" }}>{p.id}</span>
                        </td>
                        <td style={{ ...TD_S, fontWeight: 600 }}>{p.name}</td>
                        <td style={TD_S}>
                          <button className="ds-btn-secondary ds-btn-sm" disabled={syncing === p.id} onClick={() => handleSync(p)}>
                            {syncing === p.id ? (
                              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ds-spinning"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>Syncing…</>
                            ) : (
                              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>Sync</>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", padding: "12px 0 4px", color: C.text4, fontSize: 11.5 }}>
            Showing pixels for <strong style={{ color: C.text3 }}>{selectedAccount?.name}</strong>
            <span style={{ margin: "0 6px", color: C.border }}>·</span>
            Last updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {allAccounts.length > 1 && <><span style={{ margin: "0 6px", color: C.border }}>·</span>{allAccounts.length} accounts available</>}
          </div>

        </div>
      </EventsManagerShell>

      <CreatePixelModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreatePixel} saving={saving} />
      <Toast msg={msg} onDismiss={() => setMsg(null)} />
    </div>
  );
}