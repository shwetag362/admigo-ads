"use client";
// app/dashboard/events-manager/overview/page.js
import { useState, useEffect, useRef } from "react";
import EventsManagerShell from "../components/EventsManagerShell";

// ─── Debug logger ─────────────────────────────────────────────────────────────
const log = {
  group  : (t)    => console.group(`%c${t}`, "color:#1877f2;font-weight:700;font-size:13px"),
  end    : ()     => console.groupEnd(),
  info   : (m, d) => d !== undefined ? console.log(`%c  ℹ  ${m}`, "color:#60a5fa", d) : console.log(`%c  ℹ  ${m}`, "color:#60a5fa"),
  ok     : (m, d) => d !== undefined ? console.log(`%c  ✅ ${m}`, "color:#34d399", d) : console.log(`%c  ✅ ${m}`, "color:#34d399"),
  warn   : (m, d) => d !== undefined ? console.warn(`%c  ⚠️  ${m}`, "color:#fbbf24", d) : console.warn(`%c  ⚠️  ${m}`, "color:#fbbf24"),
  error  : (m, d) => d !== undefined ? console.error(`%c  ❌ ${m}`, "color:#f87171", d) : console.error(`%c  ❌ ${m}`, "color:#f87171"),
  table  : (d)    => console.table(d),
};

