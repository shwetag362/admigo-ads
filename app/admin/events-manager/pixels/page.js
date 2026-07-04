
"use client";
// app/dashboard/events-manager/pixel/page.js
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
};

const C = {
  pageBg:"#f0f2f5",white:"#ffffff",border:"#dddfe2",borderLight:"#f0f2f5",
  text1:"#1c1e21",text2:"#444950",text3:"#65676b",text4:"#8a8d91",
  blue:"#1877f2",blueLight:"#e7f3ff",blueBorder:"#bcd4f5",
  green:"#1e7e34",greenLight:"#e6f4ea",greenBorder:"#b7dfbe",
  yellow:"#e65100",yellowLight:"#fff8e1",yellowBorder:"#ffe0b2",
  red:"#c5221f",redLight:"#fce8e6",redBorder:"#f5c6c5",
  purple:"#6b4fbb",purpleLight:"#f0ebff",surface:"#f7f8fa",
  mono:"'SFMono-Regular','Consolas','Liberation Mono','Menlo',monospace",
};

const GLOBAL_CSS = `
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes dropIn{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  *,*::before,*::after{box-sizing:border-box}
  .px-root{font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,sans-serif}
  .px-animate{animation:fadeUp .22s ease both}
  .px-spinning{animation:spin 1s linear infinite}
  .px-drop-anim{animation:dropIn .14s ease both}
  .px-tab-btn{padding:10px 16px;font-size:13px;font-weight:600;color:#65676b;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;transition:color .15s,border-color .15s;margin-bottom:-1px}
  .px-tab-btn:hover{color:#1c1e21}
  .px-tab-btn.active{color:#1877f2;border-bottom-color:#1877f2}
  .px-copy-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:5px;font-size:12px;font-weight:600;background:#fff;border:1px solid #dddfe2;color:#444950;cursor:pointer;transition:background .15s}
  .px-copy-btn:hover{background:#f7f8fa}
  .px-copy-btn.copied{background:#e6f4ea;border-color:#b7dfbe;color:#1e7e34}
  .px-toggle-track{width:36px;height:20px;border-radius:10px;border:none;cursor:pointer;transition:background .2s;flex-shrink:0;position:relative}
  .px-toggle-thumb{position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s}
  .px-event-pill{padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #dddfe2;background:#fff;color:#444950;transition:all .15s;white-space:nowrap}
  .px-event-pill:hover{border-color:#1877f2;color:#1877f2;background:#e7f3ff}
  .px-event-pill.active{border-color:#1877f2;color:#fff;background:#1877f2}
  .px-method-card:hover{border-color:#bcd4f5 !important;background:#f5f9ff !important}
  .px-acct-btn{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #dddfe2;color:#1c1e21;border-radius:7px;padding:6px 11px;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s;white-space:nowrap;max-width:220px}
  .px-acct-btn:hover{background:#f7f8fa;border-color:#bcd4f5}
  .px-acct-btn.open{border-color:#1877f2;background:#e7f3ff;color:#1877f2;box-shadow:0 0 0 3px rgba(24,119,242,.10)}
  .px-acct-drop{position:absolute;top:calc(100% + 6px);left:0;min-width:260px;max-width:340px;background:#fff;border:1px solid #dddfe2;border-radius:8px;box-shadow:0 6px 28px rgba(0,0,0,.13);z-index:500;overflow:hidden}
  .px-acct-item{display:flex;align-items:center;gap:10px;padding:9px 13px;cursor:pointer;transition:background .1s;border-bottom:1px solid #f0f2f5}
  .px-acct-item:last-child{border-bottom:none}
  .px-acct-item:hover{background:#f7f8fa}
  .px-acct-item.selected{background:#e7f3ff}
  .px-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .px-table-wrap table{min-width:480px}
  .px-subheader{background:#fff;border-bottom:1px solid #dddfe2;padding:8px 24px;display:flex;align-items:center;justify-content:space-between;min-height:52px;flex-wrap:wrap;gap:8px}
  .px-subheader-left{display:flex;flex-direction:column;justify-content:center;padding:8px 0}
  .px-subheader-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
  .px-body{padding:18px 0px;max-width:1280px;margin:0 auto}
  .px-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
  .px-tab-bar{display:flex;border-bottom:1px solid #dddfe2;overflow-x:auto;scrollbar-width:none}
  .px-tab-bar::-webkit-scrollbar{display:none}
  .px-events-pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
  @media(max-width:960px){.px-grid4{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:600px){.px-grid4{grid-template-columns:repeat(2,1fr);gap:10px}.px-body{padding:14px}.px-subheader{padding:8px 14px}.px-stat-value{font-size:20px !important}.px-stat-label{font-size:10px !important}}
  @media(max-width:400px){.px-grid4{grid-template-columns:1fr}.px-body{padding:10px}}
`;

const TH_S = { padding:"9px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.text3, textTransform:"uppercase", letterSpacing:"0.5px", background:C.surface, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" };
const TD_S = { padding:"11px 14px", fontSize:13, color:C.text1, borderBottom:`1px solid ${C.borderLight}`, verticalAlign:"middle" };

function getInitials(name=""){return name.split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||"").join("")||"?"}

