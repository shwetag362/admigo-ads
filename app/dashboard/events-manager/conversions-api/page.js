
"use client";
// app/dashboard/events-manager/conversions-api/page.js

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
      const res = await fetch("/api/meta-accounts");
      const json = await res.json();
      if (!res.ok) return { data: null, error: extractError(json?.error || json) };
      return { data: json.accounts || [], error: null };
    } catch (err) { return { data: null, error: err.message || "Network error" }; }
  },
  async pixels(adAccountId) {
    try {
      const res = await fetch(`/api/events-manager/datasources?adAccountId=${adAccountId}`);
      const json = await res.json();
      if (!res.ok) return { data: null, error: extractError(json?.error || json) };
      return { data: json.pixels || [], error: null };
    } catch (err) { return { data: null, error: err.message || "Network error" }; }
  },
  async capiSetup(adAccountId, pixelId) {
    try {
      const res = await fetch(`/api/events-manager/conversions-api/setup?adAccountId=${adAccountId}&pixelId=${pixelId}`);
      const json = await res.json();
      if (!res.ok) return { data: null, error: extractError(json?.error || json) };
      return { data: json, error: null };
    } catch (err) { return { data: null, error: err.message || "Network error" }; }
  },
  async configureCapi(adAccountId, pixelId, body) {
    try {
      const res = await fetch(`/api/events-manager/conversions-api/setup?adAccountId=${adAccountId}&pixelId=${pixelId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: extractError(json?.error || json) };
      return { data: json, error: null };
    } catch (err) { return { data: null, error: err.message || "Network error" }; }
  },
  async capiTestInfo(adAccountId, pixelId) {
    try {
      const res = await fetch(`/api/events-manager/conversions-api/test?adAccountId=${adAccountId}&pixelId=${pixelId}`);
      const json = await res.json();
      if (!res.ok) return { data: null, error: extractError(json?.error || json) };
      return { data: json, error: null };
    } catch (err) { return { data: null, error: err.message || "Network error" }; }
  },
  async sendCapiTest(adAccountId, pixelId, body) {
    try {
      const res = await fetch(`/api/events-manager/conversions-api/test?adAccountId=${adAccountId}&pixelId=${pixelId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
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
  .cr-btn-green{background:#1e7e34;color:#fff}
  .cr-btn-green:hover:not(:disabled){background:#155a28}
  .cr-btn-ghost{background:#fff;border:1px solid #dddfe2;color:#444950}
  .cr-btn-ghost:hover:not(:disabled){background:#f7f8fa}
  .cr-btn-sm{padding:4px 10px!important;font-size:11.5px!important;border-radius:5px!important}

  .cr-input,.cr-select{width:100%;border:1px solid #dddfe2;border-radius:6px;padding:8px 11px;font-size:13px;color:#1c1e21;outline:none;transition:border .15s,box-shadow .15s;background:#fff;font-family:inherit}
  .cr-input:focus,.cr-select:focus{border-color:#1877f2;box-shadow:0 0 0 3px rgba(24,119,242,.12)}
  .cr-input::placeholder{color:#8a8d91}
  .cr-input:disabled,.cr-select:disabled{background:#f7f8fa;color:#8a8d91;cursor:not-allowed}
  .cr-select{cursor:pointer}

  .cr-code{background:#1c1e21;border-radius:8px;padding:14px 16px;font-family:'JetBrains Mono','Fira Code','Courier New',monospace;font-size:11.5px;color:#e4e6eb;overflow-x:auto;line-height:1.75;white-space:pre;margin:0}

  .cr-tab{padding:10px 16px;font-size:13px;font-weight:600;color:#65676b;cursor:pointer;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;white-space:nowrap;background:none;border-top:none;border-left:none;border-right:none;font-family:inherit}
  .cr-tab:hover{color:#1c1e21}
  .cr-tab.active{color:#1877f2;border-bottom-color:#1877f2}

  .cr-dd-btn{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #dddfe2;color:#1c1e21;border-radius:7px;padding:6px 11px;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s;white-space:nowrap;max-width:220px;font-family:inherit}
  .cr-dd-btn:hover{background:#f7f8fa;border-color:#bcd4f5}
  .cr-dd-btn.open{border-color:#1877f2;background:#e7f3ff;color:#1877f2;box-shadow:0 0 0 3px rgba(24,119,242,.10)}
  .cr-dd-btn:disabled{opacity:.5;cursor:not-allowed}

  .cr-dd{position:absolute;top:calc(100% + 6px);left:0;min-width:260px;max-width:360px;background:#fff;border:1px solid #dddfe2;border-radius:8px;box-shadow:0 6px 28px rgba(0,0,0,.13);z-index:500;overflow:hidden}
  .cr-dd-item{display:flex;align-items:center;gap:10px;padding:9px 13px;cursor:pointer;transition:background .1s;border-bottom:1px solid #f0f2f5}
  .cr-dd-item:last-child{border-bottom:none}
  .cr-dd-item:hover{background:#f7f8fa}
  .cr-dd-item.sel{background:#e7f3ff}

  .cr-tog{position:relative;width:36px;height:20px;flex-shrink:0}
  .cr-tog input{opacity:0;width:0;height:0;position:absolute}
  .cr-tog-sl{position:absolute;inset:0;background:#dddfe2;border-radius:20px;cursor:pointer;transition:background .2s}
  .cr-tog-sl:before{content:'';position:absolute;width:14px;height:14px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
  .cr-tog input:checked+.cr-tog-sl{background:#1877f2}
  .cr-tog input:checked+.cr-tog-sl:before{transform:translateX(16px)}
  .cr-tog input:disabled+.cr-tog-sl{opacity:.5;cursor:not-allowed}

  .cr-copy{display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:#c9d1d9;border-radius:5px;padding:3px 8px;font-size:11px;font-weight:600;cursor:pointer;transition:background .15s;font-family:inherit}
  .cr-copy:hover{background:rgba(255,255,255,.18)}
  .cr-copy.ok{background:rgba(30,126,52,.35);border-color:rgba(30,126,52,.5);color:#86efac}

  .cr-tag{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.15px;white-space:nowrap;line-height:1.6}
  .cr-tag-active{background:#e6f4ea;color:#1e7e34;border:1px solid #b7dfbe}
  .cr-tag-off{background:#f0f2f5;color:#65676b;border:1px solid #dddfe2}
  .cr-tag-warn{background:#fff8e1;color:#e65100;border:1px solid #ffe0b2}
  .cr-tag-info{background:#e8f0fe;color:#1a73e8;border:1px solid #c5d8fd}
  .cr-tag-teal{background:#e8f5fb;color:#0084c7;border:1px solid #b3dff5}

  .cr-subheader{background:#fff;border-bottom:1px solid #dddfe2;padding:8px 24px;display:flex;align-items:center;justify-content:space-between;min-height:52px;flex-wrap:wrap;gap:8px}
  .cr-body{padding:18px 0px;max-width:1280px;margin:0 auto}
  .cr-g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .cr-g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .cr-stat{background:#fff;border:1px solid #dddfe2;border-radius:8px;padding:16px;position:relative;overflow:hidden}
  .cr-step{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f0f2f5}
  .cr-step:last-child{border-bottom:none}
  .cr-step-n{width:24px;height:24px;border-radius:50%;background:#1877f2;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}
  .cr-ev-row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:7px;background:#f7f8fa;border:1px solid #f0f2f5;margin-bottom:6px;font-size:12.5px}
  .cr-ev-row:last-child{margin-bottom:0}
  .cr-trow{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f0f2f5}
  .cr-trow:last-child{border-bottom:none}
  .cr-irow{display:flex;align-items:center;padding:9px 0;border-bottom:1px solid #f0f2f5}
  .cr-irow:last-child{border-bottom:none}
  .cr-refresh:disabled{opacity:.5;cursor:not-allowed!important}
  .cr-refresh:hover:not(:disabled){background:#f7f8fa!important}

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
function Dot({ color, pulse=false }) {
  return <span className={pulse?"cr-pulse":undefined} style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:color, flexShrink:0 }} />;
}
function Tag({ type="off", children }) { return <span className={`cr-tag cr-tag-${type}`}>{children}</span>; }

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  function copy() { navigator.clipboard.writeText(text).then(()=>{ setOk(true); setTimeout(()=>setOk(false),2000); }); }
  return (
    <button className={`cr-copy${ok?" ok":""}`} onClick={copy}>
      {ok
        ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
        : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy</>
      }
    </button>
  );
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
    <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.redLight, border:`1px solid ${C.redBorder}`, borderRadius:7, padding:"6px 11px", fontSize:12, fontWeight:600, color:C.red }}>
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

// ─── Toggle row ───────────────────────────────────────────────────────────────
function ToggleRow({ label, desc, checked, onChange, disabled }) {
  return (
    <div className="cr-trow">
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:C.text1 }}>{label}</div>
        {desc && <div style={{ fontSize:12, color:C.text4, marginTop:2 }}>{desc}</div>}
      </div>
      <label className="cr-tog">
        <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} disabled={disabled}/>
        <span className="cr-tog-sl"/>
      </label>
    </div>
  );
}

// ─── Code block ───────────────────────────────────────────────────────────────
function CodeBlock({ label, children }) {
  const txt = typeof children === "string" ? children : JSON.stringify(children, null, 2);
  return (
    <div>
      {label && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <div style={{ fontSize:11.5, fontWeight:700, color:C.text3, textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</div>
        </div>
      )}
      <div style={{ position:"relative" }}>
        <pre className="cr-code">{txt}</pre>
        <div style={{ position:"absolute", top:10, right:10 }}><CopyBtn text={txt}/></div>
      </div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, hint, required, children }) {
  return (
    <div style={{ display:"flex", flexDirection:"column" }}>
      {label && (
        <div style={{ fontSize:11.5, fontWeight:700, color:C.text2, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.4px" }}>
          {label}{required && <span style={{ color:C.red, marginLeft:3 }}>*</span>}
        </div>
      )}
      {children}
      {hint && <div style={{ fontSize:11.5, color:C.text4, marginTop:4 }}>{hint}</div>}
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="cr-irow">
      <span style={{ fontSize:12, color:C.text3, width:190, flexShrink:0, fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:12.5, color:C.text1, fontWeight:600 }}>{value}</span>
    </div>
  );
}

// ─── Alert banner ─────────────────────────────────────────────────────────────
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
      <div className="cr-body" style={{ paddingTop:56, display:"flex", justifyContent:"center" }}>
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"44px 36px", textAlign:"center", maxWidth:460, width:"100%" }}>
          <div style={{ fontSize:52, marginBottom:18 }}>🔌</div>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:10 }}>No Ad Accounts Connected</div>
          <div style={{ fontSize:13.5, color:C.text3, lineHeight:1.65, marginBottom:28 }}>Connect a Facebook ad account to configure server-side event tracking.</div>
          <a href="/dashboard/settings" style={{ display:"inline-flex", alignItems:"center", gap:7, background:C.blue, color:"#fff", borderRadius:7, padding:"10px 20px", fontSize:13.5, fontWeight:700, textDecoration:"none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Connect Facebook Account
          </a>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function ConversionsApiPage() {
  // ── Account + pixel selection ─────────────────────────────────────────────
  const [allAccounts,  setAllAccounts ] = useState([]);
  const [acctLoading,  setAcctLoading ] = useState(true);
  const [acctError,    setAcctError   ] = useState(null);
  const [selAccount,   setSelAccount  ] = useState(null);

  const [allPixels,    setAllPixels   ] = useState([]);
  const [pixLoading,   setPixLoading  ] = useState(false);
  const [selPixel,     setSelPixel    ] = useState(null);

  // ── CAPI data ─────────────────────────────────────────────────────────────
  const [setup,        setSetup       ] = useState(null);
  const [testInfo,     setTestInfo    ] = useState(null);
  const [dataLoading,  setDataLoading ] = useState(false);
  const [dataError,    setDataError   ] = useState(null);
  const [refreshing,   setRefreshing  ] = useState(false);

  // ── Action states ─────────────────────────────────────────────────────────
  const [saving,       setSaving      ] = useState(false);
  const [testSending,  setTestSending ] = useState(false);
  const [msg,          setMsg         ] = useState(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tab,          setTab         ] = useState("setup");

  // ── Config form state ─────────────────────────────────────────────────────
  const [dedupEnabled, setDedupEnabled] = useState(true);
  const [gatewayMode,  setGatewayMode ] = useState(false);

  // ── Test event form ───────────────────────────────────────────────────────
  const [eventName, setEventName] = useState("Purchase");
  const [email,     setEmail    ] = useState("");
  const [testVal,   setTestVal  ] = useState("99.99");
  const [currency,  setCurrency ] = useState("USD");

  // Auto-dismiss toast
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  // ── STEP 1: Load accounts on mount ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data, error } = await api.accounts();
      if (error) { setAcctError(extractError(error)); }
      else {
        setAllAccounts(data);
        if (data.length > 0) setSelAccount(data[0]);
      }
      setAcctLoading(false);
    })();
  }, []);

  // ── STEP 2: Load pixels when account changes ──────────────────────────────
  useEffect(() => {
    if (!selAccount?.id) return;
    setSelPixel(null); setAllPixels([]); setSetup(null); setTestInfo(null); setDataError(null);
    loadPixels(selAccount.id);
  }, [selAccount?.id]);

  async function loadPixels(adAccountId) {
    setPixLoading(true);
    const { data, error } = await api.pixels(adAccountId);
    setPixLoading(false);
    if (error) { setMsg({ type:"error", text:`Failed to load pixels: ${error}` }); return; }
    setAllPixels(data);
    if (data.length > 0) setSelPixel(data[0]);
  }

  // ── STEP 3: Load CAPI data when pixel changes ─────────────────────────────
  useEffect(() => {
    if (!selAccount?.id || !selPixel?.id) return;
    loadCapiData(selAccount.id, selPixel.id, false);
  }, [selPixel?.id]);

  async function loadCapiData(adAccountId, pixelId, isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setDataLoading(true);
    setDataError(null);
    const [s, t] = await Promise.all([
      api.capiSetup(adAccountId, pixelId),
      api.capiTestInfo(adAccountId, pixelId),
    ]);
    if (s.error && t.error) {
      setDataError(extractError(s.error));
    } else {
      if (s.data) {
        setSetup(s.data);
        setDedupEnabled(s.data?.config?.deduplicationEnabled ?? true);
        setGatewayMode(s.data?.config?.gatewayMode ?? false);
      }
      if (t.data) setTestInfo(t.data);
    }
    setDataLoading(false); setRefreshing(false);
  }

  // ── Configure CAPI ────────────────────────────────────────────────────────
  async function handleConfigureCapi() {
    if (!selAccount?.id || !selPixel?.id) return;
    setSaving(true);
    const { error } = await api.configureCapi(selAccount.id, selPixel.id, {
      deduplication_enabled: dedupEnabled,
      gateway_mode: gatewayMode,
    });
    setSaving(false);
    if (error) { setMsg({ type:"error", text:extractError(error) }); return; }
    setMsg({ type:"success", text:"CAPI configured — server-side tracking is now active." });
    loadCapiData(selAccount.id, selPixel.id, true);
  }

  // ── Send test event ───────────────────────────────────────────────────────
  async function handleSendTest() {
    if (!selAccount?.id || !selPixel?.id) return;
    setTestSending(true);
    const { data, error } = await api.sendCapiTest(selAccount.id, selPixel.id, {
      event_name: eventName,
      // FIX: use Meta field names (em, not email) so backend hashes PII correctly
      user_data: {
        ...(email ? { em: email } : {}),  // ← "em" not "email"
        external_id: "test_user_123",
      },
      custom_data: { value: parseFloat(testVal) || 0, currency },
      use_test_code: true,
    });
    setTestSending(false);
    if (error) { setMsg({ type:"error", text:extractError(error) }); return; }
    const recv  = data?.meta_result?.events_received;
    const trace = data?.meta_result?.fbtrace_id;
    setMsg({ type:"success", text:`Event sent! Meta received ${recv ?? "?"} event(s).${trace ? ` Trace: ${trace}` : ""}` });
    loadCapiData(selAccount.id, selPixel.id, true);
  }

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

  const config   = setup?.config;
  const isActive = config?.status === "active";
  const pixName  = selPixel?.name || "—";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="cr" style={{ background:C.pageBg, minHeight:"calc(100vh - 64px)" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Subheader ──────────────────────────────────────────────────────── */}
      <div className="cr-subheader">
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"8px 0" }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.text1, letterSpacing:"-0.2px", display:"flex", alignItems:"center", gap:8 }}>
            Conversions API
            {setup && (isActive
              ? <Tag type="active"><Dot color={C.green} pulse/>Live</Tag>
              : <Tag type="warn">Not Configured</Tag>
            )}
          </div>
          <div style={{ fontSize:11.5, color:C.text3, marginTop:2, display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
            <span>Server-side event tracking</span>
            {selAccount?.metaAccountId && <><span style={{ color:C.border }}>·</span><span style={{ fontFamily:"monospace" }}>{selAccount.metaAccountId}</span></>}
            {selPixel && <><span style={{ color:C.border }}>·</span><span>Pixel: <strong style={{ color:C.text2 }}>{pixName}</strong></span></>}
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          {/* Account dropdown */}
          <Dropdown
            items={allAccounts}
            selectedId={selAccount?.id}
            onChange={acc => { if (acc.id !== selAccount?.id) { setSelAccount(acc); setSetup(null); setTestInfo(null); setDataError(null); }}}
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
                  <div style={{ fontSize:10.5, color:C.text4, fontFamily:"monospace", marginTop:1 }}>{a.metaAccountId}{a.currency?` · ${a.currency}`:""}</div>
                </div>
                {s && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1877f2" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </>
            )}
          />

          {/* Pixel dropdown */}
          <Dropdown
            items={allPixels}
            selectedId={selPixel?.id}
            onChange={p => { if (p.id !== selPixel?.id) { setSelPixel(p); setSetup(null); setTestInfo(null); setDataError(null); }}}
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
            onClick={() => selPixel && loadCapiData(selAccount.id, selPixel.id, true)}
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
              <Banner type="error" icon="⚠️" title="Failed to load CAPI data" body={dataError}/>
            </div>
          )}

          {/* Empty state */}
          {!selPixel && !pixLoading && (
            <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, textAlign:"center", padding:"56px 20px" }}>
              <div style={{ fontSize:44, marginBottom:14 }}>📡</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.text2, marginBottom:6 }}>Select a Pixel</div>
              <div style={{ fontSize:13, color:C.text4, maxWidth:340, margin:"0 auto", lineHeight:1.6 }}>
                Choose an ad account and pixel from the dropdowns above to view and configure its Conversions API settings.
              </div>
            </div>
          )}

          {selPixel && (
            <>
              {/* ── 4 stat cards ─────────────────────────────────────────── */}
              <div className="cr-g4" style={{ marginBottom:14 }}>
                <StatCard
                  label="CAPI Status"
                  loading={dataLoading}
                  value={isActive
                    ? <Tag type="active"><Dot color={C.green} pulse/>Active</Tag>
                    : <Tag type="off">Not Configured</Tag>
                  }
                  sub={isActive ? `Version ${setup?.capi_version||"v2"}` : "Setup required"}
                  accent={isActive ? C.green : C.border}
                />
                <StatCard
                  label="Events Sent"
                  loading={dataLoading}
                  value={(config?.totalEventsSent ?? 0).toLocaleString()}
                  sub="Server-side events to Meta"
                  accent={C.blue}
                />
                <StatCard
                  label="Deduplication"
                  loading={dataLoading}
                  value={config?.deduplicationEnabled ? <Tag type="active">Enabled</Tag> : <Tag type="off">Disabled</Tag>}
                  sub="Browser + server matching"
                  accent={C.purple}
                />
                <StatCard
                  label="Test Event Code"
                  loading={dataLoading}
                  value={<span style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:C.teal }}>{config?.testEventCode || "—"}</span>}
                  sub="Use in Meta Events Manager"
                  accent={C.teal}
                />
              </div>

              {/* ── Tabs + panels ────────────────────────────────────────── */}
              <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", marginBottom:14 }}>

                {/* Tab bar */}
                <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, overflowX:"auto" }}>
                  {[
                    { k:"setup", label:"⚙️  Setup"               },
                    { k:"test",  label:"🧪  Send Test Event"      },
                    { k:"guide", label:"📖  Implementation Guide" },
                  ].map(t => (
                    <button key={t.k} className={`cr-tab${tab===t.k?" active":""}`} onClick={() => setTab(t.k)}>{t.label}</button>
                  ))}
                </div>

                {/* ─────────────── SETUP TAB ─────────────────────────────── */}
                {tab === "setup" && (
                  <div style={{ padding:22, display:"flex", flexDirection:"column", gap:20 }}>

                    {dataLoading ? <Skel w="100%" h={52} br={8}/>
                     : isActive
                      ? <Banner type="success" icon="✅" title={`CAPI ${setup?.capi_version||"v2"} is active for "${pixName}"`} body={`Server-side events are flowing to Meta. Deduplication is ${config?.deduplicationEnabled?"enabled":"disabled"}.`}/>
                      : <Banner type="warning" icon="⚠️" title={`CAPI is not configured for "${pixName}"`} body="Set up server-side tracking to recover signal lost to ad blockers and improve Match Quality scores."/>
                    }

                    <div>
                      <div style={{ fontSize:11.5, fontWeight:700, color:C.text3, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Configuration Options</div>
                      <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"0 16px" }}>
                        <ToggleRow
                          label="Event Deduplication"
                          desc="Prevents double-counting when both browser pixel and CAPI fire the same event"
                          checked={dedupEnabled}
                          onChange={setDedupEnabled}
                          disabled={dataLoading || saving}
                        />
                        <ToggleRow
                          label="Signals Gateway Mode"
                          desc="Route events through Meta's Signals Gateway for enhanced privacy compliance"
                          checked={gatewayMode}
                          onChange={setGatewayMode}
                          disabled={dataLoading || saving}
                        />
                      </div>
                    </div>

                    {setup?.endpoint && (
                      <div>
                        <div style={{ fontSize:11.5, fontWeight:700, color:C.text3, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>API Endpoint</div>
                        <CodeBlock>{setup.endpoint}</CodeBlock>
                      </div>
                    )}

                    {isActive && !dataLoading && (
                      <div>
                        <div style={{ fontSize:11.5, fontWeight:700, color:C.text3, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Active Configuration</div>
                        <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"0 16px" }}>
                          <InfoRow label="Pixel / Dataset ID"   value={<span style={{ fontFamily:"monospace", fontSize:12 }}>{selPixel?.metaPixelId}</span>}/>
                          <InfoRow label="Test Event Code"      value={<span style={{ fontFamily:"monospace", color:C.teal }}>{config?.testEventCode||"—"}</span>}/>
                          <InfoRow label="Deduplication"        value={config?.deduplicationEnabled ? <Tag type="active">Enabled</Tag> : <Tag type="off">Disabled</Tag>}/>
                          <InfoRow label="Gateway Mode"         value={config?.gatewayMode ? <Tag type="active">Enabled</Tag> : <Tag type="off">Disabled</Tag>}/>
                        </div>
                      </div>
                    )}

                    <div>
                      <button
                        className={`cr-btn ${isActive ? "cr-btn-green" : "cr-btn-blue"}`}
                        onClick={handleConfigureCapi}
                        disabled={saving || dataLoading}
                      >
                        {saving
                          ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="cr-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Saving…</>
                          : isActive
                            ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Save Changes</>
                            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>Activate CAPI v2</>
                        }
                      </button>
                    </div>
                  </div>
                )}

                {/* ─────────────── TEST TAB ───────────────────────────────── */}
                {tab === "test" && (
                  <div style={{ padding:22, display:"flex", flexDirection:"column", gap:18 }}>

                    {!isActive && !dataLoading && (
                      <Banner type="warning" icon="⚠️" title="Configure CAPI first" body="Go to the Setup tab to activate CAPI before sending test events."/>
                    )}

                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:2 }}>Send a Live Test Event</div>
                      <div style={{ fontSize:12.5, color:C.text3, lineHeight:1.6 }}>
                        Fires a real event directly to Meta. Open{" "}
                        <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener" style={{ color:C.blue }}>Meta Events Manager → Test Events</a>
                        {" "}to verify delivery.
                      </div>
                    </div>

                    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                      <Field label="Event Name" required>
                        <select className="cr-select" value={eventName} onChange={e=>setEventName(e.target.value)} disabled={!isActive||testSending}>
                          {["PageView","Purchase","Lead","AddToCart","InitiateCheckout","CompleteRegistration","ViewContent","Search","Subscribe","Contact"].map(v=>(
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </Field>

                      {/* FIX: label clarifies "em" field requirement */}
                      <Field label="Customer Email" hint="Will be SHA-256 hashed server-side before sending to Meta (sent as field 'em')">
                        <input className="cr-input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="customer@example.com" type="email" disabled={!isActive||testSending}/>
                      </Field>

                      <div className="cr-g2">
                        <Field label="Value">
                          <input className="cr-input" value={testVal} onChange={e=>setTestVal(e.target.value)} placeholder="99.99" type="number" min="0" step="0.01" disabled={!isActive||testSending}/>
                        </Field>
                        <Field label="Currency">
                          <select className="cr-select" value={currency} onChange={e=>setCurrency(e.target.value)} disabled={!isActive||testSending}>
                            {["USD","EUR","GBP","CAD","AUD","JPY","SGD","INR","BRL","MXN"].map(v=>(
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      {/* Payload preview */}
                      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 14px", fontSize:12, color:C.text3 }}>
                        <span style={{ fontWeight:600, color:C.text2 }}>Preview: </span>
                        <code style={{ fontFamily:"monospace" }}>
                          {`{ event:"${eventName}", value:${testVal||"0"} ${currency}${email?`, em:"***@***"`:""} }`}
                        </code>
                      </div>

                      <div>
                        <button
                          className="cr-btn cr-btn-blue"
                          onClick={handleSendTest}
                          disabled={!isActive || testSending || dataLoading}
                        >
                          {testSending
                            ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="cr-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Sending…</>
                            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Send Test Event</>
                          }
                        </button>
                      </div>
                    </div>

                    {/* Recent test sends */}
                    {/* FIX: check status === "sent" (matches what backend saves) */}
                    {(testInfo?.recent_test_sends?.length > 0) && (
                      <div>
                        <div style={{ fontSize:11.5, fontWeight:700, color:C.text3, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Recent Test Sends</div>
                        <div>
                          {testInfo.recent_test_sends.map((ev, i) => (
                            <div key={ev.id||i} className="cr-ev-row">
                              {/* FIX: was checking "success" — backend saves "sent" */}
                              <div style={{ width:7, height:7, borderRadius:"50%", background:ev.status==="sent"?C.green:C.red, flexShrink:0 }}/>
                              <span style={{ fontWeight:600, color:C.text1, flex:1 }}>{ev.eventName}</span>
                              <span style={{ color:C.text4, fontSize:12 }}>
                                {new Date(ev.receivedAt).toLocaleTimeString([],{ hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                              </span>
                              <div>
                                {ev.status==="sent"
                                  ? <Tag type="active">Delivered</Tag>
                                  : <Tag type="off">{ev.status}</Tag>
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─────────────── GUIDE TAB ─────────────────────────────── */}
                {tab === "guide" && (
                  <div style={{ padding:22, display:"flex", flexDirection:"column", gap:20 }}>

                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:2 }}>Implementation Guide</div>
                      <div style={{ fontSize:12.5, color:C.text3 }}>Follow these steps to integrate CAPI into your server and send events directly to Meta.</div>
                    </div>

                    <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 16px" }}>
                      {(setup?.implementation_steps?.length > 0 ? setup.implementation_steps : [
                        "Install the Meta Business SDK: npm install facebook-nodejs-business-sdk",
                        "Initialize FacebookAdsApi with your system user access token",
                        `Create events using Pixel ID: ${selPixel?.metaPixelId || "YOUR_PIXEL_ID"}`,
                        "Hash all PII fields (email, phone, name) using SHA-256 before sending",
                        "Include a unique event_id matching your browser pixel for deduplication",
                        "Test events in Meta Events Manager → Test Events before going live",
                      ]).map((step, i) => (
                        <div key={i} className="cr-step">
                          <div className="cr-step-n">{i+1}</div>
                          <div style={{ fontSize:13, color:C.text2, lineHeight:1.6, paddingTop:2 }}>{step}</div>
                        </div>
                      ))}
                    </div>

                    <CodeBlock label="Example CAPI Payload">
                      {setup?.example_payload || {
                        data: [{
                          event_name: "Purchase",
                          event_time: Math.floor(Date.now()/1000),
                          event_id: "order_12345",
                          action_source: "website",
                          user_data: {
                            em: ["<sha256-hashed-email>"],
                            client_ip_address: "192.168.1.1",
                            client_user_agent: "Mozilla/5.0...",
                          },
                          custom_data: { currency: "USD", value: "99.99", order_id: "order_12345" },
                        }],
                        test_event_code: config?.testEventCode || "TEST12345",
                      }}
                    </CodeBlock>

                    <CodeBlock label="Next.js / Node.js Example">
{`import { FacebookAdsApi, ServerEvent, EventRequest,
         UserData, CustomData } from "facebook-nodejs-business-sdk";

const PIXEL_ID  = "${selPixel?.metaPixelId || "YOUR_PIXEL_ID"}";
const API_TOKEN = process.env.META_CAPI_TOKEN; // system user token

export async function sendPurchaseEvent({ email, value, currency, orderId }) {
  FacebookAdsApi.init(API_TOKEN);

  const userData = new UserData()
    .setEmails([email])           // SDK handles SHA-256 hashing
    .setClientIpAddress(req.headers["x-forwarded-for"])
    .setClientUserAgent(req.headers["user-agent"]);

  const customData = new CustomData()
    .setCurrency(currency)
    .setValue(value)
    .setOrderId(orderId);

  const event = new ServerEvent()
    .setEventName("Purchase")
    .setEventTime(Math.floor(Date.now() / 1000))
    .setEventId(\`order_\${orderId}\`)   // must match browser pixel event_id
    .setActionSource("website")
    .setUserData(userData)
    .setCustomData(customData);

  return new EventRequest(API_TOKEN, PIXEL_ID)
    .setEvents([event])
    .execute();
}`}
                    </CodeBlock>

                    <Banner type="info" icon="💡" title="Best Practices">
                      <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:4 }}>
                        {[
                          "Always use Meta field names: em (email), ph (phone), fn (first name), ln (last name).",
                          "Hash PII with SHA-256 — never send plain-text emails or phone numbers.",
                          "Match event_id between browser pixel and CAPI to enable deduplication.",
                          "Send events within 7 days — Meta ignores anything older.",
                          "Include as many user_data fields as possible to improve Event Match Quality (EMQ).",
                          "Use action_source: 'website' for web, 'app' for mobile, 'physical_store' for offline.",
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
                CAPI for <strong style={{ color:C.text3 }}>{pixName}</strong>
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