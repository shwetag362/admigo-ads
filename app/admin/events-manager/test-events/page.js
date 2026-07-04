"use client";
// app/dashboard/events-manager/test-events/page.js

import { useState, useEffect, useRef } from "react";
import EventsManagerShell from "../components/EventsManagerShell";

// ─── Safe error extractor ─────────────────────────────────────────────────────
function extractError(e, fallback = "An unexpected error occurred.") {
  if (!e) return fallback;
  if (typeof e === "string") return e || fallback;
  if (typeof e === "object") {
    const m = e?.message || e?.error?.message || (typeof e?.error === "string" ? e.error : null) || e?.detail;
    if (m && typeof m === "string") return m;
    try { return JSON.stringify(e); } catch { return fallback; }
  }
  return String(e) || fallback;
}

// ─── API helpers — all use ?adAccountId=&pixelId= query params ───────────────
const api = {
  async accounts() {
    try {
      const res  = await fetch("/api/meta-accounts");
      const json = await res.json();
      if (!res.ok) return { data: null, error: extractError(json?.error || json) };
      return { data: json.accounts || [], error: null };
    } catch (err) { return { data: null, error: err.message || "Network error" }; }
  },
  async pixels(adAccountId) {
    try {
      const res  = await fetch(`/api/events-manager/datasources?adAccountId=${adAccountId}`);
      const json = await res.json();
      if (!res.ok) return { data: null, error: extractError(json?.error || json) };
      return { data: json.pixels || [], error: null };
    } catch (err) { return { data: null, error: err.message || "Network error" }; }
  },
  async testEvents(adAccountId, pixelId) {
    try {
      const res  = await fetch(`/api/events-manager/test-events?adAccountId=${adAccountId}&pixelId=${pixelId}`);
      const json = await res.json();
      if (!res.ok) return { data: null, error: extractError(json?.error || json) };
      return { data: json, error: null };
    } catch (err) { return { data: null, error: err.message || "Network error" }; }
  },
  async logTestEvent(adAccountId, pixelId, body) {
    try {
      const res  = await fetch(`/api/events-manager/test-events?adAccountId=${adAccountId}&pixelId=${pixelId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: extractError(json?.error || json) };
      return { data: json, error: null };
    } catch (err) { return { data: null, error: err.message || "Network error" }; }
  },
  async clearLog(adAccountId, pixelId) {
    try {
      const res  = await fetch(`/api/events-manager/test-events?adAccountId=${adAccountId}&pixelId=${pixelId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: extractError(json?.error || json) };
      return { data: json, error: null };
    } catch (err) { return { data: null, error: err.message || "Network error" }; }
  },
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  pageBg: "#f0f2f5", white: "#ffffff", border: "#dddfe2", borderLight: "#f0f2f5",
  text1: "#1c1e21", text2: "#444950", text3: "#65676b", text4: "#8a8d91",
  blue: "#1877f2", blueLight: "#e7f3ff", blueBorder: "#bcd4f5", blueDark: "#145dbf",
  green: "#1e7e34", greenLight: "#e6f4ea", greenBorder: "#b7dfbe",
  yellow: "#e65100", yellowLight: "#fff8e1", yellowBorder: "#ffe0b2",
  red: "#c5221f", redLight: "#fce8e6", redBorder: "#f5c6c5",
  purple: "#6b4fbb", purpleLight: "#f0ebff", purpleBorder: "#d4c5f9",
  teal: "#0084c7", tealLight: "#e8f5fb", surface: "#f7f8fa",
};

const GLOBAL_CSS = `
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes dropIn  { from{opacity:0;transform:translateY(-4px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.4} }

  *,*::before,*::after{box-sizing:border-box}
  .cr{font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,sans-serif}
  .cr-animate{animation:fadeUp .22s ease both}
  .cr-spin{animation:spin 1s linear infinite}
  .cr-drop-anim{animation:dropIn .14s ease both}
  .cr-pulse{animation:pulse 2s ease infinite}

  .cr-btn{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s,transform .1s;white-space:nowrap;font-family:inherit}
  .cr-btn:active:not(:disabled){transform:scale(.98)}
  .cr-btn:disabled{opacity:.5;cursor:not-allowed}
  .cr-btn-blue{background:#1877f2;color:#fff}
  .cr-btn-blue:hover:not(:disabled){background:#145dbf}
  .cr-btn-ghost{background:#fff;border:1px solid #dddfe2;color:#444950}
  .cr-btn-ghost:hover:not(:disabled){background:#f7f8fa}
  .cr-btn-danger{background:#c5221f;color:#fff}
  .cr-btn-danger:hover:not(:disabled){background:#a31c19}

  .cr-input,.cr-select{width:100%;border:1px solid #dddfe2;border-radius:6px;padding:8px 11px;font-size:13px;color:#1c1e21;outline:none;transition:border .15s,box-shadow .15s;background:#fff;font-family:inherit}
  .cr-input:focus,.cr-select:focus{border-color:#1877f2;box-shadow:0 0 0 3px rgba(24,119,242,.12)}
  .cr-input::placeholder{color:#8a8d91}
  .cr-input:disabled,.cr-select:disabled{background:#f7f8fa;color:#8a8d91;cursor:not-allowed}
  .cr-select{cursor:pointer}

  .cr-dd-btn{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #dddfe2;color:#1c1e21;border-radius:7px;padding:6px 11px;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s;white-space:nowrap;max-width:220px;font-family:inherit}
  .cr-dd-btn:hover{background:#f7f8fa;border-color:#bcd4f5}
  .cr-dd-btn.open{border-color:#1877f2;background:#e7f3ff;color:#1877f2;box-shadow:0 0 0 3px rgba(24,119,242,.10)}
  .cr-dd-btn:disabled{opacity:.5;cursor:not-allowed}

  .cr-dd{position:absolute;top:calc(100% + 6px);left:0;min-width:260px;max-width:360px;background:#fff;border:1px solid #dddfe2;border-radius:8px;box-shadow:0 6px 28px rgba(0,0,0,.13);z-index:500;overflow:hidden}
  .cr-dd-item{display:flex;align-items:center;gap:10px;padding:9px 13px;cursor:pointer;transition:background .1s;border-bottom:1px solid #f0f2f5}
  .cr-dd-item:last-child{border-bottom:none}
  .cr-dd-item:hover{background:#f7f8fa}
  .cr-dd-item.sel{background:#e7f3ff}

  .cr-tag{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.15px;white-space:nowrap;line-height:1.6}
  .cr-tag-active{background:#e6f4ea;color:#1e7e34;border:1px solid #b7dfbe}
  .cr-tag-off{background:#f0f2f5;color:#65676b;border:1px solid #dddfe2}
  .cr-tag-warn{background:#fff8e1;color:#e65100;border:1px solid #ffe0b2}
  .cr-tag-info{background:#e8f0fe;color:#1a73e8;border:1px solid #c5d8fd}
  .cr-tag-error{background:#fce8e6;color:#c5221f;border:1px solid #f5c6c5}
  .cr-tag-teal{background:#e8f5fb;color:#0084c7;border:1px solid #b3dff5}
  .cr-tag-purple{background:#f0ebff;color:#6b4fbb;border:1px solid #d4c5f9}

  .cr-subheader{background:#fff;border-bottom:1px solid #dddfe2;padding:8px 24px;display:flex;align-items:center;justify-content:space-between;min-height:52px;flex-wrap:wrap;gap:8px}
  .cr-body{padding:16px 0px;max-width:1280px;margin:0 auto}
  .cr-g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .cr-g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .cr-stat{background:#fff;border:1px solid #dddfe2;border-radius:8px;padding:16px;position:relative;overflow:hidden}
  .cr-refresh:disabled{opacity:.5;cursor:not-allowed!important}
  .cr-refresh:hover:not(:disabled){background:#f7f8fa!important}

  .cr-table{width:100%;border-collapse:collapse;font-size:12.5px}
  .cr-table th{text-align:left;padding:8px 12px;font-size:11px;font-weight:700;color:#65676b;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #dddfe2;white-space:nowrap}
  .cr-table td{padding:10px 12px;border-bottom:1px solid #f0f2f5;color:#1c1e21;vertical-align:middle}
  .cr-table tr:last-child td{border-bottom:none}
  .cr-table tr:hover td{background:#f7f8fa}

  .cr-check-row{display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-radius:7px;margin-bottom:6px;font-size:12.5px;border:1px solid transparent}
  .cr-check-row:last-child{margin-bottom:0}
  .cr-check-pass{background:#e6f4ea;border-color:#b7dfbe}
  .cr-check-pending{background:#f7f8fa;border-color:#dddfe2}
  .cr-check-info{background:#e8f5fb;border-color:#b3dff5}

  @media(max-width:960px){.cr-g4{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:680px){.cr-g4,.cr-g2{grid-template-columns:1fr}.cr-body{padding:14px 16px}.cr-subheader{padding:0 14px}}
  @media(max-width:480px){.cr-body{padding:12px}.cr-subheader{padding:8px 12px}.cr-dd-btn{max-width:130px}.cr-rlbl{display:none}}
`;

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const skBase = { borderRadius:5, background:"linear-gradient(90deg,#e4e6eb 25%,#f0f2f5 50%,#e4e6eb 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite" };
function Skel({ w="100%", h=14, mb=0, br=5 }) {
  return <div style={{ ...skBase, width:w, height:h, marginBottom:mb, borderRadius:br }} />;
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function initials(name="") { return name.split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||"").join("")||"?"; }
function Tag({ type="off", children }) { return <span className={`cr-tag cr-tag-${type}`}>{children}</span>; }
function Dot({ color, pulse=false }) {
  return <span className={pulse?"cr-pulse":undefined} style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:color, flexShrink:0 }} />;
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function Dropdown({ items, selectedId, onChange, isLoading, placeholder, emptyMsg, disabled, renderLabel, renderRow }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const sel = items.find(i => i.id === selectedId);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (isLoading) return <div style={{ ...skBase, width:190, height:32, borderRadius:7 }} />;
  if (!items.length) return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#fce8e6", border:"1px solid #f5c6c5", borderRadius:7, padding:"6px 11px", fontSize:12, fontWeight:600, color:C.red }}>
      ⚠️ {emptyMsg||"None"}
    </div>
  );

  return (
    <div ref={ref} style={{ position:"relative", flexShrink:0 }}>
      <button
        className={`cr-dd-btn${open?" open":""}`}
        onClick={() => !disabled && setOpen(o=>!o)}
        disabled={disabled}
        title={sel ? renderLabel(sel) : placeholder}
      >
        <div style={{ width:20, height:20, borderRadius:4, flexShrink:0, background:open?"#1877f2":"#e4e6eb", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:open?"#fff":"#444950", transition:"background .15s" }}>
          {sel ? initials(sel.name) : "?"}
        </div>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, minWidth:0 }}>
          {sel ? renderLabel(sel) : placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink:0, transform:open?"rotate(180deg)":"none", transition:"transform .15s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="cr-dd cr-drop-anim">
          <div style={{ padding:"8px 13px 6px", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:C.text4, textTransform:"uppercase", letterSpacing:"0.5px" }}>{placeholder} ({items.length})</div>
          </div>
          <div style={{ maxHeight:280, overflowY:"auto" }}>
            {items.map(item => (
              <div key={item.id} className={`cr-dd-item${item.id===selectedId?" sel":""}`} onClick={()=>{ onChange(item); setOpen(false); }}>
                {renderRow(item, item.id===selectedId)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent=C.blue, loading=false }) {
  return (
    <div className="cr-stat">
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:accent, borderRadius:"8px 8px 0 0" }} />
      <div style={{ fontSize:11, fontWeight:700, color:C.text3, textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:8, marginTop:2 }}>{label}</div>
      {loading
        ? <><Skel w="55%" h={20} mb={6}/><Skel w="40%" h={10}/></>
        : <>
            <div style={{ fontSize:21, fontWeight:800, color:C.text1, lineHeight:1.1, marginBottom:5 }}>{value ?? "—"}</div>
            {sub && <div style={{ fontSize:11.5, color:C.text4, lineHeight:1.5 }}>{sub}</div>}
          </>
      }
    </div>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────
function Banner({ type="info", icon, title, body }) {
  const map = {
    success: { bg:C.greenLight,  border:C.greenBorder,  color:C.green  },
    warning: { bg:C.yellowLight, border:C.yellowBorder, color:C.yellow },
    error:   { bg:C.redLight,    border:C.redBorder,    color:C.red    },
    info:    { bg:C.blueLight,   border:C.blueBorder,   color:C.blue   },
  };
  const s = map[type] || map.info;
  return (
    <div style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:8, padding:"12px 16px", display:"flex", alignItems:"flex-start", gap:10 }}>
      {icon && <span style={{ fontSize:17, flexShrink:0, marginTop:1 }}>{icon}</span>}
      <div>
        {title && <div style={{ fontSize:13, fontWeight:700, color:s.color, marginBottom:body?2:0 }}>{title}</div>}
        {body  && <div style={{ fontSize:12.5, color:s.color, opacity:.85, lineHeight:1.55 }}>{body}</div>}
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onDismiss }) {
  if (!msg) return null;
  const isErr = msg.type === "error";
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:2000, background:isErr?C.redLight:C.greenLight, border:`1px solid ${isErr?C.redBorder:C.greenBorder}`, borderRadius:8, padding:"11px 16px", display:"flex", alignItems:"flex-start", gap:10, boxShadow:"0 4px 20px rgba(0,0,0,.1)", fontSize:13, fontWeight:600, color:isErr?C.red:C.green, animation:"fadeUp .2s ease both", maxWidth:400 }}>
      <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>{isErr?"❌":"✅"}</span>
      <span style={{ flex:1, lineHeight:1.5 }}>{msg.text}</span>
      <button onClick={onDismiss} style={{ background:"none", border:"none", cursor:"pointer", color:"inherit", fontSize:16, opacity:.7, padding:0, flexShrink:0 }}>×</button>
    </div>
  );
}