// ─── Safe error string extractor ──────────────────────────────────────────────
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
  teal        : "#0084c7",
  tealLight   : "#e8f5fb",
  surface     : "#f7f8fa",
};

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes shimmer   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes fadeUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes dropIn    { from{opacity:0;transform:translateY(-4px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }

  *, *::before, *::after { box-sizing: border-box; }

  .ov-root { font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,sans-serif; }
  .ov-animate { animation: fadeUp .22s ease both; }
  .ov-spinning { animation: spin 1s linear infinite; }
  .ov-drop-anim { animation: dropIn .14s ease both; }

  .ov-link { background:none; border:none; color:#1877f2; font-size:12.5px; font-weight:600; cursor:pointer; padding:0; }
  .ov-link:hover { color:#145dbf; text-decoration:underline; }

  .ov-refresh:hover:not(:disabled) { background:#f7f8fa !important; }
  .ov-refresh:disabled { opacity:0.55; cursor:not-allowed !important; }

  /* ── Account dropdown ── */
  .ov-acct-btn { display:inline-flex; align-items:center; gap:7px; background:#fff; border:1px solid #dddfe2; color:#1c1e21; border-radius:7px; padding:6px 11px; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .15s, border-color .15s; white-space:nowrap; max-width:220px; }
  .ov-acct-btn:hover { background:#f7f8fa; border-color:#bcd4f5; }
  .ov-acct-btn.open { border-color:#1877f2; background:#e7f3ff; color:#1877f2; box-shadow:0 0 0 3px rgba(24,119,242,0.10); }
  .ov-acct-drop { position:absolute; top:calc(100% + 6px); left:0; min-width:260px; max-width:340px; background:#fff; border:1px solid #dddfe2; border-radius:8px; box-shadow:0 6px 28px rgba(0,0,0,0.13); z-index:500; overflow:hidden; }
  .ov-acct-item { display:flex; align-items:center; gap:10px; padding:9px 13px; cursor:pointer; transition:background .1s; border-bottom:1px solid #f0f2f5; }
  .ov-acct-item:last-child { border-bottom:none; }
  .ov-acct-item:hover { background:#f7f8fa; }
  .ov-acct-item.selected { background:#e7f3ff; }

  /* ── Grids ── */
  .ov-grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:12px; }
  .ov-grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:18px; }

  /* ── Sub-header ── */
  .ov-subheader { background:#fff; border-bottom:1px solid #dddfe2; padding:8px 24px; display:flex; align-items:center; justify-content:space-between; min-height:52px; flex-wrap:wrap; gap:8px; }
  .ov-subheader-left  { display:flex; flex-direction:column; justify-content:center; padding:8px 0; }
  .ov-subheader-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }

  /* ── Table ── */
  .ov-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .ov-table-wrap table { min-width:540px; }

  /* ── Section header ── */
  .ov-section-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 18px; border-bottom:1px solid #f0f2f5; flex-wrap:wrap; gap:8px; }

  /* ── Body ── */
  .ov-body { padding:18px 0px; max-width:1280px; margin:0 auto; }

  /* ── Responsive ── */
  @media (max-width: 960px) { .ov-grid4{grid-template-columns:repeat(2,1fr);} .ov-grid3{grid-template-columns:repeat(2,1fr);} }
  @media (max-width: 680px) { .ov-grid4{grid-template-columns:repeat(2,1fr);gap:10px;} .ov-grid3{grid-template-columns:repeat(2,1fr);gap:10px;} .ov-body{padding:14px 16px;} .ov-subheader{padding:0 16px;} .ov-account-pill{display:none !important;} }
  @media (max-width: 480px) { .ov-grid4{grid-template-columns:1fr;gap:8px;margin-bottom:8px;} .ov-grid3{grid-template-columns:1fr;gap:8px;} .ov-body{padding:12px;} .ov-subheader{padding:8px 12px;} .ov-stat-value{font-size:22px !important;} .ov-stat-label{font-size:10px !important;} .ov-stat-card{padding:14px 14px 12px !important;} .ov-section-hdr{padding:10px 14px;} .ov-refresh-label{display:none;} .ov-footer{font-size:11px !important;padding:10px 0 4px !important;} .ov-subheader-right{width:100%;justify-content:flex-end;} .ov-acct-btn{max-width:140px;} }
  @media (max-width: 360px) { .ov-grid4{grid-template-columns:1fr;} .ov-grid3{grid-template-columns:1fr;} .ov-body{padding:10px;} }
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
    <div className="ov-stat-card" style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 16px 14px" }}>
      <Skel w="55%" h={10} mb={10} />
      <Skel w="65%" h={24} mb={8} />
      <Skel w="40%" h={9} />
    </div>
  );
}
function LoadingSkeleton() {
  return (
    <div className="ov-root" style={{ background: C.pageBg, minHeight: "calc(100vh - 64px)" }}>
      <div className="ov-subheader" style={{ padding: "13px 24px" }}>
        <div><Skel w={150} h={15} mb={6} /><Skel w={200} h={10} /></div>
        <div style={{ display: "flex", gap: 8 }}>
          <Skel w={180} h={32} /><Skel w={90} h={32} />
        </div>
      </div>
      <div className="ov-body">
        <div className="ov-grid4">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
        <div className="ov-grid3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, height: 200, marginBottom: 14 }} />
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, height: 160 }} />
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
    error   : { bg: C.redLight,    color: C.red,    border: C.redBorder    },
    info    : { bg: "#e8f0fe",     color: "#1a73e8", border: "#c5d8fd"     },
    capi    : { bg: C.greenLight,  color: C.green,  border: C.greenBorder  },
    purple  : { bg: C.purpleLight, color: C.purple, border: "#d4c5f9"      },
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
      <button className={`ov-acct-btn${open ? " open" : ""}`} onClick={() => setOpen(o => !o)} title={selected?.name}>
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
        <div className="ov-acct-drop ov-drop-anim">
          <div style={{ padding:"8px 13px 6px", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:C.text4, textTransform:"uppercase", letterSpacing:"0.5px" }}>
              Ad Accounts ({accounts.length})
            </div>
          </div>
          <div style={{ maxHeight:280, overflowY:"auto" }}>
            {accounts.map(acc => (
              <div key={acc.id} className={`ov-acct-item${acc.id === selectedId ? " selected" : ""}`} onClick={() => { onChange(acc); setOpen(false); }}>
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
    <div className="ov-stat-card" style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"16px 16px 14px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:accent, borderRadius:"8px 8px 0 0" }} />
      <div className="ov-stat-label" style={{ fontSize:11, fontWeight:700, color:C.text3, textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:8 }}>
        {label}
      </div>
      <div className="ov-stat-value" style={{ fontSize:26, fontWeight:800, color:C.text1, lineHeight:1, letterSpacing:"-0.5px", marginBottom:6 }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize:11.5, color:C.text4, lineHeight:1.5 }}>{sub}</div>}
    </div>
  );
}

// ─── EMQ Score ────────────────────────────────────────────────────────────────
function EMQScore({ score }) {
  if (score == null) return <span style={{ color:C.text4, fontSize:12 }}>—</span>;
  const color = score >= 7 ? C.green : score >= 5 ? C.yellow : C.red;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
      <div style={{ width:44, height:4, background:"#e4e6eb", borderRadius:3, overflow:"hidden", flexShrink:0 }}>
        <div style={{ width:`${(score/10)*100}%`, height:"100%", background:color, borderRadius:3 }} />
      </div>
      <span style={{ fontFamily:"monospace", fontSize:11.5, fontWeight:700, color, whiteSpace:"nowrap" }}>
        {score.toFixed(1)}/10
      </span>
    </div>
  );
}

// ─── HoverRow ─────────────────────────────────────────────────────────────────
function HoverRow({ children }) {
  const [hov, setHov] = useState(false);
  return (
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background:hov ? C.surface : C.white, transition:"background .1s" }}>
      {children}
    </tr>
  );
}

// ─── TableEmpty ───────────────────────────────────────────────────────────────
function TableEmpty({ icon, title, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"32px 20px" }}>
      <div style={{ fontSize:28, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:12, color:C.text4 }}>{sub}</div>
    </div>
  );
}

// ─── SectionCard ─────────────────────────────────────────────────────────────
function SectionCard({ title, count, action, children }) {
  return (
    <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", marginBottom:14 }}>
      <div className="ov-section-hdr">
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{title}</span>
          {count != null && (
            <span style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"1px 7px", fontSize:11, fontWeight:700, color:C.text2 }}>
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── No Accounts screen ───────────────────────────────────────────────────────
function NoAccountsScreen() {
  return (
    <div className="ov-root" style={{ background:C.pageBg, minHeight:"calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>
      <div className="ov-body" style={{ paddingTop:48, display:"flex", justifyContent:"center" }}>
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"44px 36px", textAlign:"center", maxWidth:460, width:"100%" }}>
          <div style={{ fontSize:52, marginBottom:18 }}>📡</div>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:10 }}>No Ad Accounts Connected</div>
          <div style={{ fontSize:13.5, color:C.text3, lineHeight:1.65, marginBottom:28 }}>
            You don't have any Meta ad accounts linked yet. Connect a Facebook account to start managing pixels and events.
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

// ─── Overview content skeleton (while switching accounts) ─────────────────────
function DataLoadingSkeleton() {
  return (
    <div className="ov-body">
      <div className="ov-grid4">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
      <div className="ov-grid3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, height:200, marginBottom:14 }} />
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, height:160 }} />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  // ── Accounts state ────────────────────────────────────────────────────────
  const [allAccounts,     setAllAccounts    ] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError,   setAccountsError  ] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // ── Overview data state ───────────────────────────────────────────────────
  const [data,        setData       ] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError,   setDataError  ] = useState(null);
  const [refreshing,  setRefreshing ] = useState(false);

  // ── STEP 1: Load all ad accounts on mount ─────────────────────────────────
  useEffect(() => {
    async function loadAccounts() {
      log.group("📡 [Overview] STEP 1 — Load all ad accounts");
      try {
        const res  = await fetch("/api/meta-accounts");
        const json = await res.json();

        if (res.status === 401) throw new Error("Not authenticated — please log in again.");
        if (!res.ok) throw new Error(extractErrorMessage(json.error || json, "Failed to load accounts"));

        const accounts = json.accounts || [];
        log.ok(`Loaded ${accounts.length} account(s)`, accounts.map(a => ({ id:a.id, name:a.name })));

        setAllAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedAccount(accounts[0]);
        }
      } catch (err) {
        log.error("STEP 1 FAILED", err.message);
        setAccountsError(extractErrorMessage(err));
      } finally {
        setAccountsLoading(false);
        log.end();
      }
    }
    loadAccounts();
  }, []);

  // ── STEP 2: Fetch overview whenever selected account changes ──────────────
  useEffect(() => {
    if (!selectedAccount?.id) return;
    fetchOverview(selectedAccount.id, false);
  }, [selectedAccount?.id]);

  // ── Core fetch ────────────────────────────────────────────────────────────
  async function fetchOverview(adAccountId, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else           setDataLoading(true);
    setDataError(null);

    log.group(`📊 [Overview] Fetching overview for account: ${adAccountId}`);

    try {
      const res  = await fetch(`/api/events-manager/overview?adAccountId=${adAccountId}`);
      const json = await res.json();

      if (!res.ok) throw new Error(extractErrorMessage(json.error || json, `HTTP ${res.status}`));

      log.ok("Overview loaded", { stats: json.stats, pixels: json.pixels?.length });
      setData(json);
    } catch (err) {
      log.error("Fetch failed", err.message);
      setDataError(extractErrorMessage(err));
    } finally {
      setDataLoading(false);
      setRefreshing(false);
      log.end();
    }
  }

  // ── Account switch ────────────────────────────────────────────────────────
  function handleAccountChange(acc) {
    if (acc.id === selectedAccount?.id) return;
    log.info("Account switched →", acc.name);
    setData(null);
    setDataError(null);
    setSelectedAccount(acc);
    // useEffect on selectedAccount?.id will trigger fetchOverview
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER GUARDS
  // ─────────────────────────────────────────────────────────────────────────
  if (accountsLoading) return <><style>{GLOBAL_CSS}</style><LoadingSkeleton /></>;

  if (accountsError) return (
    <div className="ov-root" style={{ background:C.pageBg, minHeight:"calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>
      <div className="ov-body" style={{ paddingTop:20 }}>
        <div style={{ background:C.redLight, border:`1px solid ${C.redBorder}`, borderRadius:8, padding:"14px 18px", display:"flex", alignItems:"flex-start", gap:12 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>⚠️</span>
          <div>
            <div style={{ fontSize:13.5, fontWeight:700, color:C.red, marginBottom:3 }}>Failed to load accounts</div>
            <div style={{ fontSize:12.5, color:C.red, opacity:0.85 }}>{accountsError}</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!allAccounts.length) return <NoAccountsScreen />;

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED DATA
  // ─────────────────────────────────────────────────────────────────────────
  const stats        = data?.stats;
  const pixels       = data?.pixels       || [];
  const testEvents   = data?.test_events  || [];
  const critical     = stats?.diagnostics?.critical ?? 0;
  const warning      = stats?.diagnostics?.warning  ?? 0;
  const emq          = stats?.eventMatchQuality?.average ?? null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="ov-root" style={{ background:C.pageBg, minHeight:"calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Sub-header ──────────────────────────────────────────────────────── */}
      <div className="ov-subheader">
        {/* Left */}
        <div className="ov-subheader-left">
          <div style={{ fontSize:15, fontWeight:700, color:C.text1, letterSpacing:"-0.2px", lineHeight:1.3 }}>
            Events Manager
          </div>
          {selectedAccount && (
            <div style={{ fontSize:11.5, color:C.text3, marginTop:2, display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
              <span>{selectedAccount.currency}</span>
              {selectedAccount.timezone && (
                <><span style={{ color:C.border }}>·</span><span>{selectedAccount.timezone}</span></>
              )}
              {selectedAccount.metaAccountId && (
                <><span style={{ color:C.border }}>·</span><span style={{ fontFamily:"monospace" }}>{selectedAccount.metaAccountId}</span></>
              )}
            </div>
          )}
        </div>

        {/* Right */}
        <div className="ov-subheader-right">
          {/* Account dropdown */}
          <AccountDropdown
            accounts={allAccounts}
            selectedId={selectedAccount?.id}
            onChange={handleAccountChange}
            accountsLoading={accountsLoading}
          />

          {/* Refresh */}
          <button
            className="ov-refresh"
            disabled={refreshing || dataLoading || !selectedAccount}
            onClick={() => fetchOverview(selectedAccount.id, true)}
            style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.white, border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 11px", fontSize:12.5, fontWeight:600, color:C.text1, cursor:"pointer", transition:"background .15s", whiteSpace:"nowrap" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={refreshing ? "ov-spinning" : ""}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            <span className="ov-refresh-label">{refreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ── EventsManagerShell (tab nav) + body ───────────────────────────────── */}
      <EventsManagerShell>

        {/* ── Data loading (account switch) ──────────────────────────────────── */}
        {dataLoading && <DataLoadingSkeleton />}

        {/* ── Data error ─────────────────────────────────────────────────────── */}
        {!dataLoading && dataError && (
          <div className="ov-body">
            <div style={{ background:C.redLight, border:`1px solid ${C.redBorder}`, borderRadius:8, padding:"14px 18px", display:"flex", alignItems:"flex-start", gap:12 }}>
              <span style={{ fontSize:20, flexShrink:0 }}>⚠️</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13.5, fontWeight:700, color:C.red, marginBottom:3 }}>Failed to load overview</div>
                <div style={{ fontSize:12.5, color:C.red, opacity:0.85 }}>{dataError}</div>
              </div>
              <button
                onClick={() => fetchOverview(selectedAccount.id, true)}
                style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.white, border:`1px solid ${C.redBorder}`, borderRadius:6, padding:"6px 12px", fontSize:12.5, fontWeight:600, color:C.red, cursor:"pointer", flexShrink:0 }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Overview data ───────────────────────────────────────────────────── */}
        {!dataLoading && !dataError && data && (
          <div className="ov-body ov-animate">

            {/* ── 4-col stat cards ──────────────────────────────────────────── */}
            <div className="ov-grid4">
              <StatCard
                label="Total Pixels"
                value={stats?.pixels?.total ?? "—"}
                sub="Connected to this account"
                accent={C.blue}
              />
              <StatCard
                label="Events Received"
                value={stats?.events?.totalReceived?.toLocaleString() ?? "0"}
                sub={stats?.events?.hasData ? "Across all pixels, all time" : "No events recorded yet"}
                accent="#42b72a"
              />
              <StatCard
                label="Avg Match Quality"
                value={emq != null ? `${emq}/10` : "—"}
                sub={
                  emq == null ? "No data yet" :
                  emq >= 7   ? "🟢 Good — strong signal" :
                  emq >= 5   ? "🟡 Moderate — can improve" :
                               "🔴 Low — action required"
                }
                accent="#f5a623"
              />
              <StatCard
                label="Open Diagnostics"
                value={stats?.diagnostics?.total ?? 0}
                sub={
                  <span style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:3 }}>
                    <span style={badgeStyle("error")}><Dot color={C.red}/>{critical} critical</span>
                    <span style={badgeStyle("warning")}><Dot color={C.yellow}/>{warning} warning</span>
                  </span>
                }
                accent={C.red}
              />
            </div>

            {/* ── 3-col stat cards ──────────────────────────────────────────── */}
            <div className="ov-grid3">
              <StatCard
                label="CAPI Configured"
                value={stats?.pixels?.capiConfigured ?? "—"}
                sub={`of ${stats?.pixels?.total ?? 0} pixel${(stats?.pixels?.total ?? 0) !== 1 ? "s" : ""} · server-side tracking active`}
                accent={C.purple}
              />
              <StatCard
                label="Datasets"
                value={stats?.datasets?.total ?? "—"}
                sub="Active datasets linked to this account"
                accent={C.teal}
              />
              <StatCard
                label="Warnings"
                value={warning}
                sub="Open issues needing attention"
                accent={C.yellow}
              />
            </div>

            {/* ── Pixels table ──────────────────────────────────────────────── */}
            <SectionCard
              title="Pixels"
              count={pixels.length}
              action={<button className="ov-link">Manage pixels →</button>}
            >
              {pixels.length === 0 ? (
                <TableEmpty icon="🔲" title="No pixels found" sub="Add a pixel to this ad account to start tracking events." />
              ) : (
                <div className="ov-table-wrap">
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr>
                        {["Pixel Name","Pixel ID","Status","Match Quality","Events","CAPI"].map(h => (
                          <th key={h} style={TH_S}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pixels.map((p, i) => (
                        <HoverRow key={p.pixelId || i}>
                          <td style={TD_S}>
                            <div style={{ fontWeight:600, color:C.text1, fontSize:13 }}>{p.name}</div>
                          </td>
                          <td style={TD_S}>
                            <span style={{ fontFamily:"monospace", fontSize:11, background:C.surface, padding:"2px 6px", borderRadius:4, color:C.text2, border:`1px solid ${C.border}`, display:"inline-block", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {p.pixelId || "—"}
                            </span>
                          </td>
                          <td style={TD_S}>
                            {p.status === "active"
                              ? <span style={badgeStyle("active")}><Dot color={C.green}/>Active</span>
                              : <span style={badgeStyle("inactive")}>{p.status || "Unknown"}</span>
                            }
                          </td>
                          <td style={TD_S}>
                            <EMQScore score={p.eventMatchQuality?.score} />
                          </td>
                          <td style={{ ...TD_S, fontWeight:600 }}>
                            {p.events?.totalReceived?.toLocaleString() ?? "0"}
                          </td>
                          <td style={TD_S}>
                            {p.capi?.status === "active"
                              ? <span style={badgeStyle("capi")}><Dot color={C.green}/>Active</span>
                              : <span style={badgeStyle("inactive")}>Off</span>
                            }
                          </td>
                        </HoverRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            {/* ── Recent test events ────────────────────────────────────────── */}
            <SectionCard
              title="Recent Test Events"
              count={testEvents.length}
              action={<button className="ov-link">Open Test Events →</button>}
            >
              {testEvents.length === 0 ? (
                <TableEmpty icon="🧪" title="No test events yet" sub="Use the Test Events tab to send and verify events in real time." />
              ) : (
                <div className="ov-table-wrap">
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr>
                        {["Event Name","Source","Match Quality","Received","Status"].map(h => (
                          <th key={h} style={TH_S}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {testEvents.map((ev, i) => (
                        <HoverRow key={ev.id || i}>
                          <td style={{ ...TD_S, fontWeight:600 }}>{ev.eventName}</td>
                          <td style={TD_S}>
                            {ev.eventSource === "capi"
                              ? <span style={badgeStyle("capi")}>⚡ Server (CAPI)</span>
                              : <span style={badgeStyle("info")}>🌐 Browser (Pixel)</span>
                            }
                          </td>
                          <td style={TD_S}><EMQScore score={ev.matchQuality} /></td>
                          <td style={TD_S}>
                            <span style={{ fontSize:12, color:C.text3, whiteSpace:"nowrap" }}>
                              {new Date(ev.receivedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                            </span>
                          </td>
                          <td style={TD_S}>
                            {ev.status === "received"
                              ? <span style={badgeStyle("active")}><Dot color={C.green}/>Received</span>
                              : ev.status === "error"
                              ? <span style={badgeStyle("error")}><Dot color={C.red}/>Error</span>
                              : <span style={badgeStyle("info")}>{ev.status}</span>
                            }
                          </td>
                        </HoverRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            {/* ── Footer ────────────────────────────────────────────────────── */}
            <div className="ov-footer" style={{ textAlign:"center", padding:"12px 0 4px", color:C.text4, fontSize:11.5 }}>
              Showing data for <strong style={{ color:C.text3 }}>{selectedAccount?.name}</strong>
              <span style={{ margin:"0 6px", color:C.border }}>·</span>
              Last updated {new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
              {allAccounts.length > 1 && (
                <><span style={{ margin:"0 6px", color:C.border }}>·</span>{allAccounts.length} accounts available</>
              )}
            </div>

          </div>
        )}

      </EventsManagerShell>
    </div>
  );
}