"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
    if (!n && n !== 0) return "—";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
    return String(n);
}
function initials(name = "") {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

const TASK_META = {
    ADVERTISE: { short: "Ads", color: "#1877F2", bg: "#E7F3FF" },
    CREATE_CONTENT: { short: "Content", color: "#00A400", bg: "#E8F5E8" },
    ANALYZE: { short: "Analyze", color: "#7B3FE4", bg: "#F3EDFF" },
    MESSAGING: { short: "Msgs", color: "#E67E00", bg: "#FFF3E0" },
    MODERATE: { short: "Mod", color: "#D62A2A", bg: "#FFECEC" },
    MANAGE: { short: "Manage", color: "#0099A8", bg: "#E0F7F9" },
};

const CAT_META = {
    "Business centre": { icon: "🏢" },
    "Financial service": { icon: "💰" },
    "Digital creator": { icon: "🎨" },
    "Advertising/marketing": { icon: "📣" },
    "Shopping service": { icon: "🛍️" },
    "Tech": { icon: "⚙️" },
    "Artist": { icon: "🎭" },
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
// KEY DESIGN DECISIONS FOR FIXED HEIGHT:
// - .conn-card has a fixed height: 112px (desktop), responsive on mobile
// - .conn-row has overflow:hidden, flex layout with strict heights
// - .conn-bottom has a fixed height: 34px, overflow:hidden
// - bio is strictly 1 line with text-overflow:ellipsis, white-space:nowrap
// - tasks row has height:18px, overflow:hidden, no-wrap
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#F0F2F5;
  --surface:#ffffff;
  --border:#E4E6EA;
  --border2:#CDD0D5;
  --text1:#050505;
  --text2:#65676B;
  --text3:#8A8D91;
  --blue:#1877F2;
  --blue-bg:#E7F3FF;
  --blue-hover:#166FE5;
  --ig1:#F58529;--ig2:#DD2A7B;--ig3:#8134AF;
  --radius:8px;--radius-lg:12px;--radius-xl:16px;
  --shadow:0 1px 3px rgba(0,0,0,.10),0 0 0 0.5px rgba(0,0,0,.05);
  --shadow-lg:0 4px 16px rgba(0,0,0,.13),0 0 0 0.5px rgba(0,0,0,.06);
  --font:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;

  /* Card height constants */
  --card-top-h: 104px;   /* main connection row */
  --card-bot-h: 50px;   /* tasks + bio strip */
  --card-h: 150px;      /* total = top + bot */
}
body{font-family:var(--font);background:var(--bg);min-height:100vh;}

/* ── Root layout ── */
.root{
  min-height:100vh;
  padding: 16px 10px;
  max-width:1236px;
  margin:0 auto;
  width:100%;
}

/* ── Topbar ── */
.topbar{
  display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:10px;
  background:var(--surface);
  border-radius:var(--radius-xl);
  padding:12px 18px;
  margin-bottom:14px;
  box-shadow:var(--shadow);
}
.topbar-left{display:flex;align-items:center;gap:10px;}
.topbar-logo{
  width:34px;height:34px;border-radius:9px;
  background:var(--blue);
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
}
.topbar-title{font-size:15px;font-weight:700;color:var(--text1);line-height:1.2;}
.topbar-sub{font-size:11px;color:var(--text3);font-weight:400;margin-top:1px;}

/* ── Account selector ── */
.acc-wrap{position:relative;}
.acc-btn{
  display:flex;align-items:center;gap:8px;
  padding:7px 10px;
  background:var(--bg);
  border:1.5px solid var(--border);
  border-radius:var(--radius-lg);
  cursor:pointer;font-family:var(--font);
  transition:border-color .15s,background .15s;
  min-width:196px;max-width:280px;
}
.acc-btn:hover{border-color:var(--blue);background:var(--blue-bg);}
.acc-badge{
  width:26px;height:26px;border-radius:7px;
  background:var(--blue);color:#fff;
  font-size:9px;font-weight:700;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
}
.acc-btn-name{font-size:12px;font-weight:600;color:var(--text1);flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.acc-btn-id{font-size:9px;color:var(--text3);}
.acc-dropdown{
  position:absolute;top:calc(100% + 4px);right:0;
  min-width:220px;
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow-lg);
  z-index:200;overflow:hidden;
}
.acc-dd-hdr{padding:7px 12px 5px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);background:var(--bg);border-bottom:1px solid var(--border);}
.acc-option{
  width:100%;display:flex;align-items:center;gap:8px;
  padding:8px 12px;background:transparent;border:none;
  cursor:pointer;font-family:var(--font);text-align:left;
  transition:background .1s;
}
.acc-option:hover{background:var(--blue-bg);}
.acc-option.active{background:var(--blue-bg);}
.acc-opt-name{font-size:12px;font-weight:600;color:var(--text1);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.acc-opt-id{font-size:9px;color:var(--text3);font-family:monospace;}

/* ── Stats strip ── */
.stats{
  display:grid;
  grid-template-columns:repeat(5,1fr);
  gap:8px;
  margin-bottom:14px;
}
.stat-card{
  background:var(--surface);
  border-radius:var(--radius-lg);
  padding:11px 12px;
  box-shadow:var(--shadow);
  animation:fadeUp .3s both;
  /* Fixed height stat card */
  height:72px;
  display:flex;flex-direction:column;justify-content:center;
}
.stat-icon{font-size:14px;margin-bottom:2px;line-height:1;}
.stat-val{font-size:20px;font-weight:700;color:var(--text1);line-height:1;}
.stat-lbl{font-size:9px;font-weight:600;color:var(--text3);margin-top:2px;text-transform:uppercase;letter-spacing:.06em;}

/* ── Filters bar ── */
.filters{
  display:flex;gap:8px;flex-wrap:wrap;
  margin-bottom:12px;
  align-items:center;
}
.search-wrap{position:relative;flex:1;min-width:180px;}
.search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);pointer-events:none;}
.search-input{
  width:100%;
  padding:8px 11px 8px 32px;
  background:var(--surface);
  border:1.5px solid var(--border);
  border-radius:var(--radius-lg);
  font-size:12px;font-family:var(--font);
  color:var(--text1);
  transition:border-color .15s;
  box-shadow:var(--shadow);
  height:34px;
}
.search-input::placeholder{color:var(--text3);}
.search-input:focus{outline:none;border-color:var(--blue);}

