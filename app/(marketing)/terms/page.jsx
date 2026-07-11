"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  FileText, Shield, Users, AlertTriangle, Ban, Lock,
  Scale, XCircle, Globe, RefreshCw, Phone,
  ChevronRight, ExternalLink, Info, CheckCircle2, AlertCircle,
} from "lucide-react";

// ─── Brand ────────────────────────────────────────────────────────────────────
const BRAND = {
  name:    process.env.NEXT_PUBLIC_BRAND_NAME    || "Admigo.net",
  company: process.env.NEXT_PUBLIC_BRAND_COMPANY || "MARCADEO MEDIA PRIVATE LIMITED",
  email:   process.env.NEXT_PUBLIC_BRAND_EMAIL   || "admin@realfam.co.in",
  phone:   process.env.NEXT_PUBLIC_BRAND_PHONE   || "+91 6388807379",
  logo:    "/admigo.png",
};

// ─── Sections ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "overview",          icon: FileText,      label: "Overview",                 num: "1"  },
  { id: "eligibility",       icon: Users,         label: "Eligibility",              num: "2"  },
  { id: "account",           icon: Shield,        label: "Account Responsibilities", num: "3"  },
  { id: "permissions",       icon: Lock,          label: "Meta API Permissions",     num: "4"  },
  { id: "acceptable-use",    icon: Ban,           label: "Acceptable Use",           num: "5"  },
  { id: "data-restrictions", icon: AlertTriangle, label: "Data Use Restrictions",    num: "6"  },
  { id: "ip",                icon: Scale,         label: "Intellectual Property",    num: "7"  },
  { id: "disclaimer",        icon: AlertCircle,   label: "Disclaimers",              num: "8"  },
  { id: "liability",         icon: Shield,        label: "Limitation of Liability",  num: "9"  },
  { id: "termination",       icon: XCircle,       label: "Termination",              num: "10" },
  { id: "governing",         icon: Globe,         label: "Governing Law",            num: "11" },
  { id: "changes",           icon: RefreshCw,     label: "Changes to Terms",         num: "12" },
  { id: "contact-tos",       icon: Phone,         label: "Contact",                  num: "13" },
];

const PERMISSIONS = [
  { tag: "email",                  purpose: "Account identification, authentication, and transactional communications." },
  { tag: "public_profile",         purpose: "Dashboard personalization and account identity confirmation during login." },
  { tag: "ads_management",         purpose: "Create, edit, duplicate, pause, and delete campaigns, ad sets, and ads on your explicit instruction or pre-configured automation rules." },
  { tag: "ads_read",               purpose: "Read campaign performance data, spend, impressions, clicks, and conversions to power the dashboard and automation triggers." },
  { tag: "business_management",    purpose: "Access Business Manager structure, ad account and Page associations, and asset permissions to manage all your connected Meta assets." },
  { tag: "pages_show_list",        purpose: "Retrieve your managed Facebook Pages to allow you to select them as ad destinations and identities." },
  { tag: "pages_read_engagement",  purpose: "Read engagement metrics on your Pages (reach, likes, shares) to provide performance context and creative optimization." },
  { tag: "instagram_basic",        purpose: "Access your Instagram Business account details to connect it as an ad account identity within the platform." },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Callout({ type = "info", children }) {
  const map = {
    info:    { bg: "var(--royal-xs)",  border: "var(--border-royal)", icon: <Info className="callout-icon" style={{color:"var(--royal)"}}/>,          text: "var(--royal)" },
    warn:    { bg: "var(--amber-xs)",  border: "rgba(245,158,11,0.22)", icon: <AlertTriangle className="callout-icon" style={{color:"var(--amber)"}}/>, text: "var(--amber-d)" },
    success: { bg: "var(--green-xs)",  border: "rgba(34,197,94,0.22)",  icon: <CheckCircle2 className="callout-icon" style={{color:"var(--green)"}}/>,  text: "var(--green-d)" },
  };
  const s = map[type];
  return (
    <div style={{display:"flex",gap:"12px",padding:"14px 16px",borderRadius:"12px",border:`1px solid ${s.border}`,background:s.bg,margin:"14px 0"}}>
      {s.icon}
      <p style={{fontSize:"0.8rem",lineHeight:"1.7",margin:0,color:"var(--text2)"}}>{children}</p>
    </div>
  );
}

function SectionCard({ id, icon: Icon, num, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="sec-card">
        <div className="sec-card-head">
          <div className="sec-icon-wrap">
            <Icon className="sec-icon" />
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"8px",minWidth:0}}>
            <span className="sec-num">§{num}</span>
            <h2 className="sec-title">{title}</h2>
          </div>
        </div>
        <div className="sec-body">{children}</div>
      </div>
    </section>
  );
}

