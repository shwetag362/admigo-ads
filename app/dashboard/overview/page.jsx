
// app/dashboard/account-manager/business-overview/page.jsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  royal:"#2B5CE6",royalD:"#1A3BAF",royalL:"#4A6FFF",
  royalXs:"rgba(43,92,230,0.06)",royalS:"rgba(43,92,230,0.11)",
  borderRoyal:"rgba(43,92,230,0.22)",
  ice:"#D0E4F7",sky:"#4A90D9",deepD:"#0D1B3E",
  white:"#FFFFFF",bg:"#F5F9FF",
  text:"#0D1B3E",muted:"#4B6880",faint:"#8AAFC8",
  border:"rgba(43,92,230,0.10)",border2:"rgba(43,92,230,0.18)",
  green:"#22C55E",greenXs:"rgba(34,197,94,0.08)",greenB:"rgba(34,197,94,0.25)",
  amber:"#F59E0B",amberXs:"rgba(245,158,11,0.08)",amberB:"rgba(245,158,11,0.25)",
  red:"#DC2626",redXs:"rgba(220,38,38,0.07)",redB:"rgba(220,38,38,0.22)",
  shXs:"0 1px 4px rgba(13,27,62,0.07)",
  shSm:"0 2px 10px rgba(13,27,62,0.09)",
  shMd:"0 4px 18px rgba(43,92,230,0.15)",
};
const FONT="var(--adm-sans,Sora,sans-serif)";
const MONO="var(--adm-mono,'JetBrains Mono',monospace)";

const STATUS_C={
  ACTIVE:   {dot:T.green,bg:T.greenXs,bd:T.greenB,tx:T.green},
  DISABLED: {dot:T.red,  bg:T.redXs,  bd:T.redB,  tx:T.red  },
  CLOSED:   {dot:T.red,  bg:T.redXs,  bd:T.redB,  tx:T.red  },
  PENDING:  {dot:T.amber,bg:T.amberXs,bd:T.amberB,tx:T.amber },
  UNSETTLED:{dot:T.amber,bg:T.amberXs,bd:T.amberB,tx:T.amber },
  UNKNOWN:  {dot:T.faint,bg:T.royalXs,bd:T.border, tx:T.muted},
};
const ROLE_C={
  ADMIN:T.royal,EMPLOYEE:T.muted,ANALYST:T.amber,
  FINANCE_EDITOR:T.sky,FINANCE_ANALYST:T.green,SALES:"#8B5CF6",
};
const sc=s=>STATUS_C[s]||STATUS_C.UNKNOWN;

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────
const fmt=n=>Number(n||0).toLocaleString("en-IN");
const ini=(n="")=>n.trim().split(/\s+/).map(w=>w[0]).join("").toUpperCase().slice(0,2)||"??";
const bColor=name=>{
  const p=[T.royal,"#1877F2","#36A420","#8B5CF6",T.amber,T.sky,"#DB2777","#059669"];
  let h=0;for(const c of(name||""))h=(h*31+c.charCodeAt(0))%p.length;
  return p[h];
};

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIVE HOOK
// ─────────────────────────────────────────────────────────────────────────────
function useBreakpoint(){
  const [bp,setBp]=useState("lg");
  useEffect(()=>{
    const update=()=>{
      const w=window.innerWidth;
      if(w<640)setBp("sm");
      else if(w<768)setBp("md");
      else if(w<1024)setBp("lg");
      else if(w<1280)setBp("xl");
      else setBp("2xl");
    };
    update();
    window.addEventListener("resize",update);
    return()=>window.removeEventListener("resize",update);
  },[]);
  return bp;
}

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────

// GradBar removed — returns null everywhere
function GradBar(){ return null; }

function Spinner({label="Loading from Meta API…"}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 0",gap:10,flexDirection:"column"}}>
      <svg width="22" height="22" viewBox="0 0 22 22" style={{animation:"admSpin 0.75s linear infinite"}}>
        <circle cx="11" cy="11" r="9" fill="none" stroke={T.ice} strokeWidth="2.5"/>
        <path d="M11 2 A9 9 0 0 1 20 11" fill="none" stroke={T.royal} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <span style={{fontSize:12,color:T.faint,fontFamily:FONT,fontWeight:500}}>{label}</span>
    </div>
  );
}

function BizAvatar({name,size=32}){
  return(
    <div style={{
      width:size,height:size,borderRadius:Math.round(size*0.28),flexShrink:0,
      background:bColor(name),color:"#fff",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*0.36,fontWeight:700,fontFamily:FONT,letterSpacing:"-0.5px",
    }}>{ini(name)}</div>
  );
}

function FbAvatar({name,size=32}){
  return(
    <div style={{
      width:size,height:size,borderRadius:"50%",flexShrink:0,
      background:"linear-gradient(135deg,#1877F2 0%,#0052CC 100%)",
      color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*0.34,fontWeight:700,fontFamily:FONT,
      boxShadow:"0 1px 4px rgba(24,119,242,0.3)",
    }}>{ini(name)}</div>
  );
}

function StatusBadge({status}){
  const{bg,bd,tx,dot}=sc(status);
  return(
    <span style={{
      display:"inline-flex",alignItems:"center",gap:4,
      fontSize:10,fontWeight:700,letterSpacing:"0.3px",
      padding:"2px 7px",borderRadius:99,
      background:bg,border:`1px solid ${bd}`,color:tx,
      fontFamily:FONT,flexShrink:0,textTransform:"uppercase",whiteSpace:"nowrap",
    }}>
      <span style={{width:5,height:5,borderRadius:"50%",background:dot,flexShrink:0,boxShadow:`0 0 4px ${dot}`}}/>
      {status||"UNKNOWN"}
    </span>
  );
}

function RoleBadge({role}){
  const color=ROLE_C[role]||T.muted;
  return(
    <span style={{
      fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99,
      background:`${color}12`,color,border:`1px solid ${color}28`,
      fontFamily:FONT,flexShrink:0,whiteSpace:"nowrap",
    }}>{role}</span>
  );
}