.filter-pill{
  display:flex;align-items:center;gap:4px;
  padding:0 11px;
  height:34px;
  background:var(--surface);
  border:1.5px solid var(--border);
  border-radius:999px;
  font-size:11px;font-weight:500;color:var(--text2);
  cursor:pointer;font-family:var(--font);
  box-shadow:var(--shadow);
  transition:all .15s;white-space:nowrap;
  flex-shrink:0;
}
.filter-pill:hover{border-color:var(--blue);color:var(--blue);background:var(--blue-bg);}
.filter-pill.active{background:var(--blue);border-color:var(--blue);color:#fff;}

.cat-dropdown{
  position:absolute;top:calc(100% + 4px);left:0;
  z-index:200;
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow-lg);
  min-width:175px;
  overflow:hidden;
}
.cat-option{
  width:100%;padding:8px 12px;
  background:transparent;border:none;
  font-family:var(--font);font-size:12px;font-weight:500;
  color:var(--text1);cursor:pointer;text-align:left;
  transition:background .1s;
  white-space:nowrap;
}
.cat-option:hover{background:var(--bg);}
.cat-option.active{background:var(--blue-bg);color:var(--blue);}

.refresh-btn{
  display:flex;align-items:center;gap:5px;
  height:34px;padding:0 14px;
  background:var(--blue);border:none;
  border-radius:var(--radius-lg);
  font-size:12px;font-weight:600;font-family:var(--font);
  color:#fff;cursor:pointer;
  box-shadow:0 2px 8px rgba(24,119,242,.28);
  transition:all .15s;flex-shrink:0;
}
.refresh-btn:hover{background:var(--blue-hover);transform:translateY(-1px);box-shadow:0 4px 12px rgba(24,119,242,.35);}
.refresh-btn:active{transform:none;}
.refresh-btn:disabled{opacity:.5;pointer-events:none;}
.spin{animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

/* ── Section header ── */
.sec-hdr{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:7px;padding:0 2px;
  height:22px; /* fixed so sections always same top offset */
}
.sec-title{font-size:11px;font-weight:600;color:var(--text2);display:flex;align-items:center;gap:5px;}
.sec-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.sec-count{font-size:10px;font-weight:600;color:var(--text3);background:var(--bg);padding:1px 8px;border-radius:999px;border:1px solid var(--border);}

/* ═══════════════════════════════════════════════════════════
   CONNECTION CARD — FIXED HEIGHT SYSTEM
   Total card height = --card-h (112px)
   .conn-row  = --card-top-h (78px)  — top portion
   .conn-bottom = --card-bot-h (34px) — bottom strip
   Nothing inside can expand vertically.
   ═══════════════════════════════════════════════════════════ */
.conn-card{
  background:var(--surface);
  border-radius:var(--radius-xl);
  box-shadow:var(--shadow);
  margin-bottom:6px;
  overflow:hidden;
  /* FIXED CARD HEIGHT */
  height:var(--card-h);
  display:flex;
  flex-direction:column;
  transition:box-shadow .18s,transform .15s;
  animation:fadeUp .28s both;
  will-change:transform;
}
.conn-card:hover{
  box-shadow:var(--shadow-lg);
  transform:translateY(-1px);
}
.conn-card.not-linked{opacity:.80;}
.conn-card.not-linked .conn-row{background:#FAFAFA;}

/* Top portion: strictly var(--card-top-h) tall */
.conn-row{
  display:grid;
  grid-template-columns:1fr 68px 1fr;
  align-items:center;
  padding:0 14px;
  gap:0;
  /* FIXED ROW HEIGHT */
  height:var(--card-top-h);
  flex-shrink:0;
  overflow:hidden;
}

/* Platform label */
.plat-lbl{
  display:flex;align-items:center;gap:4px;
  font-size:9px;font-weight:700;letter-spacing:.07em;
  text-transform:uppercase;color:var(--text3);
  /* Fixed label height */
  height:14px;
  margin-bottom:5px;
  overflow:hidden;
}

/* FB side */
.fb-side{
  display:flex;flex-direction:column;
  /* Fill the row height exactly */
  height:calc(var(--card-top-h) - 0px);
  justify-content:center;
  overflow:hidden;
}
.fb-account{display:flex;align-items:center;gap:9px;min-width:0;overflow:hidden;}
.fb-av{
  width:38px;height:38px;border-radius:8px;
  overflow:hidden;flex-shrink:0;
  border:1.5px solid var(--border);
  background:var(--blue-bg);
  display:flex;align-items:center;justify-content:center;
}
.fb-av img{width:100%;height:100%;object-fit:cover;display:block;}
.fb-av-txt{font-size:13px;font-weight:700;color:var(--blue);}
.fb-name{
  font-size:13.5px;font-weight:700;color:var(--text1);
  line-height:1.2;
  /* ONE LINE MAX */
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.fb-id{
  font-size:10px;color:var(--text3);font-family:monospace;
  margin-top:2px;
  /* ONE LINE MAX */
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.fb-cat{
  font-size:10.5px;color:var(--text2);font-weight:500;
  margin-top:3px;
  /* ONE LINE MAX */
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}

/* Bridge — center column */
.bridge{
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  gap:3px;
  padding:0 3px;
  height:100%;
  overflow:hidden;
}
.b-track{
  width:100%;display:flex;align-items:center;
  overflow:hidden;
}
.b-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
.b-line{flex:1;height:2px;min-width:0;}
.b-lbl{
  font-size:8px;font-weight:700;letter-spacing:.04em;
  white-space:nowrap;
}
/* Connected */
.bridge.conn .b-dot{background:var(--blue);}
.bridge.conn .b-line{background:linear-gradient(90deg,var(--blue),var(--ig2));}
.bridge.conn .b-lbl{color:var(--blue);}
/* Disconnected */
.bridge.disc .b-dot{background:var(--border2);}
.bridge.disc .b-line{background:repeating-linear-gradient(90deg,var(--border2) 0,var(--border2) 3px,transparent 3px,transparent 7px);}
.bridge.disc .b-lbl{color:var(--text3);}

/* IG side */
.ig-side{
  display:flex;flex-direction:column;
  align-items:flex-end;
  height:calc(var(--card-top-h) - 0px);
  justify-content:center;
  overflow:hidden;
}
.ig-account{
  display:flex;align-items:center;gap:9px;
  flex-direction:row-reverse;
  min-width:0;width:100%;overflow:hidden;
}
.ig-av-wrap{
  width:38px;height:38px;border-radius:50%;
  padding:2px;
  background:linear-gradient(45deg,var(--ig1),var(--ig2),var(--ig3));
  flex-shrink:0;
}
.ig-av-inner{
  width:100%;height:100%;border-radius:50%;
  overflow:hidden;background:#fff;
  display:flex;align-items:center;justify-content:center;
}
.ig-av-inner img{width:100%;height:100%;object-fit:cover;display:block;}
.ig-av-fallback{
  width:100%;height:100%;
  background:linear-gradient(135deg,var(--ig1),var(--ig2));
  display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;color:#fff;border-radius:50%;
}
.ig-none-av{
  width:38px;height:38px;border-radius:50%;
  border:1.5px dashed var(--border2);
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
}
.ig-info{text-align:right;min-width:0;flex:1;overflow:hidden;}
.ig-username{
  font-size:13.5px;font-weight:700;color:var(--text1);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.ig-display{
  font-size:10.5px;color:var(--text3);margin-top:2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
/* IG stats — fixed height row */
.ig-stats{
  display:flex;gap:8px;
  margin-top:4px;
  justify-content:flex-end;
  /* Fixed height, never wraps */
  height:28px;
  overflow:hidden;
  align-items:flex-start;
}
.ig-stat{text-align:right;flex-shrink:0;}
.ig-sv{font-size:13px;font-weight:700;color:var(--text1);line-height:1;}
.ig-sl{font-size:9px;color:var(--text3);font-weight:500;line-height:1;margin-top:2px;}
.ig-not-txt{font-size:12px;color:var(--text3);font-weight:500;}

/* ═══════════════════════════════════════════════════════════
   BOTTOM STRIP — STRICTLY FIXED HEIGHT
   height: var(--card-bot-h) = 34px
   Contains: tasks chips row (16px) + bio (14px) = 30px + 4px padding
   NO OVERFLOW ALLOWED.
   ═══════════════════════════════════════════════════════════ */
.conn-bottom{
  border-top:1px solid var(--border);
  /* FIXED HEIGHT — this is the key fix */
  height:var(--card-bot-h);
  flex-shrink:0;
  padding:0 14px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  gap:3px;
  overflow:hidden;
  background:var(--surface);
}
/* Tasks row — single line, no wrap */
.conn-tasks{
  display:flex;
  flex-wrap:nowrap;  /* NEVER WRAP */
  gap:3px;
  /* Fixed height */
  height:16px;
  overflow:hidden;
  align-items:center;
  flex-shrink:0;
}
.task-chip{
  padding:1px 7px;
  border-radius:999px;
  font-size:9px;font-weight:600;
  white-space:nowrap;
  flex-shrink:0;
  line-height:14px;
  height:16px;
  display:inline-flex;align-items:center;
}
/* Bio — strictly single line */
.conn-bio{
  font-size:10px;color:var(--text3);
  line-height:1.3;
  /* SINGLE LINE, NO EXPAND */
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  /* Fixed height = one line */
  height:13px;
  flex-shrink:0;
}
/* When no bio: tasks row centers vertically */
.conn-bottom.no-bio{
  justify-content:center;
}

/* ── Error ── */
.error-bar{
  display:flex;align-items:center;gap:8px;
  padding:10px 14px;margin-bottom:12px;
  background:#FFF0F0;
  border-radius:var(--radius-lg);
  border:1px solid #FECACA;
  font-size:12px;font-weight:500;color:#D62A2A;
}

/* ── Skeleton — matches exact card height ── */
.skel-card{
  background:var(--surface);
  border-radius:var(--radius-xl);
  box-shadow:var(--shadow);
  margin-bottom:6px;
  height:var(--card-h);
  display:flex;flex-direction:column;
  overflow:hidden;
}
.skel-top{
  display:grid;
  grid-template-columns:1fr 68px 1fr;
  align-items:center;
  padding:0 14px;
  height:var(--card-top-h);
  flex-shrink:0;
}
.skel-bot{
  height:var(--card-bot-h);
  border-top:1px solid var(--border);
  padding:0 14px;
  display:flex;align-items:center;gap:4px;
  flex-shrink:0;
}
.sk{background:#E4E6EA;border-radius:4px;animation:shimmer 1.4s ease-in-out infinite;}
.sk-r{border-radius:999px;}
@keyframes shimmer{0%,100%{opacity:1}50%{opacity:.42}}

/* ── Empty state ── */
.empty{text-align:center;padding:52px 24px;}
.empty-icon{font-size:26px;margin-bottom:10px;}
.empty-title{font-size:13px;font-weight:700;color:var(--text2);}
.empty-sub{font-size:11px;color:var(--text3);margin-top:3px;}

/* ── Footer ── */
.dash-footer{text-align:center;margin-top:18px;font-size:10px;color:var(--text3);font-family:monospace;}

/* ── Animations ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:none;}}

/* ═══════════════════════════════════════════════════════════
   RESPONSIVE BREAKPOINTS
   ≥1100px  : full desktop, 3-col card
    900–1099 : medium desktop, 3-col card, smaller fonts
    640–899  : tablet, 3-col card, compressed
    480–639  : large phone, cards stack vertically (1-col)
    <480px   : small phone, compact 1-col
   ═══════════════════════════════════════════════════════════ */

/* Medium desktop: shrink slightly */
@media(max-width:1099px){
  .fb-name,.ig-username{font-size:11px;}
  .stats{grid-template-columns:repeat(5,1fr);}
}

/* Tablet */
@media(max-width:899px){
  :root{
    --card-top-h:78px;
    --card-bot-h:32px;
    --card-h:110px;
  }
  .conn-row{grid-template-columns:1fr 58px 1fr;}
  .fb-av,.ig-av-wrap{width:34px;height:34px;}
  .ig-av-wrap{padding:2px;}
  .fb-name,.ig-username{font-size:12.5px;}
  .stat-val{font-size:18px;}
  .stat-card{height:68px;}
  .stats{grid-template-columns:repeat(5,1fr);gap:6px;}
}

/* Large phone: switch to stacked layout */
@media(max-width:639px){
  :root{
    --card-top-h:auto;
    --card-bot-h:32px;
    --card-h:auto;  /* auto height on mobile — stacked layout */
  }
  .root{padding:12px 10px 32px;}
  .topbar{flex-direction:column;align-items:stretch;gap:10px;padding:12px 14px;}
  .topbar-left{justify-content:flex-start;}
  .acc-btn{width:100%;max-width:100%;min-width:0;}
  .acc-dropdown{right:auto;left:0;width:100%;}
  .stats{grid-template-columns:repeat(3,1fr);gap:6px;}
  .stat-card{height:64px;padding:9px 10px;}
  .stat-val{font-size:17px;}

  /* On mobile: card is auto height, stacked sections */
  .conn-card{
    height:auto;
    flex-direction:column;
  }
  .conn-row{
    grid-template-columns:1fr;
    height:auto;
    padding:10px 12px;
    gap:8px;
  }
  /* On mobile, bridge becomes a horizontal separator with status */
  .bridge{
    flex-direction:row;
    height:20px;
    justify-content:flex-start;
    padding:0;
    gap:6px;
  }
  .b-track{width:36px;flex-shrink:0;}
  .b-lbl{font-size:9px;}

  .fb-side,.ig-side{
    height:auto;
    justify-content:flex-start;
  }
  .ig-side{align-items:flex-start;}
  .ig-account{flex-direction:row;}
  .ig-info{text-align:left;}
  .ig-stats{justify-content:flex-start;}
  .ig-not-txt{text-align:left;}
  .plat-lbl{margin-bottom:4px;}

  .conn-bottom{
    height:auto;
    min-height:var(--card-bot-h);
    padding:6px 12px 8px;
  }
  .conn-tasks{flex-wrap:wrap;height:auto;}
  .conn-bio{
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    height:14px;
  }
}

/* Small phone */
@media(max-width:479px){
  .stats{grid-template-columns:repeat(2,1fr);}
  .filters{gap:6px;}
  .filter-pill{font-size:10px;padding:0 9px;}
  .fb-av,.ig-av-wrap{width:32px;height:32px;}
  .fb-name,.ig-username{font-size:12px;}
  .fb-cat,.ig-display{font-size:10px;}
  .ig-sv{font-size:12px;}
  .topbar-title{font-size:14px;}
}
`;

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCards() {
    return (
        <>
            {[...Array(5)].map((_, i) => (
                <div className="skel-card" key={i} style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="skel-top">
                        {/* left */}
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div className="sk" style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="sk" style={{ height: 10, width: "72%", marginBottom: 5 }} />
                                <div className="sk" style={{ height: 8, width: "45%", marginBottom: 4 }} />
                                <div className="sk" style={{ height: 8, width: "55%" }} />
                            </div>
                        </div>
                        {/* center */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 3px" }}>
                            <div className="sk" style={{ width: "100%", height: 2 }} />
                            <div className="sk" style={{ width: 26, height: 8, borderRadius: 4 }} />
                        </div>
                        {/* right */}
                        <div style={{ display: "flex", alignItems: "center", gap: 9, flexDirection: "row-reverse" }}>
                            <div className="sk" style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                                <div className="sk" style={{ height: 10, width: "60%", marginBottom: 5, marginLeft: "auto" }} />
                                <div className="sk" style={{ height: 8, width: "40%", marginBottom: 4, marginLeft: "auto" }} />
                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                    <div className="sk sk-r" style={{ height: 8, width: 28 }} />
                                    <div className="sk sk-r" style={{ height: 8, width: 22 }} />
                                    <div className="sk sk-r" style={{ height: 8, width: 30 }} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="skel-bot">
                        {[36, 44, 36, 42, 30, 40].map((w, j) => (
                            <div key={j} className="sk sk-r" style={{ height: 14, width: w }} />
                        ))}
                    </div>
                </div>
            ))}
        </>
    );
}

// ─── Avatars ──────────────────────────────────────────────────────────────────
function FbAvatar({ src, name }) {
    const [err, setErr] = useState(false);
    if (src && !err) {
        return (
            <img
                src={src} alt={name}
                onError={() => setErr(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
        );
    }
    return <div className="fb-av-txt">{initials(name)}</div>;
}

function IgAvatar({ src, username }) {
    const [err, setErr] = useState(false);
    if (src && !err) {
        return (
            <img
                src={src} alt={username}
                onError={() => setErr(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
        );
    }
    return <div className="ig-av-fallback">{initials(username || "IG").slice(0, 2)}</div>;
}

// ─── Connection Card ──────────────────────────────────────────────────────────
function ConnectionCard({ page, index }) {
    const ig = page.instagramAccount;
    const linked = !!ig;
    const cat = CAT_META[page.category] || { icon: "📁" };

    // Normalize bio: replace newlines, trim, collapse spaces
    const bioText = ig?.biography
        ? ig.biography.replace(/\n+/g, " · ").replace(/\s+/g, " ").trim()
        : "";

    return (
        <div
            className={`conn-card${linked ? "" : " not-linked"}`}
            style={{ animationDelay: `${index * 35}ms` }}
        >
            {/* ── TOP ROW ── */}
            <div className="conn-row">

                {/* LEFT: Facebook Page */}
                <div className="fb-side">
                    <div className="plat-lbl">
                        <svg width="12" height="12" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
                            <circle cx="18" cy="18" r="18" fill="#1877F2" />
                            <path fill="#fff" d="M22.5 11.5h-2c-.8 0-1 .4-1 1V14h3l-.4 3H19.5V26H16V17h-2v-3h2v-1.7C16 9.6 17.5 8 20.3 8c1.3 0 2.2.1 2.2.1v2.4z" />
                        </svg>
                        Facebook Page
                    </div>
                    <div className="fb-account">
                        <div className="fb-av">
                            <FbAvatar src={page.picture} name={page.name} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                            <div className="fb-name" title={page.name}>{page.name}</div>
                            <div className="fb-id">{page.metaPageId}</div>
                            <div className="fb-cat">{cat.icon} {page.category}</div>
                        </div>
                    </div>
                </div>

                {/* CENTER: Bridge */}
                <div className={`bridge ${linked ? "conn" : "disc"}`}>
                    <div className="b-track">
                        <div className="b-dot" />
                        <div className="b-line" />
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                            <path
                                d="M2 1L8 5L2 9"
                                stroke={linked ? "#DD2A7B" : "#CDD0D5"}
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                    <div className="b-lbl">{linked ? "linked" : "no link"}</div>
                </div>

                {/* RIGHT: Instagram */}
                <div className="ig-side">
                    <div className="plat-lbl" style={{ justifyContent: "flex-end" }}>
                        Instagram
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                            <defs>
                                <linearGradient id={`ig-grad-${page.id}`} x1="0" y1="1" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#F58529" />
                                    <stop offset="50%" stopColor="#DD2A7B" />
                                    <stop offset="100%" stopColor="#8134AF" />
                                </linearGradient>
                            </defs>
                            <rect width="24" height="24" rx="6" fill={linked ? `url(#ig-grad-${page.id})` : "#CDD0D5"} />
                            <circle cx="12" cy="12" r="4" stroke="#fff" strokeWidth="1.8" fill="none" />
                            <circle cx="17" cy="7" r="1.2" fill="#fff" />
                        </svg>
                    </div>

                    {ig ? (
                        <div className="ig-account">
                            <div className="ig-av-wrap">
                                <div className="ig-av-inner">
                                    <IgAvatar src={ig.profilePictureUrl} username={ig.username} />
                                </div>
                            </div>
                            <div className="ig-info">
                                <div className="ig-username" title={`@${ig.username}`}>@{ig.username}</div>
                                {ig.name && <div className="ig-display">{ig.name}</div>}
                                <div className="ig-stats">
                                    <div className="ig-stat">
                                        <div className="ig-sv">{fmt(ig.followersCount)}</div>
                                        <div className="ig-sl">followers</div>
                                    </div>
                                    <div className="ig-stat">
                                        <div className="ig-sv">{ig.mediaCount}</div>
                                        <div className="ig-sl">posts</div>
                                    </div>
                                    <div className="ig-stat">
                                        <div className="ig-sv">{fmt(ig.followsCount)}</div>
                                        <div className="ig-sl">following</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="ig-account">
                            <div className="ig-none-av">
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#CDD0D5" strokeWidth={1.5}>
                                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                    <circle cx="12" cy="12" r="4" />
                                    <circle cx="17.5" cy="6.5" r="1" fill="#CDD0D5" stroke="none" />
                                </svg>
                            </div>
                            <div className="ig-info">
                                <div className="ig-not-txt">Not linked</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── BOTTOM STRIP — fixed 34px ── */}
            <div className={`conn-bottom${bioText ? "" : " no-bio"}`}>
                {/* Tasks: single row, no wrap, chips truncate if too many */}
                <div className="conn-tasks">
                    {page.tasks.map((t) => {
                        const m = TASK_META[t] || { short: t, color: "#65676B", bg: "#F0F2F5" };
                        return (
                            <span
                                key={t}
                                className="task-chip"
                                title={t}
                                style={{ background: m.bg, color: m.color }}
                            >
                                {m.short}
                            </span>
                        );
                    })}
                </div>
                {/* Bio: strictly one line, always same height slot */}
                {bioText && (
                    <div className="conn-bio" title={bioText}>
                        {bioText}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Account Selector ─────────────────────────────────────────────────────────
function AccountSelector({ accounts, selected, onSelect, loading }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        function h(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    if (loading) {
        return (
            <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px", background: "#F0F2F5",
                borderRadius: 12, minWidth: 180,
            }}>
                <div className="sk" style={{ width: 26, height: 26, borderRadius: 7 }} />
                <div style={{ flex: 1 }}>
                    <div className="sk" style={{ height: 10, width: "60%", marginBottom: 4 }} />
                    <div className="sk" style={{ height: 8, width: "40%" }} />
                </div>
            </div>
        );
    }

    return (
        <div className="acc-wrap" ref={ref}>
            <button className="acc-btn" onClick={() => setOpen(v => !v)}>
                <div className="acc-badge">{initials(selected?.name)}</div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div className="acc-btn-name">{selected?.name || "Select account"}</div>
                    <div className="acc-btn-id">{selected?.metaAccountId || "—"}</div>
                </div>
                <svg
                    style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: "#8A8D91" }}
                    width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && (
                <div className="acc-dropdown">
                    <div className="acc-dd-hdr">Ad Accounts</div>
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                        {accounts.map(a => (
                            <button
                                key={a.id || a.metaAccountId}
                                className={`acc-option ${a.metaAccountId === selected?.metaAccountId ? "active" : ""}`}
                                onClick={() => { onSelect(a); setOpen(false); }}
                            >
                                <div
                                    className="acc-badge"
                                    style={{
                                        background: a.metaAccountId === selected?.metaAccountId ? "#1877F2" : "#E4E6EA",
                                        color: a.metaAccountId === selected?.metaAccountId ? "#fff" : "#65676B",
                                    }}
                                >
                                    {initials(a.name)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="acc-opt-name">{a.name}</div>
                                    <div className="acc-opt-id">{a.metaAccountId}</div>
                                </div>
                                {a.metaAccountId === selected?.metaAccountId && (
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#1877F2" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Category Dropdown ────────────────────────────────────────────────────────
function CatDropdown({ categories, value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    return (
        <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
            <button
                className={`filter-pill${value !== "all" ? " active" : ""}`}
                onClick={() => setOpen(v => !v)}
            >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
                </svg>
                {value === "all" ? "Category" : value}
                <svg
                    width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && (
                <div className="cat-dropdown">
                    {categories.map(c => (
                        <button
                            key={c}
                            className={`cat-option${value === c ? " active" : ""}`}
                            onClick={() => { onChange(c); setOpen(false); }}
                        >
                            {c === "all" ? "All categories" : `${CAT_META[c]?.icon || "📁"} ${c}`}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FacebookPagesTable() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [adAccounts, setAdAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [accountsLoading, setAccountsLoading] = useState(true);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const [search, setSearch] = useState("");
    const [catFilter, setCatFilter] = useState("all");
    const [igOnly, setIgOnly] = useState(false);

    // ── fetch ad accounts ──
    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/meta-accounts", { credentials: "include" });
                if (res.ok) {
                    const { accounts } = await res.json();
                    setAdAccounts(accounts);
                    const paramId = searchParams.get("metaAccountId");
                    const match = paramId ? accounts.find(a => a.metaAccountId === paramId) : null;
                    const init = match || accounts[0] || null;
                    if (init) {
                        setSelectedAccount(init);
                        if (!paramId) pushParam(init.metaAccountId);
                    }
                }
            } finally { setAccountsLoading(false); }
        }
        load();
    }, []); // eslint-disable-line

    // ── fetch pages ──
    useEffect(() => {
        if (selectedAccount?.metaAccountId) fetchData(selectedAccount.metaAccountId);
    }, [selectedAccount]); // eslint-disable-line

    function pushParam(id) {
        const p = new URLSearchParams(searchParams.toString());
        p.set("metaAccountId", id);
        router.push(`${pathname}?${p.toString()}`);
    }

    function handleAccountSelect(account) {
        setSelectedAccount(account);
        setData(null); setError(null);
        setSearch(""); setCatFilter("all"); setIgOnly(false);
        pushParam(account.metaAccountId);
    }

    async function fetchData(id) {
        setRefreshing(true); setLoading(true);
        try {
            const res = await fetch(`/api/meta/facebook-pages?adAccountId=${id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
            setError(null);
        } catch (e) {
            setError(e.message || "Failed to load pages");
        } finally { setLoading(false); setRefreshing(false); }
    }

    // ── Derived ──
    const categories = data
        ? ["all", ...Array.from(new Set(data.pages.map(p => p.category)))]
        : ["all"];

    const filtered = data?.pages.filter(p => {
        const q = search.toLowerCase();
        const ms = !q
            || p.name.toLowerCase().includes(q)
            || p.category.toLowerCase().includes(q)
            || (p.instagramAccount?.username || "").toLowerCase().includes(q)
            || (p.instagramAccount?.biography || "").toLowerCase().includes(q)
            || p.metaPageId.includes(q);
        const mc = catFilter === "all" || p.category === catFilter;
        const mi = !igOnly || !!p.instagramAccount;
        return ms && mc && mi;
    }) || [];

    const igCount = data?.pages.filter(p => p.instagramAccount).length || 0;
    const noIgCount = (data?.count || 0) - igCount;
    const totalFoll = data?.pages.reduce((s, p) => s + (p.instagramAccount?.followersCount || 0), 0) || 0;
    const totalPost = data?.pages.reduce((s, p) => s + (p.instagramAccount?.mediaCount || 0), 0) || 0;

    const connectedCards = filtered.filter(p => p.instagramAccount);
    const unlinkedCards = filtered.filter(p => !p.instagramAccount);

    return (
        <>
            <style>{CSS}</style>
            <div className="root">

                {/* ── Topbar ── */}
                <div className="topbar">
                    <div className="topbar-left">
                        <div className="topbar-logo">
                            <svg width="18" height="18" viewBox="0 0 36 36" fill="white">
                                <path d="M15 35.8C6.5 34.3 0 27 0 18 0 8.1 8.1 0 18 0s18 8.1 18 18c0 9-6.5 16.3-15 17.8l-1-.8h-4l-1 .8z" />
                                <path fill="#1877F2" d="M25 23l.8-5H21v-3.5c0-1.4.7-2.5 2.7-2.5H26V7.4S24.1 7 22.4 7c-4.1 0-6.7 2.5-6.7 6.9V18h-4.5v5h4.5v12.8c1 .1 1.9.2 2.8.2s1.9-.1 2.8-.2V23H25z" />
                            </svg>
                        </div>
                        <div>
                            <div className="topbar-title">Pages & Accounts</div>
                            <div className="topbar-sub">Facebook → Instagram connections</div>
                        </div>
                    </div>
                    <AccountSelector
                        accounts={adAccounts}
                        selected={selectedAccount}
                        onSelect={handleAccountSelect}
                        loading={accountsLoading}
                    />
                </div>

                {/* ── Stats ── */}
                {data && (
                    <div className="stats">
                        {[
                            { icon: "📄", val: data.count, lbl: "Pages", delay: "0ms" },
                            { icon: "🔗", val: igCount, lbl: "Linked", delay: "40ms" },
                            { icon: "👥", val: fmt(totalFoll), lbl: "Followers", delay: "80ms" },
                            { icon: "🖼️", val: fmt(totalPost), lbl: "Posts", delay: "120ms" },
                            { icon: "🚫", val: noIgCount, lbl: "Unlinked", delay: "160ms" },
                        ].map(s => (
                            <div className="stat-card" key={s.lbl} style={{ animationDelay: s.delay }}>
                                <div className="stat-icon">{s.icon}</div>
                                <div className="stat-val">{s.val}</div>
                                <div className="stat-lbl">{s.lbl}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Filters ── */}
                <div className="filters">
                    <div className="search-wrap">
                        <svg className="search-icon" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search page, @username, category…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <CatDropdown categories={categories} value={catFilter} onChange={setCatFilter} />

                    <button
                        className={`filter-pill${igOnly ? " active" : ""}`}
                        onClick={() => setIgOnly(v => !v)}
                    >
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                            <circle cx="12" cy="12" r="4" />
                            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                        </svg>
                        IG only
                    </button>

                    <button
                        className="refresh-btn"
                        onClick={() => selectedAccount && fetchData(selectedAccount.metaAccountId)}
                        disabled={refreshing || !selectedAccount}
                    >
                        <svg
                            className={refreshing ? "spin" : ""}
                            width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>

                {/* ── Error ── */}
                {error && (
                    <div className="error-bar">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
                            <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* ── Loading ── */}
                {loading && <SkeletonCards />}

                {/* ── Cards ── */}
                {!loading && !error && data && (
                    <>
                        {/* Connected section */}
                        {connectedCards.length > 0 && (
                            <>
                                <div className="sec-hdr">
                                    <span className="sec-title">
                                        <span className="sec-dot" style={{ background: "#1DA462" }} />
                                        Connected to Instagram
                                    </span>
                                    <span className="sec-count">{connectedCards.length}</span>
                                </div>
                                {connectedCards.map((page, i) => (
                                    <ConnectionCard key={page.id} page={page} index={i} />
                                ))}
                            </>
                        )}

                        {/* Unlinked section */}
                        {unlinkedCards.length > 0 && !igOnly && (
                            <>
                                <div className="sec-hdr" style={{ marginTop: connectedCards.length ? 16 : 0 }}>
                                    <span className="sec-title">
                                        <span className="sec-dot" style={{ background: "#CDD0D5" }} />
                                        Not linked to Instagram
                                    </span>
                                    <span className="sec-count">{unlinkedCards.length}</span>
                                </div>
                                {unlinkedCards.map((page, i) => (
                                    <ConnectionCard key={page.id} page={page} index={connectedCards.length + i} />
                                ))}
                            </>
                        )}

                        {/* Empty */}
                        {filtered.length === 0 && (
                            <div className="empty">
                                <div className="empty-icon">🔍</div>
                                <div className="empty-title">No pages match your filters</div>
                                <div className="empty-sub">Try adjusting your search or category filter</div>
                            </div>
                        )}
                    </>
                )}

                {data?.message && (
                    <div className="dash-footer">{data.message}</div>
                )}
            </div>
        </>
    );
}