function SideNavLink({ section, isActive, onClick }) {
  const Icon = section.icon;
  return (
    <button onClick={onClick} className={`sidenav-btn${isActive ? " active" : ""}`}>
      <Icon className="sidenav-icon" />
      <span className="sidenav-label">{section.label}</span>
      {isActive && <span className="sidenav-dot" />}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TermsOfServicePage() {
  const [activeId, setActiveId] = useState("overview");
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const els = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean);
    const obs = new IntersectionObserver(
      entries => { entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.id); }); },
      { rootMargin: "-10% 0px -80% 0px" }
    );
    els.forEach(el => obs.observe(el));
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { obs.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, []);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const navElevated = scrollY > 30;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          /* ══════════════════════════════════════════════
             🏆 Royal Blue + Pure White + Ice Accent
             ══════════════════════════════════════════════ */

          /* Primary – Royal Blue */
          --royal:        #2B5CE6;
          --royal-d:      #1A3BAF;
          --royal-l:      #4A6FFF;
          --royal-xs:     rgba(43,92,230,0.06);
          --royal-s:      rgba(43,92,230,0.11);
          --royal-m:      rgba(43,92,230,0.20);
          --royal-glow:   rgba(43,92,230,0.30);
          --royal-glow2:  rgba(43,92,230,0.15);
          --border-royal: rgba(43,92,230,0.22);

          /* Ice / Sky accent */
          --ice:          #D0E4F7;
          --sky:          #4A90D9;
          --sky-s:        rgba(74,144,217,0.20);
          --sky-xs:       rgba(74,144,217,0.10);

          /* Deep Navy – navbar, footer, dark bands */
          --deep:         #1A3BAF;
          --deep-d:       #0D1B3E;

          /* Green – success / active */
          --green:        #22C55E;
          --green-d:      #16A34A;
          --green-s:      rgba(34,197,94,0.12);
          --green-xs:     rgba(34,197,94,0.07);

          /* Amber – warnings */
          --amber:        #F59E0B;
          --amber-d:      #D97706;
          --amber-s:      rgba(245,158,11,0.12);
          --amber-xs:     rgba(245,158,11,0.07);
          --amber-glow:   rgba(245,158,11,0.28);
          --sh-amb:       0 6px 22px rgba(245,158,11,0.28);

          /* Backgrounds – Pure White family */
          --bg:           #FFFFFF;
          --bg2:          #F5F9FF;
          --bg3:          #EBF3FD;
          --white:        #FFFFFF;

          /* Text */
          --text:         #0D1B3E;
          --text2:        #1A3BAF;
          --muted:        #4B6880;
          --faint:        #8AAFC8;

          /* Borders */
          --border:       rgba(43,92,230,0.10);
          --border2:      rgba(43,92,230,0.18);

          /* Typography */
          --sans:         'Sora', -apple-system, sans-serif;
          --mono:         'JetBrains Mono', monospace;

          /* Radii */
          --r:            18px;
          --r-sm:         12px;

          /* Shadows */
          --sh-xs:   0 1px 3px rgba(13,27,62,0.07);
          --sh-sm:   0 2px 8px rgba(13,27,62,0.09), 0 1px 3px rgba(13,27,62,0.04);
          --sh:      0 4px 16px rgba(13,27,62,0.10), 0 2px 6px rgba(13,27,62,0.05);
          --sh-lg:   0 12px 36px rgba(13,27,62,0.13), 0 4px 10px rgba(13,27,62,0.06);
          --sh-royal: 0 8px 28px rgba(43,92,230,0.28);
        }

        html { scroll-behavior: smooth; }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--sans);
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        /* ─ Background ─ */
        .bg-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .bg-mesh {
          background:
            radial-gradient(ellipse 70% 50% at 80% -5%,  rgba(43,92,230,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 50% 50% at -5% 75%,  rgba(208,228,247,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 100% 60%, rgba(26,59,175,0.04)  0%, transparent 50%);
        }
        .bg-dots {
          background-image: radial-gradient(circle, rgba(43,92,230,0.08) 1px, transparent 1px);
          background-size: 30px 30px;
          mask-image: radial-gradient(ellipse 100% 50% at 50% 0%, black, transparent 70%);
          opacity: 0.35;
        }

        /* ─ Nav ─ */
        .nav {
          position: sticky; top: 0; z-index: 200;
          transition: background 0.3s, box-shadow 0.3s, border-color 0.3s;
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(20px) saturate(1.6);
          -webkit-backdrop-filter: blur(20px) saturate(1.6);
          border-bottom: 1px solid transparent;
        }
        .nav.up {
          background: rgba(255,255,255,0.96);
          border-color: var(--ice);
          box-shadow: var(--sh-sm);
        }
        .nav-inner {
          max-width: 1240px; margin: 0 auto;
          padding: 0 2rem; height: 62px;
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
        }
        .nav-logo { display: flex; align-items: center; gap: 11px; text-decoration: none; }
        .nav-logo-wrap {
          width: 40px; height: 40px; border-radius: 13px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: var(--white); border: 1.5px solid var(--ice);
          box-shadow: var(--sh-xs);
          transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s;
        }
        .nav-logo:hover .nav-logo-wrap {
          transform: scale(1.08) rotate(-2deg);
          box-shadow: 0 4px 18px var(--royal-glow2);
        }
        .nav-brand-name { font-size: 0.9rem; font-weight: 800; color: var(--text); line-height: 1; letter-spacing: -0.03em; }
        .nav-brand-sub  { font-size: 0.6rem; color: var(--faint); margin-top: 2px; line-height: 1; font-weight: 500; letter-spacing: 0.03em; display: block; }
        .nav-breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--muted); }
        .nav-breadcrumb a { color: var(--muted); text-decoration: none; transition: color 0.15s; }
        .nav-breadcrumb a:hover { color: var(--royal); }
        .nav-breadcrumb .sep { color: var(--faint); font-size: 0.7rem; }
        .nav-breadcrumb .current { color: var(--text2); font-weight: 600; }
        .nav-right { display: flex; gap: 8px; align-items: center; }
        .btn-ghost {
          padding: 8px 16px; background: transparent;
          border: 1.5px solid var(--ice); border-radius: 11px;
          font-size: 0.78rem; font-weight: 700; color: var(--royal);
          text-decoration: none; letter-spacing: -0.01em; font-family: var(--sans);
          transition: border-color 0.2s, background 0.2s, transform 0.2s;
          cursor: pointer;
        }
        .btn-ghost:hover { border-color: var(--royal); background: var(--royal-xs); transform: translateY(-1px); }
        .btn-solid {
          padding: 8px 18px;
          background: linear-gradient(135deg, var(--royal), var(--royal-d));
          border: 1.5px solid var(--royal); border-radius: 11px;
          font-size: 0.78rem; font-weight: 700; color: white;
          text-decoration: none; letter-spacing: -0.01em; font-family: var(--sans);
          transition: all 0.22s;
          box-shadow: 0 2px 10px var(--royal-glow2);
        }
        .btn-solid:hover {
          background: linear-gradient(135deg, var(--royal-l), var(--royal));
          border-color: var(--royal-l);
          box-shadow: var(--sh-royal);
          transform: translateY(-1px);
        }

        /* ─ Hero band ─ */
        .hero-band {
          background: var(--white);
          border-bottom: 1px solid var(--ice);
          position: relative; z-index: 1; overflow: hidden;
        }
        .hero-band::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,1) 50%, rgba(208,228,247,0.20) 100%);
          pointer-events: none;
        }
        .hero-band::after {
          content: '';
          position: absolute; top: -60px; right: -100px;
          width: 500px; height: 500px;
          background: radial-gradient(ellipse, rgba(208,228,247,0.35) 0%, transparent 65%);
          border-radius: 50%; pointer-events: none;
          animation: heroGlow 8s ease-in-out infinite alternate;
        }
        @keyframes heroGlow {
          from { transform: scale(0.9); opacity: 0.7; }
          to   { transform: scale(1.1) translate(-20px, 30px); opacity: 1; }
        }
        .hero-inner {
          max-width: 1240px; margin: 0 auto;
          padding: 2.75rem 2rem 2.5rem;
          display: flex; align-items: flex-start; gap: 1.25rem;
          position: relative; z-index: 1;
        }
        .hero-icon-wrap {
          width: 52px; height: 52px; border-radius: 16px;
          background: var(--royal-xs); border: 1.5px solid var(--border-royal);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          box-shadow: var(--sh-sm);
        }
        .hero-icon-wrap svg { width: 26px; height: 26px; color: var(--royal); }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 0.65rem; font-weight: 700; color: var(--royal);
          background: var(--royal-xs); border: 1px solid var(--border-royal);
          padding: 4px 13px; border-radius: 100px;
          margin-bottom: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase;
        }
        .hero-badge::before {
          content: '';
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--royal); display: inline-block;
        }
        .hero-title {
          font-size: clamp(1.5rem, 3vw, 2.1rem); font-weight: 800;
          letter-spacing: -0.04em; color: var(--text); line-height: 1.1; margin-bottom: 0.5rem;
        }
        .hero-desc {
          font-size: 0.875rem; color: var(--muted); max-width: 560px; line-height: 1.7;
          margin-bottom: 0.9rem;
        }
        .hero-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
        .hero-meta-item { font-size: 0.72rem; color: var(--faint); }
        .hero-meta-item strong { color: var(--text2); font-weight: 600; }
        .hero-meta-sep { width: 4px; height: 4px; border-radius: 50%; background: var(--ice); }

        /* ─ Layout ─ */
        .page-body {
          max-width: 1240px; margin: 0 auto;
          padding: 2rem 2rem 4rem;
          display: flex; gap: 1.75rem; align-items: flex-start;
          position: relative; z-index: 1;
        }

        /* ─ Sidebar ─ */
        .sidebar {
          width: 220px; flex-shrink: 0;
          position: sticky; top: 82px;
        }
        .sidebar-card {
          background: var(--white);
          border: 1px solid var(--ice);
          border-radius: var(--r);
          box-shadow: var(--sh-sm);
          padding: 14px;
          overflow: hidden;
          position: relative;
        }
        .sidebar-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--ice), var(--sky), var(--royal-d));
        }
        .sidebar-label {
          font-size: 0.58rem; font-weight: 700; letter-spacing: 0.18em;
          text-transform: uppercase; color: var(--faint);
          padding: 0 8px 8px; display: block;
        }
        .sidenav-btn {
          width: 100%; display: flex; align-items: center; gap: 8px;
          padding: 7px 10px; border-radius: 10px;
          font-size: 0.73rem; font-weight: 600;
          font-family: var(--sans);
          color: var(--muted);
          border: none; background: none; cursor: pointer;
          transition: background 0.14s, color 0.14s;
          text-align: left;
        }
        .sidenav-btn:hover { background: var(--royal-xs); color: var(--text); }
        .sidenav-btn.active { background: var(--royal-s); color: var(--royal); }
        .sidenav-icon { width: 13px; height: 13px; flex-shrink: 0; color: var(--faint); }
        .sidenav-btn.active .sidenav-icon { color: var(--royal); }
        .sidenav-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sidenav-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--royal); flex-shrink: 0; }

        /* ─ Section cards ─ */
        .sec-card {
          background: var(--white);
          border: 1px solid var(--ice);
          border-radius: var(--r);
          box-shadow: var(--sh-sm);
          overflow: hidden;
          transition: box-shadow 0.25s, border-color 0.25s;
        }
        .sec-card:hover { box-shadow: var(--sh); border-color: rgba(43,92,230,0.18); }
        .sec-card-head {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 22px;
          border-bottom: 1px solid var(--ice);
          background: linear-gradient(to right, var(--bg2), var(--white));
          position: relative;
        }
        .sec-card-head::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--ice), var(--sky), var(--royal-d));
          opacity: 0.7;
        }
        .sec-icon-wrap {
          width: 34px; height: 34px; border-radius: 11px;
          background: var(--royal-xs); border: 1px solid var(--border-royal);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .sec-icon { width: 16px; height: 16px; color: var(--royal); }
        .sec-num  { font-size: 0.65rem; font-weight: 700; color: var(--faint); font-family: var(--mono); white-space: nowrap; }
        .sec-title { font-size: 0.9rem; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
        .sec-body {
          padding: 20px 22px;
          display: flex; flex-direction: column; gap: 10px;
          font-size: 0.83rem; color: var(--muted); line-height: 1.75;
        }
        .sec-body p { margin: 0; }
        .sec-body strong { color: var(--text); font-weight: 700; }
        .sec-body a { color: var(--royal); font-weight: 600; text-decoration: none; }
        .sec-body a:hover { text-decoration: underline; }

        /* ─ Lists ─ */
        .check-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .check-list li { display: flex; align-items: flex-start; gap: 10px; }
        .check-icon { width: 15px; height: 15px; color: var(--green); flex-shrink: 0; margin-top: 2px; }
        .x-icon     { width: 15px; height: 15px; color: #DC2626; flex-shrink: 0; margin-top: 2px; }
        .arr-icon   { width: 14px; height: 14px; color: var(--sky); flex-shrink: 0; margin-top: 3px; }

        /* ─ Callout icons ─ */
        .callout-icon { width: 15px; height: 15px; flex-shrink: 0; margin-top: 2px; }

        /* ─ Permissions table ─ */
        .perm-table-wrap {
          border: 1px solid var(--ice);
          border-radius: 14px; overflow: hidden; margin-top: 12px;
        }
        .perm-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
        .perm-table thead tr {
          background: var(--bg2);
          border-bottom: 1px solid var(--ice);
        }
        .perm-table th {
          text-align: left; padding: 10px 16px;
          font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--faint);
        }
        .perm-table tbody tr {
          border-bottom: 1px solid var(--ice);
          transition: background 0.14s;
        }
        .perm-table tbody tr:last-child { border-bottom: none; }
        .perm-table tbody tr:hover { background: var(--royal-xs); }
        .perm-table td { padding: 10px 16px; vertical-align: top; }
        .perm-code {
          font-family: var(--mono); font-size: 0.68rem; font-weight: 500;
          background: var(--royal-s); color: var(--royal);
          padding: 3px 9px; border-radius: 7px; white-space: nowrap;
        }
        .perm-desc { font-size: 0.75rem; color: var(--muted); line-height: 1.6; }

        /* ─ Data restriction items ─ */
        .data-item {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 12px 14px; background: var(--amber-xs);
          border: 1px solid rgba(245,158,11,0.20);
          border-radius: 12px;
        }
        .data-item svg { width: 15px; height: 15px; color: var(--amber); flex-shrink: 0; margin-top: 2px; }
        .data-item-title { font-size: 0.78rem; font-weight: 700; color: var(--text); display: block; margin-bottom: 3px; }
        .data-item-desc  { font-size: 0.75rem; color: var(--muted); line-height: 1.65; }

        /* ─ Liability box ─ */
        .liability-box {
          padding: 14px 16px; background: rgba(220,38,38,0.04);
          border: 1px solid rgba(220,38,38,0.16); border-radius: 12px; margin-top: 10px;
        }
        .liability-box p { font-size: 0.78rem; color: #991B1B; margin: 0; line-height: 1.65; }

        /* ─ Contact grid ─ */
        .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
        .contact-cell {
          padding: 14px 16px; background: var(--bg2);
          border: 1px solid var(--ice); border-radius: 13px;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .contact-cell:hover { border-color: var(--border-royal); background: var(--royal-xs); box-shadow: var(--sh-xs); }
        .contact-label { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--faint); margin-bottom: 5px; display: block; }
        .contact-value { font-size: 0.83rem; font-weight: 700; color: var(--text); word-break: break-word; }
        .contact-value.link { color: var(--royal); }
        .contact-value.link:hover { text-decoration: underline; }

        /* ─ Content area ─ */
        .content-area { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px; }

        /* ─ Ticker ─ */
        .ticker {
          background: linear-gradient(90deg, var(--deep-d) 0%, var(--royal-d) 100%);
          height: 36px;
          overflow: hidden; display: flex; align-items: center;
          position: relative; z-index: 1;
        }
        .ticker::before, .ticker::after {
          content: ''; position: absolute; top: 0; bottom: 0; width: 60px; z-index: 2;
        }
        .ticker::before { left: 0; background: linear-gradient(to right, var(--deep-d), transparent); }
        .ticker::after  { right: 0; background: linear-gradient(to left, var(--royal-d), transparent); }
        .ticker-track { display: flex; white-space: nowrap; animation: scroll 28s linear infinite; }
        .ticker-item {
          font-family: var(--mono); font-size: 0.62rem; font-weight: 500;
          color: rgba(208,228,247,0.55); padding: 0 1.75rem;
          display: flex; align-items: center; gap: 8px;
        }
        .ticker-item b { color: var(--ice); }
        .ticker-sep { color: rgba(208,228,247,0.22); }
        @keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        /* ─ Footer ─ */
        .footer {
          background: linear-gradient(90deg, var(--deep-d) 0%, var(--royal-d) 100%);
          position: relative; z-index: 1;
        }
        .footer-inner {
          max-width: 1240px; margin: 0 auto;
          padding: 1.4rem 2rem;
          display: flex; align-items: center; justify-content: space-between;
          gap: 1rem; flex-wrap: wrap;
        }
        .footer-brand { display: flex; align-items: center; gap: 10px; }
        .footer-logo-wrap {
          width: 30px; height: 30px; border-radius: 9px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.10); border: 1px solid rgba(208,228,247,0.18);
          flex-shrink: 0;
        }
        .footer-name    { font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.92); }
        .footer-sep-bar { font-size: 0.8rem; color: rgba(208,228,247,0.22); }
        .footer-company { font-size: 0.7rem; color: rgba(208,228,247,0.48); }
        .footer-links { display: flex; gap: 1.25rem; list-style: none; flex-wrap: wrap; }
        .footer-links a {
          font-size: 0.75rem; font-weight: 500;
          color: rgba(208,228,247,0.58); text-decoration: none;
          transition: color 0.15s;
        }
        .footer-links a:hover { color: var(--ice); }
        .footer-copy { font-size: 0.68rem; color: rgba(208,228,247,0.32); }

        /* ─ Responsive ─ */
        @media (max-width: 1024px) {
          .sidebar { display: none; }
        }
        @media (max-width: 640px) {
          .page-body { padding: 1.25rem 1.25rem 3rem; }
          .hero-inner { padding: 1.75rem 1.25rem; }
          .nav-inner { padding: 0 1.25rem; }
          .contact-grid { grid-template-columns: 1fr; }
          .footer-inner { flex-direction: column; align-items: flex-start; }
          .nav-breadcrumb { display: none; }
        }
      `}</style>

      {/* Background */}
      <div className="bg-layer bg-mesh" aria-hidden="true" />
      <div className="bg-layer bg-dots"  aria-hidden="true" />

      {/* ═══ NAV ═══ */}
      <header className={`nav${navElevated ? " up" : ""}`}>
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-wrap">
              <Image src={BRAND.logo} alt={BRAND.name} width={40} height={40} className="object-contain" />
            </div>
            <div>
              <span className="nav-brand-name">{BRAND.name}</span>
              <span className="nav-brand-sub">Legal Center</span>
            </div>
          </Link>

          <div className="nav-breadcrumb">
            <Link href="/">Home</Link>
            <span className="sep">›</span>
            <span className="current">Terms of Service</span>
          </div>

          <div className="nav-right">
            <Link href="/privacy-policy" className="btn-ghost">Privacy Policy</Link>
            <a href={`mailto:${BRAND.email}`} className="btn-solid">Contact Us</a>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <div className="ticker">
        <div className="ticker-track">
          {[...Array(2)].map((_,ri) =>
            ["Terms of Service","Legal Agreement","Meta API Compliance","Data Use Restrictions","User Responsibilities","Intellectual Property","Governing Law","Acceptable Use","Privacy & Security","Dispute Resolution"].map((item,i) => (
              <span className="ticker-item" key={`${ri}-${i}`}>
                <b>{item}</b><span className="ticker-sep">·</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* ═══ HERO ═══ */}
      <div className="hero-band">
        <div className="hero-inner">
          <div className="hero-icon-wrap">
            <FileText />
          </div>
          <div>
            <div className="hero-badge">Legal Document</div>
            <h1 className="hero-title">Terms of Service</h1>
            <p className="hero-desc">
              These Terms govern your use of {BRAND.name}, a Meta-integrated advertising automation platform operated by {BRAND.company}.
            </p>
            <div className="hero-meta">
              <span className="hero-meta-item">Last Updated: <strong>January 1, 2025</strong></span>
              <span className="hero-meta-sep" />
              <span className="hero-meta-item">Effective: <strong>January 1, 2025</strong></span>
              <span className="hero-meta-sep" />
              <span className="hero-meta-item">{BRAND.company}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="page-body">

        {/* Sidebar TOC */}
        <aside className="sidebar">
          <div className="sidebar-card">
            <span className="sidebar-label">Contents</span>
            <nav style={{display:"flex",flexDirection:"column",gap:"2px"}}>
              {SECTIONS.map(s => (
                <SideNavLink
                  key={s.id}
                  section={s}
                  isActive={activeId === s.id}
                  onClick={() => scrollTo(s.id)}
                />
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="content-area">

          {/* 1 Overview */}
          <SectionCard id="overview" icon={FileText} num="1" title="Overview">
            <p>Welcome to <strong>{BRAND.name}</strong>, operated by <strong>{BRAND.company}</strong>. We provide a Meta-integrated advertising automation platform that enables businesses to connect their Meta Business accounts and automate Facebook and Instagram advertising campaigns via the Meta Marketing API.</p>
            <p>By registering for or accessing {BRAND.name}, you agree to be legally bound by these Terms of Service. If you do not agree, you must not use our platform.</p>
            <Callout type="info">
              These Terms incorporate Meta's Platform Terms and Developer Policies by reference. Your use of Meta features through {BRAND.name} is additionally governed by Meta's own Terms of Service, Advertising Policies, and Community Standards.
            </Callout>
          </SectionCard>

          {/* 2 Eligibility */}
          <SectionCard id="eligibility" icon={Users} num="2" title="Eligibility">
            <p>To use {BRAND.name}, you must satisfy all of the following conditions:</p>
            <ul className="check-list" style={{marginTop:"8px"}}>
              {[
                "Be at least 18 years of age or the age of legal majority in your jurisdiction.",
                "Have the legal authority to enter into these Terms on behalf of yourself or a business entity.",
                "Hold a valid Meta Business Manager account with appropriate access rights to the Facebook Pages, Ad Accounts, and Instagram Business Accounts you wish to connect.",
                "Comply with all applicable local, national, and international laws, including Meta's Platform Terms and Advertising Policies.",
                "Not be a resident or national of any country subject to applicable trade sanctions or export restrictions.",
                `Not have been previously suspended or banned from ${BRAND.name} or Meta's advertising platforms.`,
              ].map((item, i) => (
                <li key={i}><CheckCircle2 className="check-icon" /><span>{item}</span></li>
              ))}
            </ul>
          </SectionCard>

          {/* 3 Account */}
          <SectionCard id="account" icon={Shield} num="3" title="Account Responsibilities">
            <p>You are solely responsible for maintaining the security and confidentiality of your {BRAND.name} credentials. You agree to:</p>
            <ul className="check-list" style={{marginTop:"8px"}}>
              {[
                "Provide accurate, current, and complete registration and billing information at all times.",
                `Promptly notify us at ${BRAND.email} of any unauthorized access to or use of your account.`,
                "Accept full responsibility for all activities, actions, and ad spend that occur under your account.",
                "Not share your credentials with unauthorized third parties.",
                `Maintain valid Meta OAuth tokens and promptly re-authorize ${BRAND.name} when tokens expire or are revoked.`,
                "Keep your connected Meta ad accounts in good standing and compliant with Meta's advertising policies.",
              ].map((item, i) => (
                <li key={i}><CheckCircle2 className="check-icon" /><span>{item}</span></li>
              ))}
            </ul>
            <Callout type="success">
              <strong>{BRAND.name} will never ask for your Facebook or Meta account password.</strong> All Meta authentication is handled exclusively through Meta's official OAuth 2.0 authorization flow.
            </Callout>
          </SectionCard>

          {/* 4 Permissions */}
          <SectionCard id="permissions" icon={Lock} num="4" title="Meta API Permissions & Authorized Use">
            <p>{BRAND.name} requests the following Meta platform permissions during your OAuth authorization. We act on your explicit instructions using only the access described below:</p>
            <div className="perm-table-wrap">
              <table className="perm-table">
                <thead>
                  <tr>
                    <th style={{width:"200px"}}>Permission</th>
                    <th>Purpose & Authorized Use</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((p, i) => (
                    <tr key={i}>
                      <td><code className="perm-code">{p.tag}</code></td>
                      <td className="perm-desc">{p.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout type="warn">
              {BRAND.name} only accesses Meta accounts and assets you explicitly authorize. We will never access accounts beyond your granted permissions, nor take automated actions beyond those you have configured or manually triggered. You may revoke access at any time via your{" "}
              <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener">Facebook App Settings</a>.
            </Callout>
          </SectionCard>

          {/* 5 Acceptable Use */}
          <SectionCard id="acceptable-use" icon={Ban} num="5" title="Acceptable Use Policy">
            <p>You agree to use {BRAND.name} only for lawful advertising purposes consistent with Meta's Advertising Policies and Platform Terms. You must <strong>not</strong> use {BRAND.name} to:</p>
            <ul className="check-list" style={{marginTop:"8px"}}>
              {[
                "Create, run, or automate ads that violate Meta's Advertising Standards, Community Standards, or any applicable laws.",
                "Conduct misleading, deceptive, or fraudulent advertising including false claims, bait-and-switch tactics, or promotion of counterfeit goods.",
                "Advertise prohibited content such as illegal products, adult content without proper age restrictions, hate speech, or content promoting violence.",
                "Run Special Ad Category campaigns (housing, employment, credit, health, political) without proper Meta category selection and required disclosures.",
                "Circumvent Meta's ad review systems or disguise non-compliant ad content to evade review.",
                "Access, harvest, or scrape user data beyond what is strictly required and permitted by Meta's Platform Terms.",
                `Reverse engineer, decompile, or extract source code from ${BRAND.name} or any Meta APIs.`,
                `Sell, sublicense, or transfer your ${BRAND.name} account access to third parties without our written consent.`,
                "Infringe any third party's intellectual property, privacy, or other legal rights through your advertising content.",
              ].map((item, i) => (
                <li key={i}><XCircle className="x-icon" /><span>{item}</span></li>
              ))}
            </ul>
            <p style={{marginTop:"8px",fontSize:"0.75rem",color:"var(--faint)"}}>Violations may result in immediate suspension or termination of your account and may be reported to Meta and relevant regulatory authorities.</p>
          </SectionCard>

          {/* 6 Data Restrictions */}
          <SectionCard id="data-restrictions" icon={AlertTriangle} num="6" title="Meta Advertising Data — Use Restrictions">
            <p>All Meta advertising data accessed through {BRAND.name} is subject to strict restrictions under Meta's Platform Terms:</p>
            <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"10px"}}>
              {[
                ["No cross-advertiser data commingling", "Data from one advertiser's ad account must not be combined with another advertiser's data for targeting, optimization, or analysis."],
                ["No user profile building", "Meta advertising data may not be used to build, append to, or augment user profiles outside of Meta's own platforms."],
                ["No data selling", "You must not sell, license, trade, or otherwise transfer Meta advertising data to any third party."],
                ["Service provider obligations", "If you share Meta advertising data with any third-party provider, that provider must be contractually bound to equivalent data use restrictions."],
                ["Aggregate reporting only", "Unless explicitly authorized by Meta, Meta advertising data may only be used to evaluate your own campaign performance on an aggregated, anonymized basis."],
              ].map(([title, desc], i) => (
                <div className="data-item" key={i}>
                  <AlertTriangle style={{width:"15px",height:"15px",color:"var(--amber)",flexShrink:0,marginTop:"2px"}} />
                  <div>
                    <span className="data-item-title">{title}</span>
                    <span className="data-item-desc">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <Callout type="success">
              {BRAND.name} never sells your Meta advertising data. We process it exclusively to operate the services you have subscribed to. See our{" "}
              <Link href="/privacy-policy">Privacy Policy</Link> for full details.
            </Callout>
          </SectionCard>

          {/* 7 IP */}
          <SectionCard id="ip" icon={Scale} num="7" title="Intellectual Property">
            <p>{BRAND.name} and all its original content, platform features, and functionality are the intellectual property of <strong>{BRAND.company}</strong>, protected under applicable copyright, trademark, and trade secret laws.</p>
            <p>You retain full ownership of your advertising content, creative assets, campaign configurations, and customer data. By using {BRAND.name}, you grant {BRAND.company} a limited, non-exclusive, royalty-free license to process, store, and display your content solely to operate the services you have requested. This license terminates upon account deletion.</p>
            <p>You represent and warrant that all advertising content you create or upload through {BRAND.name} does not infringe any third party's intellectual property rights.</p>
          </SectionCard>

          {/* 8 Disclaimers */}
          <SectionCard id="disclaimer" icon={AlertCircle} num="8" title="Disclaimers">
            <p>{BRAND.name} is provided on an <strong>"as is"</strong> and <strong>"as available"</strong> basis without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
            <p>We do not warrant that our services will be uninterrupted, error-free, or produce specific advertising results. Advertising performance depends on factors outside our control including Meta's algorithms, audience behavior, market conditions, your bid strategy, and your ad creative quality.</p>
            <Callout type="info">
              <strong>{BRAND.name} is an independent third-party platform and is not affiliated with, endorsed by, or in any official partnership with Meta Platforms, Inc.</strong> Meta, Facebook, Instagram, and related marks are trademarks of Meta Platforms, Inc.
            </Callout>
          </SectionCard>

          {/* 9 Liability */}
          <SectionCard id="liability" icon={Shield} num="9" title="Limitation of Liability">
            <p>To the maximum extent permitted under applicable law, <strong>{BRAND.company}</strong> shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of ad spend, lost profits, data loss, account suspension by Meta, or business interruption — arising from your use of {BRAND.name}.</p>
            <div className="liability-box">
              <p>Our total aggregate liability to you for any and all claims shall not exceed the greater of: <strong>(a)</strong> the total fees paid by you to {BRAND.name} in the twelve (12) months preceding the claim, or <strong>(b)</strong> ₹5,000 INR.</p>
            </div>
          </SectionCard>

          {/* 10 Termination */}
          <SectionCard id="termination" icon={XCircle} num="10" title="Termination">
            <p>We reserve the right to suspend or permanently terminate your {BRAND.name} account at any time if we reasonably believe you have violated these Terms, Meta's Platform Terms, or any applicable law. Upon termination:</p>
            <ul className="check-list" style={{marginTop:"8px"}}>
              {[
                `Your access to ${BRAND.name} will be revoked immediately and all automated actions halted.`,
                `${BRAND.name}'s API access to your Meta accounts will be revoked where technically possible.`,
                "You may request a data export within 30 days of termination, after which your data will be deleted per our retention policy.",
                "Any outstanding fees will remain due and payable.",
              ].map((item, i) => (
                <li key={i}><ChevronRight className="arr-icon" /><span>{item}</span></li>
              ))}
            </ul>
            <p>You may terminate your account at any time by contacting <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> and revoking {BRAND.name}'s access in your{" "}
              <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener" style={{display:"inline-flex",alignItems:"center",gap:"3px"}}>
                Facebook App Settings <ExternalLink style={{width:"12px",height:"12px"}} />
              </a>.
            </p>
          </SectionCard>

          {/* 11 Governing */}
          <SectionCard id="governing" icon={Globe} num="11" title="Governing Law & Dispute Resolution">
            <p>These Terms shall be governed by and construed in accordance with the laws of <strong>India</strong>, without regard to conflict of law principles. Any disputes arising out of or relating to these Terms shall be subject to the exclusive jurisdiction of the competent courts in India.</p>
            <p>Before initiating legal proceedings, you agree to attempt informal resolution by contacting us at <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>. We will make good-faith efforts to resolve disputes within 30 days of receiving written notice.</p>
          </SectionCard>

          {/* 12 Changes */}
          <SectionCard id="changes" icon={RefreshCw} num="12" title="Changes to These Terms">
            <p>{BRAND.company} reserves the right to update these Terms at any time to reflect changes in our services, legal requirements, or Meta's Platform Terms. We will provide notice of material changes by:</p>
            <ul className="check-list" style={{marginTop:"8px"}}>
              {[
                "Sending an email notification to your registered email address.",
                `Displaying a prominent notice within the ${BRAND.name} dashboard.`,
                `Updating the "Last Updated" date at the top of this page.`,
              ].map((item, i) => (
                <li key={i}><ChevronRight className="arr-icon" /><span>{item}</span></li>
              ))}
            </ul>
            <p>Your continued use of {BRAND.name} after the effective date of any revised Terms constitutes your acceptance of those changes.</p>
          </SectionCard>

          {/* 13 Contact */}
          <SectionCard id="contact-tos" icon={Phone} num="13" title="Contact Information">
            <p>For questions, concerns, or notices regarding these Terms of Service, please contact:</p>
            <div className="contact-grid">
              {[
                { label: "Company",              value: BRAND.company,  link: null },
                { label: "Platform",             value: BRAND.name,     link: `https://${BRAND.name.toLowerCase()}` },
                { label: "Legal & Support Email",value: BRAND.email,    link: `mailto:${BRAND.email}` },
                { label: "Phone",                value: BRAND.phone,    link: `tel:${BRAND.phone.replace(/\s/g,"")}` },
              ].map(({ label, value, link }, i) => (
                <div className="contact-cell" key={i}>
                  <span className="contact-label">{label}</span>
                  {link
                    ? <a href={link} className="contact-value link">{value}</a>
                    : <span className="contact-value">{value}</span>
                  }
                </div>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo-wrap">
              <Image src={BRAND.logo} alt={BRAND.name} width={30} height={30} className="object-contain" />
            </div>
            <span className="footer-name">{BRAND.name}</span>
            <span className="footer-sep-bar">—</span>
            <span className="footer-company">{BRAND.company}</span>
          </div>
          <ul className="footer-links">
            <li><Link href="/terms-of-service">Terms of Service</Link></li>
            <li><Link href="/privacy-policy">Privacy Policy</Link></li>
            <li><a href={`mailto:${BRAND.email}`}>Contact</a></li>
            <li><a href={`tel:${BRAND.phone.replace(/\s/g,"")}`}>{BRAND.phone}</a></li>
          </ul>
          <span className="footer-copy">© {new Date().getFullYear()} {BRAND.company}. All rights reserved.</span>
        </div>
      </footer>
    </>
  );
}