// ─── No accounts ──────────────────────────────────────────────────────────────
function NoAccountsScreen() {
  return (
    <div className="cr" style={{ background:C.pageBg, minHeight:"calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ paddingTop:56, display:"flex", justifyContent:"center", padding:"56px 24px 0" }}>
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"44px 36px", textAlign:"center", maxWidth:460, width:"100%" }}>
          <div style={{ fontSize:52, marginBottom:18 }}>🔌</div>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:10 }}>No Ad Accounts Connected</div>
          <div style={{ fontSize:13.5, color:C.text3, lineHeight:1.65, marginBottom:28 }}>Connect a Facebook ad account to view and validate test events.</div>
          <a href="/dashboard/settings" style={{ display:"inline-flex", alignItems:"center", gap:7, background:C.blue, color:"#fff", borderRadius:7, padding:"10px 20px", fontSize:13.5, fontWeight:700, textDecoration:"none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Connect Facebook Account
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────
function SourceTag({ source }) {
  const map = {
    pixel:  { type:"info",   label:"Browser Pixel" },
    capi:   { type:"active", label:"CAPI"          },
    app:    { type:"purple", label:"App"           },
    offline:{ type:"warn",   label:"Offline"       },
  };
  const s = map[source?.toLowerCase()] || { type:"off", label: source || "Unknown" };
  return <Tag type={s.type}>{s.label}</Tag>;
}

// ─── Checklist row ────────────────────────────────────────────────────────────
function ChecklistRow({ item, status }) {
  const cfg = {
    pass:                    { cls:"cr-check-pass",    icon:"✅", color:C.green,  label:"Pass"   },
    pending:                 { cls:"cr-check-pending", icon:"⏳", color:C.text4,  label:"Pending" },
    check_deduplication_tab: { cls:"cr-check-info",    icon:"🔍", color:C.teal,   label:"Check"  },
  };
  const c = cfg[status] || cfg.pending;
  return (
    <div className={`cr-check-row ${c.cls}`}>
      <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>{c.icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:C.text1 }}>{item}</div>
        {status === "check_deduplication_tab" && (
          <div style={{ fontSize:11.5, color:C.teal, marginTop:2 }}>Verify in the Deduplication tab that event_id matches between Pixel and CAPI.</div>
        )}
      </div>
      <Tag type={status === "pass" ? "active" : status === "check_deduplication_tab" ? "teal" : "off"}>{c.label}</Tag>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function TestEventsPage() {
  // ── Account + pixel selection ─────────────────────────────────────────────
  const [allAccounts,  setAllAccounts ] = useState([]);
  const [acctLoading,  setAcctLoading ] = useState(true);
  const [acctError,    setAcctError   ] = useState(null);
  const [selAccount,   setSelAccount  ] = useState(null);

  const [allPixels,    setAllPixels   ] = useState([]);
  const [pixLoading,   setPixLoading  ] = useState(false);
  const [selPixel,     setSelPixel    ] = useState(null);

  // ── Page data ─────────────────────────────────────────────────────────────
  const [data,         setData        ] = useState(null);
  const [dataLoading,  setDataLoading ] = useState(false);
  const [dataError,    setDataError   ] = useState(null);
  const [refreshing,   setRefreshing  ] = useState(false);

  // ── Log event form ────────────────────────────────────────────────────────
  const [logging,      setLogging     ] = useState(false);
  const [logEventName, setLogEventName] = useState("PageView");
  const [logSource,    setLogSource   ] = useState("pixel");

  // ── Clear log ─────────────────────────────────────────────────────────────
  const [clearing,     setClearing    ] = useState(false);
  const [showConfirm,  setShowConfirm ] = useState(false);

  // ── Active tab ────────────────────────────────────────────────────────────
  const [tab,          setTab         ] = useState("live");

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [msg,          setMsg         ] = useState(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  // ── STEP 1: Load accounts on mount ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: d, error } = await api.accounts();
      if (error) { setAcctError(extractError(error)); }
      else {
        setAllAccounts(d);
        if (d.length > 0) setSelAccount(d[0]);
      }
      setAcctLoading(false);
    })();
  }, []);

  // ── STEP 2: Load pixels when account changes ──────────────────────────────
  useEffect(() => {
    if (!selAccount?.id) return;
    setSelPixel(null); setAllPixels([]); setData(null); setDataError(null);
    loadPixels(selAccount.id);
  }, [selAccount?.id]);

  async function loadPixels(adAccountId) {
    setPixLoading(true);
    const { data: d, error } = await api.pixels(adAccountId);
    setPixLoading(false);
    if (error) { setMsg({ type:"error", text:`Failed to load pixels: ${error}` }); return; }
    setAllPixels(d);
    if (d.length > 0) setSelPixel(d[0]);
  }

  // ── STEP 3: Load test events when pixel changes ───────────────────────────
  useEffect(() => {
    if (!selAccount?.id || !selPixel?.id) return;
    loadData(selAccount.id, selPixel.id, false);
  }, [selPixel?.id]);

  async function loadData(adAccountId, pixelId, isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setDataLoading(true);
    setDataError(null);
    const { data: d, error } = await api.testEvents(adAccountId, pixelId);
    if (error) setDataError(extractError(error));
    else if (d) setData(d);
    setDataLoading(false); setRefreshing(false);
  }

  // ── Log a manual test event ───────────────────────────────────────────────
  async function handleLogEvent() {
    if (!selAccount?.id || !selPixel?.id) return;
    setLogging(true);
    const { error } = await api.logTestEvent(selAccount.id, selPixel.id, {
      event_name:   logEventName,
      event_source: logSource,
      payload:      { logged_at: new Date().toISOString(), source: "manual_dashboard" },
      test_code:    data?.test_event_code ?? null,
    });
    setLogging(false);
    if (error) { setMsg({ type:"error", text:extractError(error) }); return; }
    setMsg({ type:"success", text:`${logEventName} logged from ${logSource}.` });
    loadData(selAccount.id, selPixel.id, true);
  }

  // ── Clear log ─────────────────────────────────────────────────────────────
  async function handleClearLog() {
    if (!selAccount?.id || !selPixel?.id) return;
    setClearing(true); setShowConfirm(false);
    const { data: d, error } = await api.clearLog(selAccount.id, selPixel.id);
    setClearing(false);
    if (error) { setMsg({ type:"error", text:extractError(error) }); return; }
    setMsg({ type:"success", text:`Log cleared — ${d?.deleted_count ?? 0} event(s) removed.` });
    loadData(selAccount.id, selPixel.id, true);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const metaEvents  = data?.meta_events      || [];
  const localEvents = data?.local_event_log  || [];
  const checklist   = data?.checklist        || [];
  const howToUse    = data?.how_to_use       || [];
  const passCount   = checklist.filter(c => c.status === "pass").length;

  // ── Render guards ─────────────────────────────────────────────────────────
  if (acctLoading) return (
    <div className="cr" style={{ background:C.pageBg, minHeight:"calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>
      <div className="cr-subheader" style={{ padding:"13px 24px" }}>
        <div><Skel w={200} h={15} mb={6}/><Skel w={260} h={10}/></div>
        <div style={{ display:"flex", gap:8 }}><Skel w={190} h={32}/><Skel w={180} h={32}/><Skel w={80} h={32}/></div>
      </div>
      <div className="cr-body">
        <div className="cr-g4" style={{ marginBottom:14 }}>
          {[...Array(4)].map((_,i)=>(
            <div key={i} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:16 }}>
              <Skel w="50%" h={10} mb={10}/><Skel w="65%" h={22} mb={8}/><Skel w="40%" h={10}/>
            </div>
          ))}
        </div>
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, height:380 }}/>
      </div>
    </div>
  );

  if (acctError) return (
    <div className="cr" style={{ background:C.pageBg, minHeight:"calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>
      <div className="cr-body" style={{ paddingTop:24 }}>
        <Banner type="error" icon="⚠️" title="Failed to load accounts" body={acctError}/>
      </div>
    </div>
  );

  if (!allAccounts.length) return <NoAccountsScreen />;

  const pixName = selPixel?.name || "—";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="cr" style={{ background:C.pageBg, minHeight:"calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Subheader ──────────────────────────────────────────────────────── */}
      <div className="cr-subheader">
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"8px 0" }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.text1, letterSpacing:"-0.2px", display:"flex", alignItems:"center", gap:8 }}>
            Test Events
            {data && passCount === checklist.length && checklist.length > 0
              ? <Tag type="active"><span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:C.green, marginRight:3 }}/>All Checks Pass</Tag>
              : data && <Tag type="warn">{passCount}/{checklist.length} checks passed</Tag>
            }
          </div>
          <div style={{ fontSize:11.5, color:C.text3, marginTop:2, display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
            <span>Real-time event validation</span>
            {selAccount?.metaAccountId && <><span style={{ color:C.border }}>·</span><span style={{ fontFamily:"monospace" }}>{selAccount.metaAccountId}</span></>}
            {selPixel && <><span style={{ color:C.border }}>·</span><span>Pixel: <strong style={{ color:C.text2 }}>{pixName}</strong></span></>}
            {data?.test_event_code && <><span style={{ color:C.border }}>·</span><span>Code: <strong style={{ color:C.teal, fontFamily:"monospace" }}>{data.test_event_code}</strong></span></>}
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          {/* Account dropdown */}
          <Dropdown
            items={allAccounts}
            selectedId={selAccount?.id}
            onChange={acc => { if (acc.id !== selAccount?.id) { setSelAccount(acc); setData(null); setDataError(null); }}}
            placeholder="Ad Account"
            emptyMsg="No accounts"
            renderLabel={a => a.name}
            renderRow={(a, s) => (
              <>
                <div style={{ width:30, height:30, borderRadius:6, flexShrink:0, background:s?"#1877f2":"#e4e6eb", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:s?"#fff":"#65676b" }}>
                  {initials(a.name)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color:s?C.blue:C.text1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a.name}</div>
                  <div style={{ fontSize:10.5, color:C.text4, fontFamily:"monospace", marginTop:1 }}>{a.metaAccountId}</div>
                </div>
                {s && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1877f2" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </>
            )}
          />

          {/* Pixel dropdown */}
          <Dropdown
            items={allPixels}
            selectedId={selPixel?.id}
            onChange={p => { if (p.id !== selPixel?.id) { setSelPixel(p); setData(null); setDataError(null); }}}
            isLoading={pixLoading}
            placeholder="Pixel"
            emptyMsg="No pixels"
            disabled={pixLoading || !allPixels.length}
            renderLabel={p => p.name}
            renderRow={(p, s) => (
              <>
                <div style={{ width:30, height:30, borderRadius:6, flexShrink:0, background:s?"#1877f2":"#e4e6eb", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:s?"#fff":"#65676b" }}>PX</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color:s?C.blue:C.text1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize:10.5, color:C.text4, fontFamily:"monospace", marginTop:1 }}>{p.metaPixelId}</div>
                </div>
                {s && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1877f2" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </>
            )}
          />

          {/* Refresh */}
          <button
            className="cr-refresh cr-btn cr-btn-ghost"
            style={{ padding:"7px 12px" }}
            disabled={refreshing || dataLoading || !selPixel}
            onClick={() => selPixel && loadData(selAccount.id, selPixel.id, true)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={refreshing?"cr-spin":""}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            <span className="cr-rlbl">{refreshing?"Refreshing…":"Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <EventsManagerShell>
        <div className="cr-body cr-animate">

          {/* Error banner */}
          {dataError && (
            <div style={{ marginBottom:14 }}>
              <Banner type="error" icon="⚠️" title="Failed to load test events" body={dataError}/>
            </div>
          )}

          {/* Empty state */}
          {!selPixel && !pixLoading && (
            <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, textAlign:"center", padding:"56px 20px" }}>
              <div style={{ fontSize:44, marginBottom:14 }}>🧪</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.text2, marginBottom:6 }}>Select a Pixel</div>
              <div style={{ fontSize:13, color:C.text4, maxWidth:340, margin:"0 auto", lineHeight:1.6 }}>
                Choose an ad account and pixel to view real-time test events and validate your tracking setup.
              </div>
            </div>
          )}

          {selPixel && (
            <>
              {/* ── 4 stat cards ─────────────────────────────────────────── */}
              <div className="cr-g4" style={{ marginBottom:14 }}>
                <StatCard
                  label="Meta Live Events"
                  loading={dataLoading}
                  value={metaEvents.length.toLocaleString()}
                  sub="From Meta's test events API"
                  accent={C.blue}
                />
                <StatCard
                  label="Local Log"
                  loading={dataLoading}
                  value={localEvents.length.toLocaleString()}
                  sub="Logged in your DB"
                  accent={C.purple}
                />
                <StatCard
                  label="Checklist"
                  loading={dataLoading}
                  value={`${passCount} / ${checklist.length}`}
                  sub={passCount === checklist.length && checklist.length > 0 ? "All checks passed 🎉" : "Checks remaining"}
                  accent={passCount === checklist.length && checklist.length > 0 ? C.green : C.yellow}
                />
                <StatCard
                  label="Test Event Code"
                  loading={dataLoading}
                  value={<span style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:C.teal }}>{data?.test_event_code || "—"}</span>}
                  sub="Add to your URL to test"
                  accent={C.teal}
                />
              </div>

              {/* ── Tabs ─────────────────────────────────────────────────── */}
              <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", marginBottom:14 }}>
                <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, overflowX:"auto" }}>
                  {[
                    { k:"live",      label:"📡  Live Meta Events"  },
                    { k:"local",     label:"🗂️  Local Log"          },
                    { k:"checklist", label:"✅  Checklist"          },
                    { k:"howto",     label:"📖  How to Use"         },
                  ].map(t => (
                    <button
                      key={t.k}
                      style={{ padding:"10px 16px", fontSize:13, fontWeight:600, color:tab===t.k?C.blue:C.text3, cursor:"pointer", borderBottom:`2px solid ${tab===t.k?C.blue:"transparent"}`, transition:"color .15s,border-color .15s", whiteSpace:"nowrap", background:"none", border:"none", borderBottom:`2px solid ${tab===t.k?C.blue:"transparent"}`, fontFamily:"inherit" }}
                      onClick={() => setTab(t.k)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ── Live Meta Events ─────────────────────────────────── */}
                {tab === "live" && (
                  <div style={{ padding:20 }}>
                    <div style={{ marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:2 }}>Live Test Events from Meta</div>
                        <div style={{ fontSize:12.5, color:C.text3 }}>
                          Events received by Meta with your test event code. Open{" "}
                          <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener" style={{ color:C.blue }}>Meta Events Manager</a>
                          {" "}to see them in real time.
                        </div>
                      </div>
                    </div>

                    {dataLoading ? (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {[...Array(3)].map((_,i) => <Skel key={i} w="100%" h={44} br={7}/>)}
                      </div>
                    ) : metaEvents.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"32px 20px", background:C.surface, borderRadius:8, border:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text3, marginBottom:4 }}>No live events yet</div>
                        <div style={{ fontSize:12.5, color:C.text4, maxWidth:340, margin:"0 auto", lineHeight:1.6 }}>
                          {data?.test_event_code
                            ? <>Add <code style={{ fontFamily:"monospace", background:C.blueLight, padding:"1px 5px", borderRadius:3 }}>?test_event_code={data.test_event_code}</code> to your site URL, then perform actions.</>
                            : "Configure CAPI first to get a test event code, then visit your site to fire events."
                          }
                        </div>
                      </div>
                    ) : (
                      <div style={{ overflowX:"auto" }}>
                        <table className="cr-table">
                          <thead>
                            <tr>
                              <th>Event</th>
                              <th>Source</th>
                              <th>Match Result</th>
                              <th>Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            {metaEvents.map((ev, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight:600 }}>{ev.event_name}</td>
                                <td><SourceTag source={ev.event_source_type}/></td>
                                <td>
                                  {ev.match_result
                                    ? <Tag type={ev.match_result === "matched" ? "active" : "warn"}>{ev.match_result}</Tag>
                                    : <span style={{ color:C.text4 }}>—</span>
                                  }
                                </td>
                                <td style={{ color:C.text4, fontSize:12 }}>
                                  {ev.receive_time ? new Date(ev.receive_time * 1000).toLocaleTimeString([],{ hour:"2-digit", minute:"2-digit", second:"2-digit" }) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Local Log ────────────────────────────────────────── */}
                {tab === "local" && (
                  <div style={{ padding:20 }}>
                    <div style={{ marginBottom:14, display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:2 }}>Local Event Log</div>
                        <div style={{ fontSize:12.5, color:C.text3 }}>Events logged in your database from both browser pixel and CAPI sources.</div>
                      </div>

                      {/* Log manual event + clear */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <select
                          className="cr-select"
                          style={{ width:"auto", minWidth:120 }}
                          value={logEventName}
                          onChange={e => setLogEventName(e.target.value)}
                          disabled={logging}
                        >
                          {["PageView","Purchase","Lead","AddToCart","InitiateCheckout","ViewContent","Search"].map(v=>(
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                        <select
                          className="cr-select"
                          style={{ width:"auto", minWidth:100 }}
                          value={logSource}
                          onChange={e => setLogSource(e.target.value)}
                          disabled={logging}
                        >
                          <option value="pixel">pixel</option>
                          <option value="capi">capi</option>
                          <option value="app">app</option>
                          <option value="offline">offline</option>
                        </select>
                        <button className="cr-btn cr-btn-blue" onClick={handleLogEvent} disabled={logging || dataLoading}>
                          {logging
                            ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="cr-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Logging…</>
                            : <>+ Log Event</>
                          }
                        </button>

                        {localEvents.length > 0 && !showConfirm && (
                          <button className="cr-btn cr-btn-ghost" style={{ color:C.red, borderColor:C.redBorder }} onClick={() => setShowConfirm(true)} disabled={clearing}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            Clear Log
                          </button>
                        )}

                        {showConfirm && (
                          <div style={{ display:"flex", alignItems:"center", gap:6, background:C.redLight, border:`1px solid ${C.redBorder}`, borderRadius:7, padding:"5px 10px", fontSize:12.5, color:C.red, fontWeight:600 }}>
                            <span>Delete all {localEvents.length} events?</span>
                            <button className="cr-btn cr-btn-danger" style={{ padding:"3px 10px", fontSize:12 }} onClick={handleClearLog} disabled={clearing}>
                              {clearing ? "Clearing…" : "Yes, clear"}
                            </button>
                            <button className="cr-btn cr-btn-ghost" style={{ padding:"3px 10px", fontSize:12 }} onClick={() => setShowConfirm(false)}>Cancel</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {dataLoading ? (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {[...Array(4)].map((_,i) => <Skel key={i} w="100%" h={44} br={7}/>)}
                      </div>
                    ) : localEvents.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"32px 20px", background:C.surface, borderRadius:8, border:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text3, marginBottom:4 }}>No events logged yet</div>
                        <div style={{ fontSize:12.5, color:C.text4 }}>Use the Log Event button above or fire events from your site.</div>
                      </div>
                    ) : (
                      <div style={{ overflowX:"auto" }}>
                        <table className="cr-table">
                          <thead>
                            <tr>
                              <th>Event</th>
                              <th>Source</th>
                              <th>Status</th>
                              <th>Test Code</th>
                              <th>Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            {localEvents.map((ev, i) => (
                              <tr key={ev.id || i}>
                                <td style={{ fontWeight:600 }}>{ev.eventName}</td>
                                <td><SourceTag source={ev.eventSource}/></td>
                                <td>
                                  <Tag type={ev.status === "received" || ev.status === "sent" ? "active" : "off"}>
                                    {ev.status || "received"}
                                  </Tag>
                                </td>
                                <td>
                                  {ev.testCode
                                    ? <span style={{ fontFamily:"monospace", fontSize:11, color:C.teal }}>{ev.testCode}</span>
                                    : <span style={{ color:C.text4 }}>—</span>
                                  }
                                </td>
                                <td style={{ color:C.text4, fontSize:12 }}>
                                  {ev.receivedAt ? new Date(ev.receivedAt).toLocaleTimeString([],{ hour:"2-digit", minute:"2-digit", second:"2-digit" }) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Checklist ─────────────────────────────────────────── */}
                {tab === "checklist" && (
                  <div style={{ padding:20 }}>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:2 }}>Setup Checklist</div>
                      <div style={{ fontSize:12.5, color:C.text3 }}>
                        These checks update automatically as events arrive. Refresh to re-evaluate.
                      </div>
                    </div>

                    {dataLoading ? (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {[...Array(4)].map((_,i) => <Skel key={i} w="100%" h={52} br={7}/>)}
                      </div>
                    ) : checklist.length === 0 ? (
                      <Banner type="info" icon="ℹ️" title="No data yet" body="Select a pixel and refresh after firing some events on your site."/>
                    ) : (
                      <div>
                        {checklist.map((c, i) => (
                          <ChecklistRow key={i} item={c.item} status={c.status}/>
                        ))}
                      </div>
                    )}

                    {passCount === checklist.length && checklist.length > 0 && (
                      <div style={{ marginTop:14 }}>
                        <Banner type="success" icon="🎉" title="All checks passed!" body="Your pixel and CAPI setup looks good. Remember to remove the test_event_code from your URL before going live."/>
                      </div>
                    )}
                  </div>
                )}

                {/* ── How to Use ────────────────────────────────────────── */}
                {tab === "howto" && (
                  <div style={{ padding:20 }}>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:2 }}>How to Use Test Events</div>
                      <div style={{ fontSize:12.5, color:C.text3 }}>Follow these steps to validate your pixel and CAPI integration end-to-end.</div>
                    </div>

                    <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 16px", marginBottom:16 }}>
                      {(howToUse.length > 0 ? howToUse : [
                        "1. Open your website in a new browser tab.",
                        `2. Add ?test_event_code=${data?.test_event_code ?? "YOUR_CODE"} to your URL — or the code is auto-detected.`,
                        "3. Perform actions: page view, add to cart, purchase.",
                        "4. Watch events appear in the Live Meta Events tab (refresh to update).",
                        "5. Confirm each action appears from BOTH pixel and capi sources.",
                        "6. Remove the test_event_code before going live.",
                      ]).map((step, i) => (
                        <div key={i} style={{ display:"flex", gap:12, padding:"12px 0", borderBottom:`1px solid ${C.borderLight}` }}>
                          <div style={{ width:24, height:24, borderRadius:"50%", background:C.blue, color:"#fff", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
                            {i+1}
                          </div>
                          <div style={{ fontSize:13, color:C.text2, lineHeight:1.6, paddingTop:3 }}>{step.replace(/^\d+\.\s/, "")}</div>
                        </div>
                      ))}
                    </div>

                    <Banner type="info" icon="💡" title="Tips">
                      <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:4 }}>
                        {[
                          "Use an incognito window to avoid cached data affecting results.",
                          "Events can take 1–2 minutes to appear in Meta Events Manager.",
                          "The checklist auto-updates — refresh after each action on your site.",
                          "Both 'pixel' and 'capi' sources should appear for the same event (deduplication).",
                          "Verify the event_id matches between pixel and CAPI in the Local Log.",
                        ].map((tip, i) => (
                          <div key={i} style={{ display:"flex", gap:7, fontSize:12.5, color:C.blueDark }}>
                            <span style={{ flexShrink:0 }}>→</span><span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </Banner>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ textAlign:"center", padding:"8px 0 4px", color:C.text4, fontSize:11.5 }}>
                Test Events for <strong style={{ color:C.text3 }}>{pixName}</strong>
                <span style={{ margin:"0 6px", color:C.border }}>·</span>
                Account: <strong style={{ color:C.text3 }}>{selAccount?.name}</strong>
                <span style={{ margin:"0 6px", color:C.border }}>·</span>
                Updated {new Date().toLocaleTimeString([],{ hour:"2-digit", minute:"2-digit" })}
              </div>
            </>
          )}
        </div>
      </EventsManagerShell>

      <Toast msg={msg} onDismiss={() => setMsg(null)} />
    </div>
  );
}