function Chip({children}){
  return(
    <span style={{
      fontSize:9,fontWeight:600,padding:"2px 6px",borderRadius:4,
      background:T.royalXs,color:T.royal,border:`1px solid ${T.border2}`,
      fontFamily:MONO,whiteSpace:"nowrap",
    }}>{children}</span>
  );
}

function Card({children,style={},accent=false}){
  return(
    <div style={{
      background:T.white,borderRadius:12,
      border:`1px solid ${accent?T.borderRoyal:T.border}`,
      boxShadow:accent?T.shMd:T.shXs,
      position:"relative",overflow:"hidden",...style,
    }}>
      {children}
    </div>
  );
}

function SectionHeader({title,count,chip,action,onAction}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 13px",borderBottom:`1px solid ${T.border}`,gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1}}>
        <span style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:FONT,letterSpacing:"-0.01em",whiteSpace:"nowrap"}}>{title}</span>
        {count!=null&&<span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:99,background:T.royalXs,color:T.royal,border:`1px solid ${T.border2}`,flexShrink:0}}>{count}</span>}
        {chip&&<div style={{display:"flex",overflow:"hidden"}}><Chip>{chip}</Chip></div>}
      </div>
      {action&&(
        <button onClick={onAction} style={{
          fontSize:10,fontWeight:700,color:T.royal,background:T.royalXs,
          border:`1px solid ${T.border2}`,borderRadius:6,padding:"3px 9px",
          cursor:"pointer",fontFamily:FONT,transition:"background 0.15s",flexShrink:0,
        }}
          onMouseEnter={e=>e.currentTarget.style.background=T.royalS}
          onMouseLeave={e=>e.currentTarget.style.background=T.royalXs}
        >{action}</button>
      )}
    </div>
  );
}

function EmptyState({icon="📭",title,sub}){
  return(
    <div style={{padding:"28px 16px",textAlign:"center"}}>
      <div style={{fontSize:26,marginBottom:7}}>{icon}</div>
      <div style={{fontSize:12,fontWeight:700,color:T.muted,fontFamily:FONT}}>{title}</div>
      {sub&&<div style={{fontSize:10,color:T.faint,marginTop:3,fontFamily:FONT}}>{sub}</div>}
    </div>
  );
}