function badgeStyle(type){
  const map={
    active:{bg:C.greenLight,color:C.green,border:C.greenBorder},
    inactive:{bg:C.pageBg,color:C.text3,border:C.border},
    warning:{bg:C.yellowLight,color:C.yellow,border:C.yellowBorder},
    error:{bg:C.redLight,color:C.red,border:C.redBorder},
    info:{bg:"#e8f0fe",color:"#1a73e8",border:"#c5d8fd"},
    high:{bg:C.greenLight,color:C.green,border:C.greenBorder},
    medium:{bg:"#fff8e1",color:"#b45309",border:"#fde68a"},
    low:{bg:C.pageBg,color:C.text3,border:C.border},
  };
  const t=map[type]||map.inactive;
  return{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700,background:t.bg,color:t.color,border:`1px solid ${t.border}`,whiteSpace:"nowrap",lineHeight:1.6};
}

function Dot({color}){return <span style={{display:"inline-block",width:5,height:5,borderRadius:"50%",background:color,flexShrink:0}}/>}

const skBase={borderRadius:5,background:"linear-gradient(90deg,#e4e6eb 25%,#f0f2f5 50%,#e4e6eb 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"};
function Skel({w="100%",h=14,mb=0}){return <div style={{...skBase,width:w,height:h,marginBottom:mb}}/>}

function HoverRow({children}){
  const [hov,setHov]=useState(false);
  return <tr onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{background:hov?C.surface:C.white,transition:"background .1s"}}>{children}</tr>;
}

function EmptyState({icon,title,sub}){
  return(
    <div style={{textAlign:"center",padding:"36px 20px"}}>
      <div style={{fontSize:32,marginBottom:10}}>{icon}</div>
      <div style={{fontSize:13,fontWeight:700,color:C.text2,marginBottom:4}}>{title}</div>
      {sub&&<div style={{fontSize:12,color:C.text4}}>{sub}</div>}
    </div>
  );
}

function TabLoader(){
  return(
    <div style={{padding:24}}>
      <Skel h={14} mb={12} w="60%"/>
      <Skel h={120} mb={12}/>
      <Skel h={14} mb={8} w="40%"/>
      <Skel h={80}/>
    </div>
  );
}