function ErrorBox({msg}){
  return(
    <div style={{background:T.redXs,border:`1px solid ${T.redB}`,borderRadius:8,padding:"10px 12px",fontSize:11,color:T.red,fontFamily:FONT,fontWeight:600}}>
      ⚠ {msg}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonPulse({width,height,borderRadius=6,style={}}){
  return(
    <div style={{
      width,height,borderRadius,flexShrink:0,
      background:`linear-gradient(90deg,${T.royalXs} 25%,rgba(43,92,230,0.10) 50%,${T.royalXs} 75%)`,
      backgroundSize:"200% 100%",
      animation:"skelShimmer 1.4s ease-in-out infinite",
      ...style,
    }}/>
  );
}

function LeftPanelSkeleton(){
  return(
    <div style={{
      width:248,flexShrink:0,
      background:T.white,borderRight:`1px solid ${T.border}`,
      display:"flex",flexDirection:"column",overflow:"hidden",
    }}>
      {/* Header */}
      <div style={{padding:"11px 13px 9px",borderBottom:`1px solid ${T.border}`}}>
        <SkeletonPulse width={120} height={11} borderRadius={4}/>
      </div>

      {/* FB account rows × 2 with BM children */}
      <div style={{flex:1,overflowY:"hidden"}}>
        {[0,1].map(i=>(
          <div key={i}>
            {/* FB row */}
            <div style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",borderBottom:`1px solid ${T.border}`}}>
              <SkeletonPulse width={30} height={30} borderRadius={99}/>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                <SkeletonPulse width="65%" height={10} borderRadius={4}/>
                <SkeletonPulse width="45%" height={8} borderRadius={4}/>
              </div>
            </div>
            {/* BM rows × 3 */}
            {[0,1,2].map(j=>(
              <div key={j} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px 8px 26px"}}>
                <SkeletonPulse width={26} height={26} borderRadius={7}/>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
                  <SkeletonPulse width="70%" height={9} borderRadius={4}/>
                  <SkeletonPulse width="50%" height={8} borderRadius={4}/>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer button */}
      <div style={{borderTop:`1px solid ${T.border}`,padding:"10px 12px"}}>
        <SkeletonPulse width="100%" height={32} borderRadius={9}/>
      </div>
    </div>
  );
}

function RightPanelSkeleton(){
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>

      {/* Dark header skeleton */}
      <div style={{
        background:`linear-gradient(135deg,#020c1b 0%,#071530 15%,${T.deepD} 45%,#1a3580 75%,${T.royal} 100%)`,
        padding:"14px 18px",flexShrink:0,
      }}>
        <SkeletonPulse width={80} height={8} borderRadius={3} style={{background:"rgba(255,255,255,0.12)",marginBottom:8}}/>
        <SkeletonPulse width={200} height={16} borderRadius={5} style={{background:"rgba(255,255,255,0.12)",marginBottom:10}}/>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          <SkeletonPulse width={110} height={9} borderRadius={3} style={{background:"rgba(255,255,255,0.08)"}}/>
          <SkeletonPulse width={60} height={9} borderRadius={3} style={{background:"rgba(255,255,255,0.08)"}}/>
        </div>
        {/* Stat tiles */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{
              background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.10)",
              borderRadius:8,padding:"8px 9px",
              display:"flex",flexDirection:"column",alignItems:"center",gap:5,
            }}>
              <SkeletonPulse width={28} height={17} borderRadius={4} style={{background:"rgba(255,255,255,0.12)"}}/>
              <SkeletonPulse width={48} height={8} borderRadius={3} style={{background:"rgba(255,255,255,0.08)"}}/>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>

        {/* Ad Accounts card skeleton */}
        <div style={{background:T.white,borderRadius:12,border:`1px solid ${T.border}`,boxShadow:T.shXs,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 13px",borderBottom:`1px solid ${T.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <SkeletonPulse width={80} height={10} borderRadius={4}/>
              <SkeletonPulse width={18} height={16} borderRadius={99}/>
              <SkeletonPulse width={110} height={14} borderRadius={4}/>
            </div>
            <SkeletonPulse width={44} height={22} borderRadius={6}/>
          </div>
          <div style={{padding:"9px 11px",display:"flex",flexDirection:"column",gap:7}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{
                display:"flex",alignItems:"center",gap:9,
                padding:"9px 11px",borderRadius:9,
                border:`1.5px solid ${T.border}`,background:T.bg,
              }}>
                <SkeletonPulse width={14} height={14} borderRadius={99}/>
                <SkeletonPulse width={30} height={30} borderRadius={7}/>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                  <SkeletonPulse width="55%" height={10} borderRadius={4}/>
                  <SkeletonPulse width="38%" height={8} borderRadius={4}/>
                </div>
                <SkeletonPulse width={52} height={18} borderRadius={99}/>
                <SkeletonPulse width={30} height={30} borderRadius={99}/>
              </div>
            ))}
          </div>
        </div>

        {/* Pages + Pixels grid skeleton */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {["Facebook Pages","Meta Pixels"].map(title=>(
            <div key={title} style={{background:T.white,borderRadius:12,border:`1px solid ${T.border}`,boxShadow:T.shXs,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"10px 13px",borderBottom:`1px solid ${T.border}`}}>
                <SkeletonPulse width={90} height={10} borderRadius={4}/>
                <SkeletonPulse width={18} height={16} borderRadius={99}/>
              </div>
              <div style={{padding:"7px 9px",display:"flex",flexDirection:"column",gap:6}}>
                {[0,1,2,3].map(i=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 7px",borderRadius:7,background:T.bg,border:`1px solid ${T.border}`}}>
                    <SkeletonPulse width={26} height={26} borderRadius={6}/>
                    <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
                      <SkeletonPulse width="60%" height={9} borderRadius={4}/>
                      <SkeletonPulse width="40%" height={8} borderRadius={4}/>
                    </div>
                    <SkeletonPulse width={28} height={16} borderRadius={99}/>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEFT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function LeftPanel({accounts,activeFbId,activeBMId,activePersonalFbId,onSelectFb,onSelectBM,onSelectPersonal,searchQuery,isOpen,onClose,isMobile}){
  const panelRef=useRef(null);

  useEffect(()=>{
    if(!isMobile)return;
    const handler=e=>{
      if(panelRef.current&&!panelRef.current.contains(e.target))onClose?.();
    };
    if(isOpen)document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[isOpen,isMobile,onClose]);

  const panel=(
    <div ref={panelRef} style={{
      width:248,flexShrink:0,
      background:T.white,borderRight:`1px solid ${T.border}`,
      display:"flex",flexDirection:"column",overflow:"hidden",
      ...(isMobile?{
        position:"fixed",top:0,left:0,bottom:0,zIndex:200,
        width:280,
        boxShadow:"4px 0 24px rgba(13,27,62,0.15)",
        transform:isOpen?"translateX(0)":"translateX(-100%)",
        transition:"transform 0.22s ease",
      }:{}),
    }}>
      {/* Panel header */}
      <div style={{
        padding:"11px 13px 9px",borderBottom:`1px solid ${T.border}`,
        display:"flex",alignItems:"center",justifyContent:"space-between",
        background:T.white,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:FONT}}>Business Portfolios</span>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{cursor:"pointer",flexShrink:0}}>
            <circle cx="7" cy="7" r="6" stroke={T.faint} strokeWidth="1.3"/>
            <path d="M7 6.5V10M7 4.5h.01" stroke={T.faint} strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        {isMobile&&(
          <button onClick={onClose} style={{
            width:26,height:26,borderRadius:6,border:`1px solid ${T.border}`,
            background:T.bg,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,color:T.muted,
          }}>✕</button>
        )}
      </div>

      {/* Scrollable list */}
      <div style={{flex:1,overflowY:"auto"}}>
        {accounts.map(acc=>{
          const fb=acc.facebookAccount;
          const isFbOpen=activeFbId===fb.id;
          const visibleBMs=acc.businessManagers.filter(bm=>
            !searchQuery||bm.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
          if(searchQuery&&visibleBMs.length===0&&
            !fb.facebookUserName.toLowerCase().includes(searchQuery.toLowerCase()))return null;

          const fbRowActive=isFbOpen&&!activeBMId&&activePersonalFbId!==fb.id;

          return(
            <div key={fb.id}>
              {/* FB Account row */}
              <div
                onClick={()=>{onSelectFb(fb.id,acc);if(isMobile)onClose?.();}}
                style={{
                  display:"flex",alignItems:"center",gap:9,padding:"9px 12px",
                  background:fbRowActive?`linear-gradient(135deg,${T.royalD} 0%,${T.royal} 100%)`:"transparent",
                  cursor:"pointer",transition:"background 0.12s",
                  borderBottom:`1px solid ${T.border}`,
                }}
                onMouseEnter={e=>{if(!fbRowActive)e.currentTarget.style.background=T.royalXs;}}
                onMouseLeave={e=>{if(!fbRowActive)e.currentTarget.style.background="transparent";}}
              >
                <FbAvatar name={fb.facebookUserName} size={30}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{
                    fontSize:12,fontWeight:700,fontFamily:FONT,
                    color:fbRowActive?"#fff":T.text,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                    display:"flex",alignItems:"center",gap:5,
                  }}>
                    {fb.facebookUserName}
                    {fb.isPrimary&&<span style={{
                      fontSize:8,fontWeight:800,padding:"1px 4px",borderRadius:3,flexShrink:0,fontFamily:FONT,
                      background:fbRowActive?"rgba(255,255,255,0.2)":T.royalXs,
                      color:fbRowActive?"#fff":T.royal,
                      border:`1px solid ${fbRowActive?"rgba(255,255,255,0.3)":T.border2}`,
                    }}>PRIMARY</span>}
                  </div>
                  <div style={{fontSize:10,marginTop:1,fontFamily:FONT,color:fbRowActive?"rgba(208,228,247,0.7)":T.faint}}>
                    {acc.summary.businessManagerCount} BM · {acc.summary.adAccountCount} acct · {acc.summary.pageCount} pages
                  </div>
                </div>
                {fb.tokenExpired&&<span style={{fontSize:11,flexShrink:0}} title="Token expired — reconnect">⚠️</span>}
              </div>

              {/* Personal accounts */}
              {isFbOpen&&acc.personalAccounts?.length>0&&(
                <BmRow
                  label="Personal Accounts"
                  sub={`${acc.personalAccounts.length} account${acc.personalAccounts.length!==1?"s":""} · no BM`}
                  selected={activePersonalFbId===fb.id&&!activeBMId}
                  onClick={()=>{onSelectPersonal(fb.id);if(isMobile)onClose?.();}}
                  indent
                  icon={
                    <div style={{width:26,height:26,borderRadius:7,flexShrink:0,background:T.royalXs,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="8" r="4" stroke={T.faint} strokeWidth="1.8"/>
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={T.faint} strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </div>
                  }
                />
              )}

              {/* BM rows */}
              {isFbOpen&&visibleBMs.map(bm=>(
                <BmRow
                  key={bm.id}
                  label={bm.name}
                  sub={`${bm.adAccountCount} acct · ${bm.pageCount} pages · ${bm.pixelCount} pixels`}
                  selected={activeBMId===bm.id}
                  onClick={()=>{onSelectBM(bm.id);if(isMobile)onClose?.();}}
                  verified={bm.verificationStatus==="verified"}
                  indent
                  icon={<BizAvatar name={bm.name} size={26}/>}
                />
              ))}
            </div>
          );
        })}

        {accounts.length===0&&(
          <div style={{padding:"24px 14px",textAlign:"center",fontSize:11,color:T.faint,fontFamily:FONT}}>
            No Facebook accounts connected
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{borderTop:`1px solid ${T.border}`,padding:"10px 12px"}}>
        <button style={{
          width:"100%",padding:"7px 0",borderRadius:9,
          border:`1px solid ${T.border2}`,background:T.royalXs,
          fontSize:11,fontWeight:700,color:T.royal,
          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,
          fontFamily:FONT,transition:"background 0.15s",
        }}
          onMouseEnter={e=>e.currentTarget.style.background=T.royalS}
          onMouseLeave={e=>e.currentTarget.style.background=T.royalXs}
        >
          <span style={{fontSize:14,lineHeight:1}}>+</span> New Portfolio
        </button>
      </div>
    </div>
  );

  if(isMobile){
    return(
      <>
        {isOpen&&<div onClick={onClose} style={{position:"fixed",inset:0,zIndex:199,background:"rgba(13,27,62,0.3)",backdropFilter:"blur(2px)"}}/>}
        {panel}
      </>
    );
  }
  return panel;
}

function BmRow({label,sub,selected,onClick,indent,icon,verified}){
  return(
    <div
      onClick={onClick}
      style={{
        display:"flex",alignItems:"center",gap:8,
        padding:`8px 12px 8px ${indent?26:12}px`,
        background:selected?`linear-gradient(135deg,${T.royalD} 0%,${T.royal} 100%)`:"transparent",
        cursor:"pointer",transition:"background 0.12s",
      }}
      onMouseEnter={e=>{if(!selected)e.currentTarget.style.background=T.royalXs;}}
      onMouseLeave={e=>{if(!selected)e.currentTarget.style.background="transparent";}}
    >
      {indent&&(
        <div style={{
          width:10,height:10,flexShrink:0,
          borderLeft:`1.5px solid ${selected?"rgba(255,255,255,0.25)":T.borderRoyal}`,
          borderBottom:`1.5px solid ${selected?"rgba(255,255,255,0.25)":T.borderRoyal}`,
          borderRadius:"0 0 0 3px",marginRight:2,
        }}/>
      )}
      {icon}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:11,fontWeight:600,fontFamily:FONT,color:selected?"#fff":T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
        <div style={{fontSize:9.5,color:selected?"rgba(208,228,247,0.65)":T.faint,marginTop:1,fontFamily:FONT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>
      </div>
      {verified&&(
        <span style={{
          fontSize:8,fontWeight:800,padding:"1px 4px",borderRadius:3,flexShrink:0,fontFamily:FONT,
          background:selected?"rgba(255,255,255,0.2)":T.royalXs,
          color:selected?"#fff":T.royal,
          border:`1px solid ${selected?"rgba(255,255,255,0.25)":T.border2}`,
        }}>✓VRF</span>
      )}
      {selected&&(
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M6 12l6-4-6-4v8z" fill="rgba(255,255,255,0.75)"/>
        </svg>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BM DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────
function BMDetailPanel({activeBM,selectedAccId,onSelectAcc,bp}){
  if(!activeBM)return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:T.bg}}>
      <div style={{textAlign:"center",color:T.faint}}>
        <div style={{fontSize:32,marginBottom:10}}>🏢</div>
        <div style={{fontSize:13,fontWeight:700,color:T.muted,fontFamily:FONT}}>Select a Business Portfolio</div>
        <div style={{fontSize:11,color:T.faint,marginTop:4,fontFamily:FONT}}>Choose from the left panel</div>
      </div>
    </div>
  );

  const{adAccounts,pages,pixels}=activeBM;
  const selectedAcc=adAccounts.find(a=>a.metaAccountId===selectedAccId);
  const isSmall=bp==="sm"||bp==="md";
  const assetsGrid=pages.length>0&&pixels.length>0&&!isSmall?"1fr 1fr":"1fr";

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>

      {/* Dark gradient header */}
      <div style={{
        background:`linear-gradient(135deg,#020c1b 0%,#071530 15%,${T.deepD} 45%,#1a3580 75%,${T.royal} 100%)`,
        padding:isSmall?"12px 14px":"14px 18px",position:"relative",overflow:"hidden",flexShrink:0,
      }}>
        <div style={{position:"absolute",top:-40,right:-30,width:140,height:140,borderRadius:"50%",background:"rgba(43,92,230,0.08)",pointerEvents:"none"}}/>
        <div style={{position:"relative",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:9,fontWeight:700,color:T.sky,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:4,fontFamily:FONT}}>Business Portfolio</div>
            <div style={{
              fontSize:isSmall?14:16,fontWeight:800,color:"#fff",
              letterSpacing:"-0.03em",lineHeight:1.25,fontFamily:FONT,
              display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",
            }}>
              {activeBM.name}
              {activeBM.verificationStatus==="verified"&&(
                <span style={{fontSize:9,fontWeight:800,padding:"2px 6px",borderRadius:4,background:"rgba(255,255,255,0.12)",color:T.ice,border:"1px solid rgba(255,255,255,0.18)",fontFamily:FONT}}>✓ VERIFIED</span>
              )}
            </div>
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:9,color:"rgba(208,228,247,0.5)",fontFamily:MONO}}>ID: {activeBM.id}</span>
              {activeBM.permittedRoles?.map(r=>(
                <span key={r} style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:3,background:"rgba(255,255,255,0.10)",color:T.ice,border:"1px solid rgba(255,255,255,0.15)",fontFamily:FONT}}>{r}</span>
              ))}
            </div>
          </div>
          <button style={{
            width:28,height:28,borderRadius:7,flexShrink:0,
            background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="rgba(208,228,247,0.7)" strokeWidth="2"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="rgba(208,228,247,0.7)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Stat tiles */}
        <div style={{display:"grid",gridTemplateColumns:`repeat(${isSmall?2:4},1fr)`,gap:7,marginTop:12,position:"relative"}}>
          {[
            {l:"Ad Accounts",v:adAccounts.length,c:T.royalL},
            {l:"Pages",v:pages.length,c:T.sky},
            {l:"Pixels",v:pixels.length,c:T.amber},
            {l:"Role",v:activeBM.permittedRoles?.[0]||"—",c:T.ice,small:true},
          ].map(s=>(
            <div key={s.l} style={{
              background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.10)",
              borderRadius:8,padding:"8px 9px",textAlign:"center",
            }}>
              <div style={{fontSize:s.small?10:17,fontWeight:800,color:s.c,lineHeight:1,fontFamily:FONT,letterSpacing:s.small?"-0.01em":"-0.5px"}}>{s.v}</div>
              <div style={{fontSize:8.5,color:"rgba(208,228,247,0.5)",marginTop:3,fontWeight:600,fontFamily:FONT}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{flex:1,overflowY:"auto",padding:isSmall?"10px 12px":"12px 14px",display:"flex",flexDirection:"column",gap:10}}>

        {/* Ad Accounts card */}
        <Card>
          <SectionHeader title="Ad Accounts" count={adAccounts.length} chip={`/${activeBM.id}/adaccounts`} action="+ Add"/>
          <div style={{padding:"9px 11px",display:"flex",flexDirection:"column",gap:7}}>
            {adAccounts.length===0
              ?<EmptyState icon="💳" title="No ad accounts" sub="Add an account to this portfolio"/>
              :adAccounts.map(acc=>{
                const sel=selectedAccId===acc.metaAccountId;
                return(
                  <div
                    key={acc.metaAccountId}
                    onClick={()=>onSelectAcc(acc.metaAccountId)}
                    style={{
                      display:"flex",alignItems:"center",gap:9,
                      padding:"9px 11px",borderRadius:9,cursor:"pointer",
                      border:`1.5px solid ${sel?T.borderRoyal:T.border}`,
                      background:sel?T.royalXs:T.bg,
                      boxShadow:sel?T.shMd:"none",
                      transition:"all 0.15s",
                    }}
                  >
                    <div style={{
                      width:14,height:14,borderRadius:"50%",flexShrink:0,
                      border:`2px solid ${sel?T.royal:T.faint}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                    }}>
                      {sel&&<div style={{width:7,height:7,borderRadius:"50%",background:T.royal}}/>}
                    </div>
                    <div style={{
                      width:30,height:30,borderRadius:7,flexShrink:0,
                      background:sel?T.royal:T.royalXs,
                      border:`1px solid ${sel?T.royal:T.border2}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="5" width="20" height="15" rx="3" stroke={sel?"#fff":T.royal} strokeWidth="1.8"/>
                        <path d="M2 9h20" stroke={sel?"#fff":T.royal} strokeWidth="1.8"/>
                        <path d="M6 14h4M14 14h4" stroke={sel?"#fff":T.royal} strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.text,fontFamily:FONT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.name}</div>
                      <div style={{fontSize:9.5,color:T.faint,marginTop:1,fontFamily:MONO,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.metaAccountId}</div>
                    </div>
                    <StatusBadge status={acc.status}/>
                    {acc.currency&&!isSmall&&(
                      <div style={{
                        width:30,height:30,borderRadius:"50%",flexShrink:0,
                        border:`2px solid ${T.borderRoyal}`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:8,fontWeight:800,color:T.royal,background:T.royalXs,fontFamily:FONT,
                      }}>{acc.currency}</div>
                    )}
                  </div>
                );
              })
            }
          </div>

          {/* Expanded detail row */}
          {selectedAcc&&(
            <div style={{margin:"0 11px 11px",padding:"10px 12px",borderRadius:9,background:T.royalXs,border:`1px solid ${T.border2}`}}>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${isSmall?2:4},1fr)`,gap:9}}>
                {[
                  {l:"Business", v:selectedAcc.businessName||activeBM.name},
                  {l:"Currency", v:selectedAcc.currency||"—"},
                  {l:"Timezone", v:selectedAcc.timezone||"—"},
                  {l:"Status",   v:<StatusBadge status={selectedAcc.status}/>},
                ].map(s=>(
                  <div key={s.l}>
                    <div style={{fontSize:9,fontWeight:700,color:T.faint,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3,fontFamily:FONT}}>{s.l}</div>
                    <div style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:FONT}}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Assets grid */}
        {(pages.length>0||pixels.length>0)&&(
          <div style={{display:"grid",gridTemplateColumns:assetsGrid,gap:10}}>

            {pages.length>0&&(
              <Card>
                <SectionHeader title="Facebook Pages" count={pages.length} chip={`/${activeBM.id}/owned_pages`}/>
                <div style={{padding:"7px 9px",display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto"}}>
                  {pages.map(pg=>(
                    <div key={pg.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 7px",borderRadius:7,background:T.bg,border:`1px solid ${T.border}`}}>
                      {pg.picture
                        ?<img src={pg.picture} alt={pg.name} style={{width:26,height:26,borderRadius:6,objectFit:"cover",flexShrink:0,border:`1px solid ${T.border}`}}/>
                        :<BizAvatar name={pg.name} size={26}/>
                      }
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:FONT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pg.name}</div>
                        <div style={{fontSize:9.5,color:T.faint,fontFamily:FONT,marginTop:1}}>
                          {pg.category||"Page"}{pg.fanCount>0&&` · ${fmt(pg.fanCount)} followers`}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                        {pg.verificationStatus==="verified"&&<span style={{fontSize:8,fontWeight:700,color:T.royal,background:T.royalXs,padding:"1px 4px",borderRadius:3,border:`1px solid ${T.border2}`,fontFamily:FONT}}>VRF</span>}
                        <div style={{width:6,height:6,borderRadius:"50%",background:T.green,boxShadow:`0 0 4px ${T.green}`}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {pixels.length>0&&(
              <Card>
                <SectionHeader title="Meta Pixels" count={pixels.length} chip={`/${activeBM.id}/owned_pixels`}/>
                <div style={{padding:"7px 9px",display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto"}}>
                  {pixels.map(px=>{
                    const active=!px.isUnavailable;
                    return(
                      <div key={px.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 7px",borderRadius:7,background:T.bg,border:`1px solid ${T.border}`}}>
                        <div style={{
                          width:26,height:26,borderRadius:6,flexShrink:0,
                          background:"rgba(220,38,38,0.07)",border:"1px solid rgba(220,38,38,0.18)",
                          display:"flex",alignItems:"center",justifyContent:"center",
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="3" fill={T.red}/>
                            <circle cx="12" cy="12" r="7" stroke={T.red} strokeWidth="1.5" fill="none"/>
                            <circle cx="12" cy="12" r="11" stroke={T.red} strokeWidth="1" fill="none" opacity="0.3"/>
                          </svg>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:FONT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{px.name}</div>
                          <div style={{fontSize:9.5,color:T.faint,fontFamily:MONO,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{px.id}</div>
                          {px.lastFiredTime&&(
                            <div style={{fontSize:9,color:T.faint,fontFamily:FONT,marginTop:1}}>
                              Last fired: {new Date(px.lastFiredTime).toLocaleDateString("en-IN",{dateStyle:"medium"})}
                            </div>
                          )}
                        </div>
                        <StatusBadge status={active?"ACTIVE":"DISABLED"}/>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* No assets */}
        {!pages.length&&!pixels.length&&adAccounts.length>0&&(
          <Card><EmptyState icon="🔗" title="No pages or pixels" sub="Assets will appear here once linked to this portfolio"/></Card>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PEOPLE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function PeoplePanel({activeBM,activeFbId,team,loadingTeam,errorTeam,onRefresh,bp}){
  const isSmall=bp==="sm"||bp==="md";

  if(!activeBM||activeBM.id==="personal")return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:T.bg}}>
      <EmptyState icon="👥" title="Select a Business portfolio" sub="Choose a BM to view its team members"/>
    </div>
  );

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>
      {/* Header */}
      <div style={{
        padding:"10px 14px",background:T.white,borderBottom:`1px solid ${T.border}`,
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,flexShrink:0,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <BizAvatar name={activeBM.name} size={28}/>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.text,fontFamily:FONT}}>{activeBM.name}</div>
            <div style={{fontSize:9.5,color:T.faint,fontFamily:FONT}}>Team Members · {team.length} found</div>
          </div>
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
          {!isSmall&&<Chip>{`GET /${activeBM.id}/business_users`}</Chip>}
          {!isSmall&&<Chip>{`GET /${activeBM.id}/pending_users`}</Chip>}
          <button onClick={onRefresh} style={{
            fontSize:10,fontWeight:700,color:T.royal,background:T.royalXs,
            border:`1px solid ${T.border2}`,borderRadius:6,padding:"4px 10px",
            cursor:"pointer",fontFamily:FONT,
          }}>↻ Refresh</button>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:isSmall?"10px 12px":"12px 14px"}}>
        <Card>
          {loadingTeam?<Spinner label="Fetching team from Meta API…"/>
            :errorTeam?<div style={{padding:"12px 14px"}}><ErrorBox msg={errorTeam}/></div>
            :team.length===0?<EmptyState icon="👥" title="No people found" sub="Invite people via Business Settings → People"/>
            :team.map((u,i)=>(
              <div key={u.id} style={{
                display:"flex",alignItems:isSmall?"flex-start":"center",gap:10,
                padding:"10px 13px",
                borderBottom:i<team.length-1?`1px solid ${T.border}`:"none",
                background:u.isPending?T.amberXs:T.white,
                flexWrap:isSmall?"wrap":"nowrap",
              }}>
                <BizAvatar name={u.name==="Pending Invite"?(u.email||"P"):u.name} size={34}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.text,fontFamily:FONT,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    {u.name}
                    {u.isPending&&<span style={{fontSize:9,color:T.amber,fontWeight:700,fontFamily:FONT}}>(Pending Invite)</span>}
                  </div>
                  <div style={{fontSize:10,color:T.faint,marginTop:2,fontFamily:FONT}}>
                    {u.email||"Email not visible"}
                    {u.createdTime&&` · Joined ${new Date(u.createdTime).toLocaleDateString("en-IN",{month:"short",year:"numeric"})}`}
                  </div>
                </div>
                <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
                  <RoleBadge role={u.role}/>
                  <StatusBadge status={u.isPending?"PENDING":(u.status||"ACTIVE")}/>
                </div>
                {!u.isPending&&!isSmall&&(
                  <button style={{
                    fontSize:10,fontWeight:700,color:T.royal,background:T.royalXs,
                    border:`1px solid ${T.border2}`,borderRadius:6,padding:"4px 10px",
                    cursor:"pointer",fontFamily:FONT,whiteSpace:"nowrap",flexShrink:0,
                  }}>Assign →</button>
                )}
              </div>
            ))
          }
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const TABS=[{id:"overview",label:"Ad Accounts"},{id:"team",label:"People"}];

export default function BusinessOverviewPage(){
  const bp=useBreakpoint();
  const isMobile=bp==="sm"||bp==="md";

  const[tab,setTab]=useState("overview");
  const[searchQuery,setSearchQuery]=useState("");
  const[sidebarOpen,setSidebarOpen]=useState(false);

  const[activeFbId,setActiveFbId]=useState(null);
  const[activeBMId,setActiveBMId]=useState(null);
  const[activePersonalFbId,setActivePersonalFbId]=useState(null);
  const[selectedAccId,setSelectedAccId]=useState(null);

  const[accounts,setAccounts]=useState([]);
  const[summary,setSummary]=useState(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(null);
  const[partialErrors,setPartialErrors]=useState([]);

  const[team,setTeam]=useState([]);
  const[loadingTeam,setLoadingTeam]=useState(false);
  const[errorTeam,setErrorTeam]=useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    setLoading(true);
    fetch("/api/meta/business")
      .then(r=>r.json())
      .then(d=>{
        if(d.success&&d.accounts?.length){
          setAccounts(d.accounts);
          setSummary(d.summary);
          if(d.partialErrors?.length)setPartialErrors(d.partialErrors);
          const primary=d.accounts.find(a=>a.facebookAccount.isPrimary)||d.accounts[0];
          setActiveFbId(primary.facebookAccount.id);
          const firstBM=primary.businessManagers?.find(bm=>bm.adAccountCount>0||bm.pageCount>0||bm.pixelCount>0)||primary.businessManagers?.[0];
          if(firstBM){
            setActiveBMId(firstBM.id);
            const firstAcc=firstBM.adAccounts?.[0];
            if(firstAcc)setSelectedAccId(firstAcc.metaAccountId);
          }else if(primary.personalAccounts?.length>0){
            setActivePersonalFbId(primary.facebookAccount.id);
            setSelectedAccId(primary.personalAccounts[0].metaAccountId);
          }
        }else{
          setError(d.error||"No business data found");
        }
      })
      .catch(err=>setError(err.message))
      .finally(()=>setLoading(false));
  },[]);

  // ── Team ───────────────────────────────────────────────────────────────────
  const fetchTeam=useCallback((bmId,fbId)=>{
    if(!bmId)return;
    setLoadingTeam(true);setErrorTeam(null);
    const params=new URLSearchParams({businessId:bmId});
    if(fbId)params.set("fbAccountId",fbId);
    fetch(`/api/meta/team?${params}`)
      .then(r=>r.json())
      .then(d=>{if(d.success)setTeam(d.members||[]);else setErrorTeam(d.error||"Failed");})
      .catch(err=>setErrorTeam(err.message))
      .finally(()=>setLoadingTeam(false));
  },[]);

  useEffect(()=>{
    if(tab==="team"&&activeBMId)fetchTeam(activeBMId,activeFbId);
  },[tab,activeBMId,activeFbId,fetchTeam]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectFb=(fbId,accPayload)=>{
    setActiveFbId(fbId);setActiveBMId(null);setActivePersonalFbId(null);setSelectedAccId(null);
    const firstBM=accPayload.businessManagers?.find(bm=>bm.adAccountCount>0||bm.pageCount>0||bm.pixelCount>0)||accPayload.businessManagers?.[0];
    if(firstBM){setActiveBMId(firstBM.id);const fa=firstBM.adAccounts?.[0];if(fa)setSelectedAccId(fa.metaAccountId);}
    else if(accPayload.personalAccounts?.length>0){setActivePersonalFbId(fbId);setSelectedAccId(accPayload.personalAccounts[0].metaAccountId);}
  };
  const handleSelectBM=bmId=>{
    setActiveBMId(bmId);setActivePersonalFbId(null);setSelectedAccId(null);
    const p=accounts.find(a=>a.facebookAccount.id===activeFbId);
    const bm=p?.businessManagers.find(b=>b.id===bmId);
    const fa=bm?.adAccounts?.[0];if(fa)setSelectedAccId(fa.metaAccountId);
  };
  const handleSelectPersonal=fbId=>{
    setActiveFbId(fbId);setActiveBMId(null);setActivePersonalFbId(fbId);setSelectedAccId(null);
    const p=accounts.find(a=>a.facebookAccount.id===fbId);
    const fa=p?.personalAccounts?.[0];if(fa)setSelectedAccId(fa.metaAccountId);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeFbPayload=accounts.find(a=>a.facebookAccount.id===activeFbId)||null;
  const activeFbAccount=activeFbPayload?.facebookAccount||null;
  const activeBM=activeBMId?(activeFbPayload?.businessManagers.find(b=>b.id===activeBMId)||null):null;
  const personalFbPayload=activePersonalFbId?accounts.find(a=>a.facebookAccount.id===activePersonalFbId):null;
  const personalBM=personalFbPayload&&!activeBMId?{
    id:"personal",
    name:`Personal — ${personalFbPayload.facebookAccount.facebookUserName}`,
    verificationStatus:"not_verified",permittedRoles:[],
    adAccounts:personalFbPayload.personalAccounts||[],pages:[],pixels:[],
    adAccountCount:personalFbPayload.personalAccounts?.length||0,pageCount:0,pixelCount:0,
  }:null;
  const displayBM=activeBM||personalBM;
  const activeBMName=displayBM?.name||null;

  return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:FONT,background:T.bg}}>
      <style>{`
        @keyframes admSpin{to{transform:rotate(360deg)}}
        @keyframes admIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes skelShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${T.ice};border-radius:99px}
        ::-webkit-scrollbar-track{background:transparent}
      `}</style>

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,flexShrink:0,boxShadow:T.shXs}}>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:72,padding:"20px 20px",gap:10}}>
          {/* Left */}
          <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0,flex:1}}>
            {isMobile&&(
              <button
                onClick={()=>setSidebarOpen(p=>!p)}
                style={{
                  width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,
                  background:T.bg,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M2 8h12M2 12h12" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}

            <div style={{
              width:30,height:30,borderRadius:8,flexShrink:0,
              background:`linear-gradient(135deg,${T.royal} 0%,${T.royalD} 100%)`,
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:T.shMd,
            }}>
              
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="2" fill="#fff" opacity="0.9"/>
                <rect x="13" y="3" width="8" height="8" rx="2" fill="#fff" opacity="0.6"/>
                <rect x="3" y="13" width="8" height="8" rx="2" fill="#fff" opacity="0.6"/>
                <rect x="13" y="13" width="8" height="8" rx="2" fill="#fff" opacity="0.3"/>
              </svg>
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,fontWeight:800,color:T.text,letterSpacing:"-0.03em",fontFamily:FONT,lineHeight:1.2}}>Business Overview</div>
              {!isMobile&&(
                <div style={{fontSize:9.5,color:T.faint,fontFamily:FONT,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {loading?"Connecting to Meta API…"
                    :activeBMName
                      ?`${activeBMName} · ${displayBM?.adAccountCount||0} accounts · ${displayBM?.pageCount||0} pages · ${displayBM?.pixelCount||0} pixels`
                      :`${summary?.totalBusinessManagers||0} BMs · ${summary?.totalAdAccounts||0} accounts · ${summary?.totalPages||0} pages · ${summary?.totalPixels||0} pixels`
                  }
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
            {accounts.length>1&&!isMobile&&(
              <div style={{display:"flex",gap:3}}>
                {accounts.map(acc=>{
                  const fb=acc.facebookAccount;const sel=activeFbId===fb.id;
                  return(
                    <button key={fb.id} onClick={()=>handleSelectFb(fb.id,acc)} style={{
                      display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,
                      border:`1.5px solid ${sel?T.borderRoyal:T.border}`,
                      background:sel?T.royalXs:"transparent",
                      cursor:"pointer",fontSize:10,fontWeight:700,
                      color:sel?T.royal:T.muted,fontFamily:FONT,transition:"all 0.12s",
                    }}>
                      <FbAvatar name={fb.facebookUserName} size={15}/>
                      <span style={{maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {fb.facebookUserName.split(" ")[0]}
                      </span>
                      {fb.tokenExpired&&<span style={{fontSize:10}}>⚠️</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {!isMobile&&<div style={{width:1,height:18,background:T.border}}/>}

            {/* Tabs */}
            <div style={{display:"flex",gap:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:3}}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)} style={{
                  padding:isMobile?"5px 10px":"5px 12px",
                  borderRadius:6,border:"none",cursor:"pointer",
                  fontSize:isMobile?10:11,fontWeight:700,fontFamily:FONT,
                  background:tab===t.id?`linear-gradient(135deg,${T.royal} 0%,${T.royalD} 100%)`:"transparent",
                  color:tab===t.id?"#fff":T.muted,
                  boxShadow:tab===t.id?T.shMd:"none",
                  transition:"all 0.15s",
                }}>{t.label}</button>
              ))}
            </div>

            {/* Status */}
            <div style={{
              display:"flex",alignItems:"center",gap:5,fontSize:9.5,fontWeight:600,fontFamily:FONT,
              color:loading?T.amber:T.green,
              background:loading?T.amberXs:T.greenXs,
              border:`1px solid ${loading?T.amberB:T.greenB}`,
              borderRadius:99,padding:"3px 9px",whiteSpace:"nowrap",
            }}>
              <div style={{width:5,height:5,borderRadius:"50%",background:loading?T.amber:T.green,boxShadow:`0 0 4px ${loading?T.amber:T.green}`}}/>
              {loading?"…":`${accounts.length} acct${accounts.length!==1?"s":""}`}
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div style={{padding:"0 14px 9px"}}>
          <div style={{
            display:"flex",alignItems:"center",gap:7,
            background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 11px",
          }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke={T.faint} strokeWidth="1.5"/>
              <path d="M10.5 10.5L13 13" stroke={T.faint} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              placeholder="Search business portfolios…"
              style={{flex:1,border:"none",outline:"none",fontSize:11,color:T.text,background:"transparent",fontFamily:FONT}}
            />
            {searchQuery&&(
              <button onClick={()=>setSearchQuery("")} style={{border:"none",background:"none",cursor:"pointer",color:T.faint,fontSize:12,lineHeight:1,padding:0}}>✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Error banners */}
      {error&&(
        <div style={{padding:"8px 14px",background:T.redXs,borderBottom:`1px solid ${T.redB}`,fontSize:11,color:T.red,fontWeight:700,fontFamily:FONT,flexShrink:0}}>
          ⚠ {error}
        </div>
      )}
      {partialErrors.length>0&&(
        <div style={{padding:"6px 14px",background:T.amberXs,borderBottom:`1px solid ${T.amberB}`,fontSize:10,color:T.amber,fontWeight:700,fontFamily:FONT,flexShrink:0}}>
          ⚠ Could not load: {partialErrors.map(e=>e.facebookUserName).join(", ")} — token may be expired
        </div>
      )}

      {/* ── Two-panel body ────────────────────────────────────────────────── */}
      <div style={{flex:1,display:"flex",overflow:"hidden",animation:"admIn 0.25s ease"}}>
        {loading?(
          <>
            <LeftPanelSkeleton/>
            <RightPanelSkeleton/>
          </>
        ):(
          <>
            <LeftPanel
              accounts={accounts}
              activeFbId={activeFbId}
              activeBMId={activeBMId}
              activePersonalFbId={activePersonalFbId}
              onSelectFb={handleSelectFb}
              onSelectBM={handleSelectBM}
              onSelectPersonal={handleSelectPersonal}
              searchQuery={searchQuery}
              isMobile={isMobile}
              isOpen={sidebarOpen}
              onClose={()=>setSidebarOpen(false)}
            />

            {tab==="overview"?(
              <BMDetailPanel activeBM={displayBM} selectedAccId={selectedAccId} onSelectAcc={setSelectedAccId} bp={bp}/>
            ):(
              <PeoplePanel
                activeBM={activeBM}
                activeFbId={activeFbId}
                team={team}
                loadingTeam={loadingTeam}
                errorTeam={errorTeam}
                onRefresh={()=>activeBMId&&fetchTeam(activeBMId,activeFbId)}
                bp={bp}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}