// ─── Account Dropdown ─────────────────────────────────────────────────────────
function AccountDropdown({accounts,selectedId,onChange,loading}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  const selected=accounts.find(a=>a.id===selectedId);
  useEffect(()=>{
    function h(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false)}
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  if(loading)return <div style={{...skBase,width:180,height:32,borderRadius:7}}/>;
  if(!accounts.length)return(
    <div style={{display:"inline-flex",alignItems:"center",gap:6,background:C.redLight,border:`1px solid ${C.redBorder}`,borderRadius:7,padding:"6px 11px",fontSize:12,fontWeight:600,color:C.red}}>
      <span>⚠️</span>No accounts connected
    </div>
  );
  return(
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <button className={`px-acct-btn${open?" open":""}`} onClick={()=>setOpen(o=>!o)} title={selected?.name}>
        <div style={{width:20,height:20,borderRadius:4,flexShrink:0,background:open?"#1877f2":"#e4e6eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:open?"#fff":"#444950",transition:"background .15s,color .15s"}}>
          {getInitials(selected?.name)}
        </div>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{selected?.name||"Select account"}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{flexShrink:0,transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform .15s"}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open&&(
        <div className="px-acct-drop px-drop-anim">
          <div style={{padding:"8px 13px 6px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:10.5,fontWeight:700,color:C.text4,textTransform:"uppercase",letterSpacing:"0.5px"}}>Ad Accounts ({accounts.length})</div>
          </div>
          <div style={{maxHeight:280,overflowY:"auto"}}>
            {accounts.map(acc=>(
              <div key={acc.id} className={`px-acct-item${acc.id===selectedId?" selected":""}`} onClick={()=>{onChange(acc);setOpen(false)}}>
                <div style={{width:30,height:30,borderRadius:6,flexShrink:0,background:acc.id===selectedId?"#1877f2":"#e4e6eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:acc.id===selectedId?"#fff":"#65676b"}}>
                  {getInitials(acc.name)}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:acc.id===selectedId?C.blue:C.text1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{acc.name}</div>
                  <div style={{fontSize:10.5,color:C.text4,fontFamily:"monospace",marginTop:1}}>{acc.metaAccountId}{acc.currency?` · ${acc.currency}`:""}</div>
                </div>
                {acc.id===selectedId&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1877f2" strokeWidth="2.5" style={{flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({label,value,sub,accent=C.blue}){
  return(
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 16px 14px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent,borderRadius:"8px 8px 0 0"}}/>
      <div className="px-stat-label" style={{fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:8}}>{label}</div>
      <div className="px-stat-value" style={{fontSize:24,fontWeight:800,color:C.text1,lineHeight:1,letterSpacing:"-0.4px",marginBottom:6}}>{value??"—"}</div>
      {sub&&<div style={{fontSize:11.5,color:C.text4,lineHeight:1.4}}>{sub}</div>}
    </div>
  );
}

function EMQBar({score}){
  if(score==null)return <span style={{color:C.text4}}>—</span>;
  const color=score>=7?C.green:score>=5?C.yellow:C.red;
  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:80,height:5,background:"#e4e6eb",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${(score/10)*100}%`,height:"100%",background:color,borderRadius:3}}/>
      </div>
      <span style={{fontFamily:C.mono,fontSize:12.5,fontWeight:700,color}}>{score.toFixed(1)}/10</span>
    </div>
  );
}

function CodeBlock({label,children}){
  const [copied,setCopied]=useState(false);
  function copy(){if(!children)return;navigator.clipboard.writeText(children).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})}
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        {label&&<div style={{fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</div>}
        <button className={`px-copy-btn${copied?" copied":""}`} onClick={copy}>
          {copied
            ?<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
            :<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
          }
        </button>
      </div>
      <pre style={{background:"#1c1e21",color:"#e4e6eb",borderRadius:8,padding:"16px 18px",fontSize:12,lineHeight:1.7,fontFamily:C.mono,overflow:"auto",margin:0,border:"1px solid #3a3d42",maxHeight:320,whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
        <code>{children||"// No code available"}</code>
      </pre>
    </div>
  );
}

function Toggle({label,desc,value,onChange,disabled}){
  return(
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"14px 0",borderBottom:`1px solid ${C.borderLight}`}}>
      <div style={{flex:1}}>
        {label&&<div style={{fontSize:13.5,fontWeight:600,color:C.text1,marginBottom:3}}>{label}</div>}
        {desc&&<div style={{fontSize:12,color:C.text3,lineHeight:1.5}}>{desc}</div>}
      </div>
      <button className="px-toggle-track" style={{background:value?C.blue:"#ccd0d5",opacity:disabled?0.5:1,cursor:disabled?"not-allowed":"pointer"}} onClick={()=>!disabled&&onChange(!value)} disabled={disabled} aria-pressed={value}>
        <div className="px-toggle-thumb" style={{left:value?18:2}}/>
      </button>
    </div>
  );
}

function AlertBanner({type="info",children,onClose}){
  const map={success:{bg:C.greenLight,border:C.greenBorder,color:C.green,icon:"✅"},error:{bg:C.redLight,border:C.redBorder,color:C.red,icon:"❌"},warning:{bg:C.yellowLight,border:C.yellowBorder,color:C.yellow,icon:"⚠️"},info:{bg:C.blueLight,border:C.blueBorder,color:C.blue,icon:"ℹ️"}};
  const t=map[type]||map.info;
  return(
    <div style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"11px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:14,fontSize:13}}>
      <span style={{flexShrink:0}}>{t.icon}</span>
      <span style={{color:t.color,fontWeight:500,flex:1}}>{children}</span>
      {onClose&&<button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:t.color,fontSize:16,lineHeight:1,padding:0,flexShrink:0}}>×</button>}
    </div>
  );
}

function LoadingSkeleton(){
  return(
    <div className="px-root" style={{background:C.pageBg,minHeight:"calc(100vh - 64px)"}}>
      <div className="px-subheader" style={{padding:"13px 24px"}}>
        <div><Skel w={140} h={15} mb={6}/><Skel w={200} h={10}/></div>
        <div style={{display:"flex",gap:8}}><Skel w={180} h={32}/><Skel w={90} h={32}/></div>
      </div>
      <div className="px-body">
        <div className="px-grid4" style={{marginBottom:18}}>
          {[...Array(4)].map((_,i)=>(
            <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 16px 14px"}}>
              <Skel w="50%" h={10} mb={10}/><Skel w="65%" h={22} mb={8}/><Skel w="40%" h={9}/>
            </div>
          ))}
        </div>
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8}}>
          <div style={{padding:"0 24px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:16}}>
            {[80,100,120,80,90,75].map((w,i)=><div key={i} style={{padding:"12px 0"}}><Skel w={w} h={12}/></div>)}
          </div>
          <div style={{padding:24}}><Skel h={200}/></div>
        </div>
      </div>
    </div>
  );
}

function DataLoadingSkeleton(){
  return(
    <div className="px-body">
      <div className="px-grid4" style={{marginBottom:18}}>
        {[...Array(4)].map((_,i)=>(
          <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 16px 14px"}}>
            <Skel w="50%" h={10} mb={10}/><Skel w="65%" h={22} mb={8}/><Skel w="40%" h={9}/>
          </div>
        ))}
      </div>
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8}}>
        <div style={{padding:"0 24px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:16}}>
          {[80,100,120,80,90,75].map((w,i)=><div key={i} style={{padding:"12px 0"}}><Skel w={w} h={12}/></div>)}
        </div>
        <div style={{padding:24}}><Skel h={200}/></div>
      </div>
    </div>
  );
}

function NoAccountsScreen(){
  return(
    <div className="px-root" style={{background:C.pageBg,minHeight:"calc(100vh - 64px)"}}>
      <style>{GLOBAL_CSS}</style>
      <div className="px-body" style={{paddingTop:48,display:"flex",justifyContent:"center"}}>
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"44px 36px",textAlign:"center",maxWidth:460,width:"100%"}}>
          <div style={{fontSize:52,marginBottom:18}}>📡</div>
          <div style={{fontSize:18,fontWeight:800,color:C.text1,marginBottom:10}}>No Ad Accounts Connected</div>
          <div style={{fontSize:13.5,color:C.text3,lineHeight:1.65,marginBottom:28}}>You don't have any Meta ad accounts linked yet.</div>
          <a href="/dashboard/settings" style={{display:"inline-flex",alignItems:"center",gap:7,background:C.blue,color:"#fff",borderRadius:7,padding:"10px 20px",fontSize:13.5,fontWeight:700,textDecoration:"none"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Connect Facebook Account
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PixelPage(){
  const [tab,           setTab          ]=useState("code");
  const [data,          setData         ]=useState(null);      // /pixel/setup
  const [amData,        setAmData       ]=useState(null);      // /pixel/advanced-matching
  const [eventsData,    setEventsData   ]=useState(null);      // /pixel/events
  const [amLoading,     setAmLoading    ]=useState(false);
  const [eventsLoading, setEventsLoading]=useState(false);
  const [saving,        setSaving       ]=useState(false);
  const [msg,           setMsg          ]=useState(null);
  const [selectedEvent, setSelectedEvent]=useState(null);

  const [allAccounts,     setAllAccounts    ]=useState([]);
  const [accountsLoading, setAccountsLoading]=useState(true);
  const [accountsError,   setAccountsError  ]=useState(null);
  const [selectedAccount, setSelectedAccount]=useState(null);
  const [dataLoading,     setDataLoading    ]=useState(false);
  const [dataError,       setDataError      ]=useState(null);
  const [refreshing,      setRefreshing     ]=useState(false);

  // ── Load accounts on mount ────────────────────────────────────────────────
  useEffect(()=>{
    async function loadAccounts(){
      log.group("📡 [Pixel] Load accounts");
      try{
        const res=await fetch("/api/meta-accounts");
        const json=await res.json();
        if(res.status===401)throw new Error("Not authenticated.");
        if(!res.ok)throw new Error(json.error||"Failed to load accounts");
        const accounts=json.accounts||[];
        log.ok(`${accounts.length} account(s) loaded`);
        setAllAccounts(accounts);
        if(accounts.length>0)setSelectedAccount(accounts[0]);
      }catch(err){
        log.error("Load accounts failed",err.message);
        setAccountsError(err.message);
      }finally{
        setAccountsLoading(false);
        log.end();
      }
    }
    loadAccounts();
  },[]);

  // ── Fetch setup when account changes ─────────────────────────────────────
  useEffect(()=>{
    if(!selectedAccount?.id)return;
    fetchSetup(selectedAccount.id,false);
    setAmData(null);
    setEventsData(null);
  },[selectedAccount?.id]);

  // ── Lazy-load AM / Events tabs on first visit ─────────────────────────────
  useEffect(()=>{
    if(!selectedAccount?.id)return;
    if(tab==="advanced-matching"&&!amData&&!amLoading)fetchAmData(selectedAccount.id);
    if(tab==="events"&&!eventsData&&!eventsLoading)fetchEventsData(selectedAccount.id);
  },[tab,selectedAccount?.id]);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  async function fetchSetup(adAccountId,isRefresh=false){
    if(isRefresh)setRefreshing(true);
    else setDataLoading(true);
    setDataError(null);
    log.group(`📡 [Pixel] fetchSetup — ${adAccountId}`);
    try{
      const res=await fetch(`/api/events-manager/pixel/setup?adAccountId=${adAccountId}`);
      const json=await res.json();
      if(!res.ok||!json.success)throw new Error(json.error||`HTTP ${res.status}`);
      log.ok("Setup loaded",json.pixel?.name);
      setData(json);
      const evs=Object.keys(json.setup?.event_snippets||{});
      if(evs.length>0)setSelectedEvent(ev=>ev||evs[0]);
    }catch(err){
      log.error("fetchSetup failed",err.message);
      setDataError(err.message);
    }finally{
      setDataLoading(false);
      setRefreshing(false);
      log.end();
    }
  }

  async function fetchAmData(adAccountId){
    setAmLoading(true);
    log.group(`📡 [Pixel] fetchAmData — ${adAccountId}`);
    try{
      const res=await fetch(`/api/events-manager/pixel/advanced-matching?adAccountId=${adAccountId}`);
      const json=await res.json();
      if(!res.ok||!json.success)throw new Error(json.error||`HTTP ${res.status}`);
      log.ok("AM data loaded");
      setAmData(json);
    }catch(err){
      log.error("fetchAmData failed",err.message);
      setAmData({error:err.message});
    }finally{
      setAmLoading(false);
      log.end();
    }
  }

  async function fetchEventsData(adAccountId){
    setEventsLoading(true);
    log.group(`📡 [Pixel] fetchEventsData — ${adAccountId}`);
    try{
      const res=await fetch(`/api/events-manager/pixel/events?adAccountId=${adAccountId}`);
      const json=await res.json();
      if(!res.ok||!json.success)throw new Error(json.error||`HTTP ${res.status}`);
      log.ok("Events loaded",json.summary);
      setEventsData(json);
    }catch(err){
      log.error("fetchEventsData failed",err.message);
      setEventsData({error:err.message});
    }finally{
      setEventsLoading(false);
      log.end();
    }
  }

  function handleAccountChange(acc){
    if(acc.id===selectedAccount?.id)return;
    log.info("Account switched →",acc.name);
    setData(null);setAmData(null);setEventsData(null);
    setDataError(null);setSelectedEvent(null);
    setSelectedAccount(acc);
  }

  async function toggleAM(val){
    if(!selectedAccount?.id)return;
    setSaving(true);
    log.group("📡 [Pixel] toggleAM →",val);
    try{
      const res=await fetch(`/api/events-manager/pixel/advanced-matching?adAccountId=${selectedAccount.id}`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:val}),
      });
      const json=await res.json();
      if(!res.ok||!json.success)throw new Error(json.error||"Failed to update");
      setMsg({type:"success",text:"Advanced Matching updated"});
      fetchSetup(selectedAccount.id,true);
      setAmData(null);
      if(tab==="advanced-matching")fetchAmData(selectedAccount.id);
    }catch(err){
      setMsg({type:"error",text:err.message});
    }finally{
      setSaving(false);log.end();
    }
  }

  async function toggleAutoEvents(val){
    if(!selectedAccount?.id)return;
    setSaving(true);
    log.group("📡 [Pixel] toggleAutoEvents →",val);
    try{
      const res=await fetch(`/api/events-manager/pixel/setup?adAccountId=${selectedAccount.id}`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({automatic_events_enabled:val}),
      });
      const json=await res.json();
      if(!res.ok||!json.success)throw new Error(json.error||"Failed to update");
      setMsg({type:"success",text:"Automatic Events updated"});
      fetchSetup(selectedAccount.id,true);
    }catch(err){
      setMsg({type:"error",text:err.message});
    }finally{
      setSaving(false);log.end();
    }
  }

  // ── Render guards ─────────────────────────────────────────────────────────
  if(accountsLoading)return <><style>{GLOBAL_CSS}</style><LoadingSkeleton/></>;

  if(accountsError)return(
    <div className="px-root" style={{background:C.pageBg,minHeight:"calc(100vh - 64px)"}}>
      <style>{GLOBAL_CSS}</style>
      <div className="px-body" style={{paddingTop:20}}>
        <div style={{background:C.redLight,border:`1px solid ${C.redBorder}`,borderRadius:8,padding:"14px 18px",display:"flex",gap:12}}>
          <span style={{fontSize:20}}>⚠️</span>
          <div>
            <div style={{fontSize:13.5,fontWeight:700,color:C.red,marginBottom:3}}>Failed to load accounts</div>
            <div style={{fontSize:12.5,color:C.red,opacity:0.85}}>{accountsError}</div>
          </div>
        </div>
      </div>
    </div>
  );

  if(!allAccounts.length)return <NoAccountsScreen/>;

  const px=data?.pixel;
  const setup=data?.setup;
  const eventKeys=Object.keys(setup?.event_snippets||{});
  const emq=px?.eventMatchQualityScore;

  const TABS=[
    {key:"code",              label:"Base Code"},
    {key:"snippets",          label:"Event Snippets"},
    {key:"advanced-matching", label:"Advanced Matching"},
    {key:"events",            label:"Events"},
    {key:"methods",           label:"Setup Methods"},
    {key:"settings",          label:"Settings"},
  ];

  return(
    <div className="px-root" style={{background:C.pageBg,minHeight:"calc(100vh - 64px)"}}>
      <style>{GLOBAL_CSS}</style>

      {/* Sub-header */}
      <div className="px-subheader">
        <div className="px-subheader-left">
          <div style={{fontSize:15,fontWeight:700,color:C.text1,letterSpacing:"-0.2px",lineHeight:1.3}}>Pixel Setup</div>
          {px&&(
            <div style={{fontSize:11.5,color:C.text3,marginTop:2,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
              <span>{px.name}</span>
              {px.metaPixelId&&(
                <><span style={{color:C.border}}>·</span>
                <span style={{fontFamily:C.mono,fontSize:11,background:C.surface,padding:"1px 5px",borderRadius:3,border:`1px solid ${C.border}`}}>{px.metaPixelId}</span></>
              )}
            </div>
          )}
        </div>
        <div className="px-subheader-right">
          <AccountDropdown accounts={allAccounts} selectedId={selectedAccount?.id} onChange={handleAccountChange} loading={accountsLoading}/>
          {px?.status==="active"&&<span style={badgeStyle("active")}><Dot color={C.green}/>Active</span>}
          <button
            disabled={refreshing||dataLoading||!selectedAccount}
            onClick={()=>{fetchSetup(selectedAccount.id,true);setAmData(null);setEventsData(null);}}
            style={{display:"inline-flex",alignItems:"center",gap:6,background:C.white,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 11px",fontSize:12.5,fontWeight:600,color:C.text1,cursor:"pointer",opacity:(refreshing||dataLoading)?0.55:1}}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={refreshing?"px-spinning":""}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            {refreshing?"Refreshing…":"Refresh"}
          </button>
        </div>
      </div>

      <EventsManagerShell>

        {dataLoading&&<DataLoadingSkeleton/>}

        {!dataLoading&&dataError&&(
          <div className="px-body">
            <div style={{background:C.redLight,border:`1px solid ${C.redBorder}`,borderRadius:8,padding:"14px 18px",display:"flex",alignItems:"flex-start",gap:12}}>
              <span style={{fontSize:20,flexShrink:0}}>⚠️</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13.5,fontWeight:700,color:C.red,marginBottom:3}}>Failed to load pixel data</div>
                <div style={{fontSize:12.5,color:C.red,opacity:0.85}}>{dataError}</div>
              </div>
              <button onClick={()=>fetchSetup(selectedAccount.id,true)} style={{display:"inline-flex",alignItems:"center",gap:6,background:C.white,border:`1px solid ${C.redBorder}`,borderRadius:6,padding:"6px 12px",fontSize:12.5,fontWeight:600,color:C.red,cursor:"pointer",flexShrink:0}}>
                Retry
              </button>
            </div>
          </div>
        )}

        {!dataLoading&&!dataError&&data&&(
          <div className="px-body px-animate">

            {msg&&<AlertBanner type={msg.type} onClose={()=>setMsg(null)}>{msg.text}</AlertBanner>}

            {/* Stat cards */}
            <div className="px-grid4">
              <StatCard label="Status" value={px?.status==="active"?"Active":px?.status??"—"} sub={px?.status==="active"?"Receiving events":"Check your implementation"} accent={px?.status==="active"?C.green:C.red}/>
              <StatCard label="Match Quality" value={emq!=null?`${emq.toFixed(1)}/10`:"—"} sub={emq==null?"No events yet":emq>=7?"🟢 Good — strong signal":emq>=5?"🟡 Moderate":"🔴 Low — action required"} accent="#f5a623"/>
              <StatCard label="Total Events" value={px?.totalEventsReceived?.toLocaleString()??"0"} sub="All time events received" accent={C.blue}/>
              <StatCard label="Last Fired" value={px?.lastFiredTime?new Date(px.lastFiredTime).toLocaleDateString([],{month:"short",day:"numeric"}):"Never"} sub={px?.lastFiredTime?new Date(px.lastFiredTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"No events recorded yet"} accent={C.purple}/>
            </div>

            {/* Tab panel */}
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>

              {/* Tab bar */}
              <div className="px-tab-bar" style={{padding:"0 18px"}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`px-tab-btn${tab===t.key?" active":""}`} onClick={()=>setTab(t.key)}>{t.label}</button>
                ))}
              </div>

              {/* ── Base Code ────────────────────────────────────────────── */}
              {tab==="code"&&(
                <div style={{padding:20}}>
                  <div style={{fontSize:13,color:C.text3,marginBottom:16,lineHeight:1.6}}>
                    Copy into the <code style={{fontFamily:C.mono,fontSize:12,background:C.surface,padding:"1px 5px",borderRadius:3,border:`1px solid ${C.border}`}}>&lt;head&gt;</code> of every page.
                  </div>
                  <CodeBlock label="Base Pixel Code">{setup?.base_code}</CodeBlock>
                  <CodeBlock label="NoScript Fallback (place immediately after <body>)">{setup?.noscript_tag}</CodeBlock>
                  <div style={{background:C.blueLight,border:`1px solid ${C.blueBorder}`,borderRadius:8,padding:"12px 16px",display:"flex",gap:10,fontSize:12.5}}>
                    <span style={{flexShrink:0}}>ℹ️</span>
                    <span style={{color:"#1a3a6e"}}>Base code goes before <strong>&lt;/head&gt;</strong>. Noscript tag goes immediately after opening <strong>&lt;body&gt;</strong>.</span>
                  </div>
                </div>
              )}

              {/* ── Event Snippets ───────────────────────────────────────── */}
              {tab==="snippets"&&(
                <div style={{padding:20}}>
                  <div style={{fontSize:13,color:C.text3,marginBottom:14,lineHeight:1.6}}>Select a standard event to see its implementation code.</div>
                  <div className="px-events-pills">
                    {eventKeys.map(key=>(
                      <button key={key} className={`px-event-pill${selectedEvent===key?" active":""}`} onClick={()=>setSelectedEvent(key)}>{key}</button>
                    ))}
                  </div>
                  {selectedEvent&&(
                    <>
                      <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text1}}>
                          {selectedEvent}<span style={{marginLeft:8,...badgeStyle("info")}}>Standard Event</span>
                        </div>
                      </div>
                      <CodeBlock label={`${selectedEvent} — Pixel Code`}>{setup?.event_snippets?.[selectedEvent]}</CodeBlock>
                    </>
                  )}
                  {eventKeys.length===0&&<EmptyState icon="📭" title="No event snippets available"/>}
                </div>
              )}

              {/* ── Advanced Matching ────────────────────────────────────── */}
              {tab==="advanced-matching"&&(
                <div style={{padding:20}}>
                  {amLoading&&<TabLoader/>}
                  {!amLoading&&amData?.error&&<AlertBanner type="error">{amData.error}</AlertBanner>}
                  {!amLoading&&amData&&!amData.error&&(
                    <div>
                      {/* Header + master toggle */}
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,marginBottom:20,flexWrap:"wrap"}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:C.text1,marginBottom:4}}>Advanced Matching</div>
                          <div style={{fontSize:12.5,color:C.text3,lineHeight:1.6,maxWidth:560}}>
                            Send hashed customer identifiers (email, phone, etc.) with each pixel event to improve attribution and raise your Event Match Quality score.
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                          <span style={{fontSize:12.5,fontWeight:600,color:amData.enabled?C.green:C.text3}}>{amData.enabled?"Enabled":"Disabled"}</span>
                          <button
                            className="px-toggle-track"
                            style={{background:amData.enabled?C.blue:"#ccd0d5",opacity:saving?0.5:1,cursor:saving?"not-allowed":"pointer"}}
                            onClick={()=>!saving&&toggleAM(!amData.enabled)}
                            disabled={saving}
                            aria-pressed={amData.enabled}
                          >
                            <div className="px-toggle-thumb" style={{left:amData.enabled?18:2}}/>
                          </button>
                        </div>
                      </div>

                      {/* EMQ score */}
                      {amData.event_match_quality_score!=null&&(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",marginBottom:20}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Event Match Quality</div>
                          <EMQBar score={amData.event_match_quality_score}/>
                          <div style={{fontSize:12,color:C.text4,marginTop:8,lineHeight:1.5}}>
                            {amData.event_match_quality_score>=7?"Strong match signals — keep Advanced Matching enabled.":amData.event_match_quality_score>=5?"Moderate quality — send more identifiers to improve.":"Low quality — enable Advanced Matching and verify pixel fires on all key pages."}
                          </div>
                        </div>
                      )}

                      {/* Pixel init code */}
                      {amData.implementation?.pixel_init&&(
                        <div style={{marginBottom:20}}>
                          <CodeBlock label="fbq('init') with Advanced Matching">{amData.implementation.pixel_init}</CodeBlock>
                        </div>
                      )}

                      {/* CAPI user_data example */}
                      {amData.implementation?.capi_user_data&&(
                        <div style={{marginBottom:20}}>
                          <CodeBlock label="CAPI user_data object">{amData.implementation.capi_user_data}</CodeBlock>
                        </div>
                      )}

                      {/* Identifiers table */}
                      {amData.identifiers?.length>0&&(
                        <div style={{marginBottom:20}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Supported Identifiers ({amData.identifiers.length})</div>
                          <div className="px-table-wrap" style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse"}}>
                              <thead>
                                <tr>{["Meta Key","Label","Field Name","Signal Weight","Hash Before Send"].map(h=><th key={h} style={TH_S}>{h}</th>)}</tr>
                              </thead>
                              <tbody>
                                {amData.identifiers.map(id=>(
                                  <HoverRow key={id.key}>
                                    <td style={TD_S}><code style={{fontFamily:C.mono,fontSize:11,background:C.surface,padding:"1px 5px",borderRadius:3,border:`1px solid ${C.border}`}}>{id.key}</code></td>
                                    <td style={{...TD_S,fontWeight:600}}>{id.label}</td>
                                    <td style={TD_S}><code style={{fontFamily:C.mono,fontSize:11,color:C.text3}}>{id.field}</code></td>
                                    <td style={TD_S}><span style={badgeStyle(id.weight)}>{id.weight}</span></td>
                                    <td style={TD_S}>
                                      {id.hash_before_send
                                        ?<span style={badgeStyle("active")}><Dot color={C.green}/>Yes — SHA-256</span>
                                        :<span style={badgeStyle("inactive")}>No — raw value</span>
                                      }
                                    </td>
                                  </HoverRow>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* How it works */}
                      {amData.how_it_works?.length>0&&(
                        <div style={{background:C.blueLight,border:`1px solid ${C.blueBorder}`,borderRadius:8,padding:"14px 16px"}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>How Advanced Matching Works</div>
                          <div style={{display:"flex",flexDirection:"column",gap:7}}>
                            {amData.how_it_works.map((s,i)=>(
                              <div key={i} style={{display:"flex",gap:10,fontSize:12.5,color:"#1a3a6e"}}>
                                <span style={{fontWeight:700,flexShrink:0}}>{i+1}.</span><span>{s}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Events ──────────────────────────────────────────────── */}
              {tab==="events"&&(
                <div style={{padding:20}}>
                  {eventsLoading&&<TabLoader/>}
                  {!eventsLoading&&eventsData?.error&&<AlertBanner type="error">{eventsData.error}</AlertBanner>}
                  {!eventsLoading&&eventsData&&!eventsData.error&&(
                    <div>
                      {/* Summary mini-cards */}
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
                        {[
                          {label:"Standard Events Tracked", value:eventsData.summary?.standard_event_types_tracked??0, accent:C.blue},
                          {label:"Custom Events",           value:eventsData.summary?.custom_events_defined??0,         accent:C.purple},
                          {label:"Custom Conversions",      value:eventsData.summary?.custom_conversions_defined??0,    accent:"#f5a623"},
                        ].map(s=>(
                          <div key={s.label} style={{flex:"1 1 140px",background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",position:"relative",overflow:"hidden"}}>
                            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:s.accent,borderRadius:"8px 8px 0 0"}}/>
                            <div style={{fontSize:10,fontWeight:700,color:C.text4,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:4}}>{s.label}</div>
                            <div style={{fontSize:22,fontWeight:800,color:C.text1}}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Time range */}
                      {eventsData.last_fired_time&&(
                        <div style={{fontSize:12,color:C.text4,marginBottom:16}}>
                          Last fired: <strong style={{color:C.text2}}>{new Date(eventsData.last_fired_time).toLocaleString()}</strong>
                          <span style={{margin:"0 10px",color:C.border}}>·</span>
                          Range: {new Date(Number(eventsData.time_range?.since)*1000).toLocaleDateString()} – {new Date(Number(eventsData.time_range?.until)*1000).toLocaleDateString()}
                        </div>
                      )}

                      {/* Standard events */}
                      <div style={{marginBottom:20}}>
                        <div style={{fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Standard Events from Meta ({eventsData.standard_events?.length??0})</div>
                        {eventsData.standard_events?.length>0?(
                          <div className="px-table-wrap" style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse"}}>
                              <thead><tr>{["Event Name","Count","Last Seen"].map(h=><th key={h} style={TH_S}>{h}</th>)}</tr></thead>
                              <tbody>
                                {eventsData.standard_events.map((ev,i)=>(
                                  <HoverRow key={i}>
                                    <td style={{...TD_S,fontWeight:600}}>{ev.event_name}</td>
                                    <td style={TD_S}>{ev.count?.toLocaleString()??"—"}</td>
                                    <td style={{...TD_S,fontSize:12,color:C.text3}}>{ev.last_seen?new Date(ev.last_seen).toLocaleDateString():"—"}</td>
                                  </HoverRow>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ):<EmptyState icon="📊" title="No standard events recorded yet" sub="Fire pixel events on your website to see them here."/>}
                      </div>

                      {/* Custom events (local DB) */}
                      <div style={{marginBottom:20}}>
                        <div style={{fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Custom Events ({eventsData.custom_events_local?.length??0})</div>
                        {eventsData.custom_events_local?.length>0?(
                          <div className="px-table-wrap" style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse"}}>
                              <thead><tr>{["Name","Status","Last Seen","Created"].map(h=><th key={h} style={TH_S}>{h}</th>)}</tr></thead>
                              <tbody>
                                {eventsData.custom_events_local.map((ev,i)=>(
                                  <HoverRow key={i}>
                                    <td style={{...TD_S,fontWeight:600}}>{ev.name}</td>
                                    <td style={TD_S}><span style={badgeStyle(ev.status==="active"?"active":"inactive")}>{ev.status}</span></td>
                                    <td style={{...TD_S,fontSize:12,color:C.text3}}>{ev.lastSeenAt?new Date(ev.lastSeenAt).toLocaleDateString():"—"}</td>
                                    <td style={{...TD_S,fontSize:12,color:C.text3}}>{ev.createdAt?new Date(ev.createdAt).toLocaleDateString():"—"}</td>
                                  </HoverRow>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ):<EmptyState icon="🎯" title="No custom events defined" sub="Create custom events to track actions specific to your business."/>}
                      </div>

                      {/* Custom conversions */}
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Custom Conversions ({eventsData.custom_conversions?.length??0})</div>
                        {eventsData.custom_conversions?.length>0?(
                          <div className="px-table-wrap" style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse"}}>
                              <thead><tr>{["Name","Status","Created"].map(h=><th key={h} style={TH_S}>{h}</th>)}</tr></thead>
                              <tbody>
                                {eventsData.custom_conversions.map((cv,i)=>(
                                  <HoverRow key={i}>
                                    <td style={{...TD_S,fontWeight:600}}>{cv.name}</td>
                                    <td style={TD_S}><span style={badgeStyle(cv.status==="active"?"active":"inactive")}>{cv.status}</span></td>
                                    <td style={{...TD_S,fontSize:12,color:C.text3}}>{cv.createdAt?new Date(cv.createdAt).toLocaleDateString():"—"}</td>
                                  </HoverRow>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ):<EmptyState icon="🔄" title="No custom conversions defined" sub="Custom conversions let you define rules to track meaningful actions."/>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Setup Methods ────────────────────────────────────────── */}
              {tab==="methods"&&(
                <div style={{padding:20}}>
                  <div style={{fontSize:13,color:C.text3,marginBottom:16,lineHeight:1.6}}>Choose the installation method that best fits your tech stack.</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {(setup?.setup_methods||[]).map((m,i)=>(
                      <div key={m.id||i} className="px-method-card" style={{border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",transition:"all .15s"}}>
                        <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                          <div style={{width:32,height:32,borderRadius:8,background:C.blueLight,border:`1px solid ${C.blueBorder}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14}}>{m.icon||"📦"}</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13.5,fontWeight:700,color:C.text1,marginBottom:3}}>{m.label}</div>
                            <div style={{fontSize:12.5,color:C.text3,lineHeight:1.5}}>{m.description}</div>
                            {m.url&&<a href={m.url} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:8,fontSize:12,fontWeight:600,color:C.blue,textDecoration:"none"}}>View documentation<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>}
                          </div>
                          {m.recommended&&<span style={{...badgeStyle("info"),flexShrink:0}}>Recommended</span>}
                        </div>
                      </div>
                    ))}
                    {(!setup?.setup_methods||setup.setup_methods.length===0)&&<EmptyState icon="🔧" title="No setup methods configured"/>}
                  </div>
                </div>
              )}

              {/* ── Settings ─────────────────────────────────────────────── */}
              {tab==="settings"&&(
                <div style={{padding:20}}>
                  <div style={{fontSize:13,color:C.text3,marginBottom:4,lineHeight:1.6}}>Configure tracking behaviour for this pixel. Changes take effect immediately.</div>
                  <div style={{borderTop:`1px solid ${C.borderLight}`}}>
                    <Toggle label="Advanced Matching" desc="Send hashed customer information to improve event match rates and your Event Match Quality score." value={!!px?.advancedMatchingEnabled} onChange={toggleAM} disabled={saving}/>
                    <Toggle label="Automatic Events" desc="Meta automatically detects and tracks standard events on your website without additional code." value={!!px?.automaticEventsEnabled} onChange={toggleAutoEvents} disabled={saving}/>
                    <Toggle label="Cookie Usage" desc="Allow the pixel to use browser cookies to improve attribution and deduplication across sessions." value={!!px?.cookiesEnabled} onChange={()=>{}} disabled/>
                  </div>
                  {emq!=null&&(
                    <div style={{marginTop:20,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.text3,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Event Match Quality</div>
                      <EMQBar score={emq}/>
                      <div style={{fontSize:12,color:C.text4,marginTop:8,lineHeight:1.5}}>
                        {emq>=7?"Strong match signals. Keep Advanced Matching enabled.":emq>=5?"Moderate quality. Enable Advanced Matching and send more parameters.":"Low quality. Enable Advanced Matching and verify pixel fires on all key pages."}
                      </div>
                    </div>
                  )}
                  {saving&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:14,color:C.text3,fontSize:13}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="px-spinning"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      Saving changes…
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{textAlign:"center",padding:"12px 0 4px",color:C.text4,fontSize:11.5}}>
              Showing pixel for <strong style={{color:C.text3}}>{selectedAccount?.name}</strong>
              <span style={{margin:"0 6px",color:C.border}}>·</span>
              Last updated {new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
              {allAccounts.length>1&&<><span style={{margin:"0 6px",color:C.border}}>·</span>{allAccounts.length} accounts available</>}
            </div>

          </div>
        )}

      </EventsManagerShell>
    </div>
  );
}