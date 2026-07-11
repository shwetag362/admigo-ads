"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Shield, Database, Eye, Share2, Clock, Lock,
  CheckSquare, Globe, Cookie, Users, Trash2,
  RefreshCw, Phone, ChevronRight, ExternalLink,
  Info, CheckCircle2, AlertTriangle, FileText,
} from "lucide-react";

// ─── Brand ────────────────────────────────────────────────────────────────────
const BRAND = {
  name:    process.env.NEXT_PUBLIC_BRAND_NAME    || "Admigo.net",
  company: process.env.NEXT_PUBLIC_BRAND_COMPANY || "MARCADEO MEDIA PRIVATE LIMITED",
  email:   process.env.NEXT_PUBLIC_BRAND_EMAIL   || "admin@realfam.co.in",
  phone:   process.env.NEXT_PUBLIC_BRAND_PHONE   || "+91 6388807379",
  logo:    "/admigo.png",
};
const DELETION_URL = `https://${(BRAND.name).toLowerCase()}/api/meta/delete-callback`;

// ─── Sections ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "pp-overview",  icon: Shield,      num: "1",  label: "Overview" },
  { id: "pp-collect",   icon: Database,    num: "2",  label: "Data We Collect" },
  { id: "pp-meta-data", icon: Eye,         num: "3",  label: "Meta Platform Data" },
  { id: "pp-use",       icon: FileText,    num: "4",  label: "How We Use Data" },
  { id: "pp-sharing",   icon: Share2,      num: "5",  label: "Data Sharing" },
  { id: "pp-retention", icon: Clock,       num: "6",  label: "Data Retention" },
  { id: "pp-security",  icon: Lock,        num: "7",  label: "Security" },
  { id: "pp-rights",    icon: CheckSquare, num: "8",  label: "Your Rights" },
  { id: "pp-gdpr",      icon: Globe,       num: "9",  label: "GDPR & CCPA" },
  { id: "pp-cookies",   icon: Cookie,      num: "10", label: "Cookies" },
  { id: "pp-children",  icon: Users,       num: "11", label: "Children's Privacy" },
  { id: "pp-deletion",  icon: Trash2,      num: "12", label: "Data Deletion" },
  { id: "pp-changes",   icon: RefreshCw,   num: "13", label: "Policy Changes" },
  { id: "pp-contact",   icon: Phone,       num: "14", label: "Contact Us" },
];

const META_DATA = [
  {
    tags: ["email", "public_profile"],
    data: "Email address, name, profile picture URL, Meta User ID.",
    purpose: "Account creation, authentication, and dashboard personalization.",
  },
  {
    tags: ["ads_management", "ads_read"],
    data: "Campaign structures, ad sets, ad creatives, targeting parameters, delivery status, spend, impressions, clicks, conversions, ROAS, and all performance metrics.",
    purpose: "Power the dashboard, automation rules, reporting features, and budget alerting.",
  },
  {
    tags: ["business_management"],
    data: "Business Manager portfolio structure, ad account and Page associations, users, and permission levels.",
    purpose: "Display and manage all connected Meta business assets in one workspace.",
  },
  {
    tags: ["pages_show_list", "pages_read_engagement"],
    data: "Page names, IDs, and public engagement metrics (reach, post likes, shares, interactions).",
    purpose: "List Pages as ad destinations and display Page performance context.",
  },
  {
    tags: ["instagram_basic"],
    data: "Instagram Business account username, user ID, profile picture, and follower count.",
    purpose: "Connect Instagram identity as an ad account identity in campaigns.",
  },
];

const USER_RIGHTS = [
  { icon: Eye,         title: "Access",           desc: "Request a copy of the personal data we hold about you." },
  { icon: FileText,    title: "Correction",        desc: "Request correction of inaccurate or incomplete personal data." },
  { icon: Trash2,      title: "Deletion",          desc: "Request deletion of your personal data, subject to legal retention requirements." },
  { icon: Database,    title: "Portability",       desc: "Receive your data in a structured, machine-readable format." },
  { icon: Clock,       title: "Restriction",       desc: "Request restriction of processing of your data in certain circumstances." },
  { icon: Shield,      title: "Objection",         desc: "Object to processing of your data based on our legitimate interests." },
  { icon: RefreshCw,   title: "Withdraw Consent",  desc: "Withdraw consent at any time without affecting prior processing." },
  { icon: Globe,       title: "Complaint",         desc: "Lodge a complaint with your local data protection authority (EEA users)." },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Callout({ type = "info", children }) {
  const map = {
    info:    { bg: "var(--royal-xs)",  border: "var(--border-royal)",       icon: <Info      style={{width:"15px",height:"15px",color:"var(--royal)",  flexShrink:0,marginTop:"2px"}} /> },
    warn:    { bg: "var(--amber-xs)",  border: "rgba(245,158,11,0.22)",     icon: <AlertTriangle style={{width:"15px",height:"15px",color:"var(--amber)",flexShrink:0,marginTop:"2px"}} /> },
    success: { bg: "var(--green-xs)",  border: "rgba(34,197,94,0.22)",      icon: <CheckCircle2  style={{width:"15px",height:"15px",color:"var(--green)",flexShrink:0,marginTop:"2px"}} /> },
  };
  const s = map[type];
  return (
    <div style={{display:"flex",gap:"12px",padding:"14px 16px",borderRadius:"12px",border:`1px solid ${s.border}`,background:s.bg,margin:"10px 0"}}>
      {s.icon}
      <p style={{fontSize:"0.79rem",lineHeight:"1.72",margin:0,color:"var(--text2)"}}>{children}</p>
    </div>
  );
}

function SectionCard({ id, icon: Icon, num, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="sec-card">
        <div className="sec-card-head">
          <div className="sec-icon-wrap"><Icon className="sec-icon" /></div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrivacyPolicyPage() {
  const [activeId, setActiveId] = useState("pp-overview");
  const [scrollY, setScrollY]   = useState(0);

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

  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
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

          /* Deep Navy – footer, dark bands */
          --deep:         #1A3BAF;
          --deep-d:       #0D1B3E;

          /* Green – success */
          --green:        #22C55E;
          --green-d:      #16A34A;
          --green-s:      rgba(34,197,94,0.12);
          --green-xs:     rgba(34,197,94,0.07);

          /* Amber – warnings */
          --amber:        #F59E0B;
          --amber-d:      #D97706;
          --amber-s:      rgba(245,158,11,0.12);
          --amber-xs:     rgba(245,158,11,0.07);
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
            radial-gradient(ellipse 50% 50% at -5% 70%,  rgba(208,228,247,0.18) 0%, transparent 60%),
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
        .nav-breadcrumb .current { color: var(--text2); font-weight: 600; }
        .nav-right { display: flex; gap: 8px; align-items: center; }
        .btn-ghost {
          padding: 8px 16px; background: transparent;
          border: 1.5px solid var(--ice); border-radius: 11px;
          font-size: 0.78rem; font-weight: 700; color: var(--royal);
          text-decoration: none; font-family: var(--sans);
          transition: border-color 0.2s, background 0.2s, transform 0.2s;
        }
        .btn-ghost:hover { border-color: var(--royal); background: var(--royal-xs); transform: translateY(-1px); }
        .btn-solid {
          padding: 8px 18px;
          background: linear-gradient(135deg, var(--royal), var(--royal-d));
          border: 1.5px solid var(--royal); border-radius: 11px;
          font-size: 0.78rem; font-weight: 700; color: white;
          text-decoration: none; font-family: var(--sans);
          transition: all 0.22s;
          box-shadow: 0 2px 10px var(--royal-glow2);
        }
        .btn-solid:hover {
          background: linear-gradient(135deg, var(--royal-l), var(--royal));
          border-color: var(--royal-l);
          box-shadow: var(--sh-royal);
          transform: translateY(-1px);
        }

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
        .ticker-track { display: flex; white-space: nowrap; animation: tickerScroll 28s linear infinite; }
        .ticker-item {
          font-family: var(--mono); font-size: 0.62rem; font-weight: 500;
          color: rgba(208,228,247,0.55); padding: 0 1.75rem;
          display: flex; align-items: center; gap: 8px;
        }
        .ticker-item b { color: var(--ice); }
        .ticker-sep { color: rgba(208,228,247,0.22); }
        @keyframes tickerScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        /* ─ Hero band ─ */
        .hero-band {
          background: var(--white);
          border-bottom: 1px solid var(--ice);
          position: relative; z-index: 1; overflow: hidden;
        }
        .hero-band::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,1) 50%, rgba(208,228,247,0.18) 100%);
          pointer-events: none;
        }
        .hero-band::after {
          content: '';
          position: absolute; top: -60px; right: -100px;
          width: 480px; height: 480px;
          background: radial-gradient(ellipse, rgba(208,228,247,0.35) 0%, transparent 65%);
          border-radius: 50%; pointer-events: none;
          animation: heroGlow 8s ease-in-out infinite alternate;
        }
        @keyframes heroGlow {
          from { transform: scale(0.9); opacity:0.7; }
          to   { transform: scale(1.1) translate(-20px,30px); opacity:1; }
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
          font-size: 0.875rem; color: var(--muted); max-width: 580px; line-height: 1.72; margin-bottom: 0.9rem;
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
        .sidebar { width: 220px; flex-shrink: 0; position: sticky; top: 82px; }
        .sidebar-card {
          background: var(--white);
          border: 1px solid var(--ice);
          border-radius: var(--r); box-shadow: var(--sh-sm);
          padding: 14px; overflow: hidden; position: relative;
        }
        .sidebar-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
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
          font-size: 0.72rem; font-weight: 600; font-family: var(--sans);
          color: var(--muted); border: none; background: none; cursor: pointer;
          transition: background 0.14s, color 0.14s; text-align: left;
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
          border-radius: var(--r); box-shadow: var(--sh-sm); overflow: hidden;
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
        .sec-icon  { width: 16px; height: 16px; color: var(--royal); }
        .sec-num   { font-size: 0.65rem; font-weight: 700; color: var(--faint); font-family: var(--mono); white-space: nowrap; }
        .sec-title { font-size: 0.9rem; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
        .sec-body {
          padding: 20px 22px; display: flex; flex-direction: column; gap: 10px;
          font-size: 0.82rem; color: var(--muted); line-height: 1.75;
        }
        .sec-body p { margin: 0; }
        .sec-body strong { color: var(--text); font-weight: 700; }
        .sec-body a { color: var(--royal); font-weight: 600; text-decoration: none; }
        .sec-body a:hover { text-decoration: underline; }
        .sec-body em { font-style: italic; color: var(--muted); }

        /* ─ Data collect cards ─ */
        .collect-grid { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
        .collect-item {
          padding: 12px 14px; background: var(--bg2);
          border: 1px solid var(--ice); border-radius: 13px;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .collect-item:hover { border-color: var(--border-royal); background: var(--royal-xs); box-shadow: var(--sh-xs); }
        .collect-item-title { font-size: 0.78rem; font-weight: 700; color: var(--text); margin-bottom: 4px; display: block; }
        .collect-item-desc  { font-size: 0.75rem; color: var(--muted); line-height: 1.65; margin: 0; }

        /* ─ Permissions table ─ */
        .perm-table-wrap { border: 1px solid var(--ice); border-radius: 14px; overflow: hidden; margin-top: 12px; }
        .perm-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
        .perm-table thead tr { background: var(--bg2); border-bottom: 1px solid var(--ice); }
        .perm-table th {
          text-align: left; padding: 10px 14px;
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--faint);
        }
        .perm-table tbody tr { border-bottom: 1px solid var(--ice); transition: background 0.14s; }
        .perm-table tbody tr:last-child { border-bottom: none; }
        .perm-table tbody tr:hover { background: var(--royal-xs); }
        .perm-table td { padding: 10px 14px; vertical-align: top; line-height: 1.65; }
        .perm-tags { display: flex; flex-direction: column; gap: 4px; }
        .perm-code {
          font-family: var(--mono); font-size: 0.65rem; font-weight: 500;
          background: var(--royal-s); color: var(--royal);
          padding: 3px 8px; border-radius: 6px; white-space: nowrap; width: fit-content;
        }
        .perm-cell-muted { font-size: 0.73rem; color: var(--muted); }

        /* ─ Check / arrow lists ─ */
        .check-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .check-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 0.82rem; }
        .check-icon { width: 15px; height: 15px; color: var(--green); flex-shrink: 0; margin-top: 2px; }
        .arr-icon   { width: 14px; height: 14px; color: var(--sky); flex-shrink: 0; margin-top: 3px; }

        /* ─ Share items ─ */
        .share-items { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
        .share-item {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 11px 14px; background: var(--bg2);
          border: 1px solid var(--ice); border-radius: 12px;
          transition: border-color 0.2s, background 0.2s;
        }
        .share-item:hover { border-color: var(--border-royal); background: var(--royal-xs); }
        .share-item svg { width: 14px; height: 14px; color: var(--royal); flex-shrink: 0; margin-top: 2px; }
        .share-title { font-size: 0.75rem; font-weight: 700; color: var(--text); display: block; margin-bottom: 2px; }
        .share-desc  { font-size: 0.72rem; color: var(--muted); line-height: 1.6; }

        /* ─ Retention table ─ */
        .ret-table-wrap { border: 1px solid var(--ice); border-radius: 14px; overflow: hidden; margin-top: 10px; }
        .ret-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
        .ret-table thead tr { background: var(--bg2); border-bottom: 1px solid var(--ice); }
        .ret-table th {
          text-align: left; padding: 10px 14px;
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--faint);
        }
        .ret-table tbody tr { border-bottom: 1px solid var(--ice); transition: background 0.14s; }
        .ret-table tbody tr:last-child { border-bottom: none; }
        .ret-table tbody tr:hover { background: var(--royal-xs); }
        .ret-table td { padding: 10px 14px; vertical-align: middle; }
        .ret-type   { font-weight: 600; color: var(--text); font-size: 0.78rem; }
        .ret-period { color: var(--muted); font-size: 0.75rem; }

        /* ─ Security grid ─ */
        .security-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
        .sec-item {
          display: flex; align-items: flex-start; gap: 11px;
          padding: 12px 14px; background: var(--bg2);
          border: 1px solid var(--ice); border-radius: 12px;
          transition: border-color 0.2s, background 0.2s, transform 0.2s;
        }
        .sec-item:hover { border-color: var(--border-royal); background: var(--royal-xs); transform: translateY(-2px); }
        .sec-item-emoji { font-size: 1.1rem; line-height: 1; flex-shrink: 0; }
        .sec-item-title { font-size: 0.75rem; font-weight: 700; color: var(--text); display: block; margin-bottom: 1px; }
        .sec-item-desc  { font-size: 0.7rem; color: var(--muted); }

        /* ─ Rights grid ─ */
        .rights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
        .right-item {
          display: flex; align-items: flex-start; gap: 11px;
          padding: 13px 14px; background: var(--bg2);
          border: 1px solid var(--ice); border-radius: 13px;
          transition: border-color 0.2s, background 0.2s, transform 0.2s;
        }
        .right-item:hover { border-color: var(--border-royal); background: var(--royal-xs); transform: translateY(-2px); }
        .right-icon-wrap {
          width: 28px; height: 28px; border-radius: 9px;
          background: var(--royal-xs); border: 1px solid var(--border-royal);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .right-icon-wrap svg { width: 13px; height: 13px; color: var(--royal); }
        .right-title { font-size: 0.75rem; font-weight: 700; color: var(--text); display: block; margin-bottom: 2px; }
        .right-desc  { font-size: 0.7rem; color: var(--muted); line-height: 1.6; }

        /* ─ GDPR / CCPA blocks ─ */
        .gdpr-block {
          padding: 14px 16px; border-radius: 13px; border: 1px solid;
        }
        .gdpr-block.eu   { background: var(--royal-xs); border-color: var(--border-royal); }
        .gdpr-block.ca   { background: var(--amber-xs); border-color: rgba(245,158,11,0.22); }
        .gdpr-block-title {
          font-size: 0.75rem; font-weight: 700; margin-bottom: 6px;
          display: flex; align-items: center; gap: 6px;
        }
        .gdpr-block.eu .gdpr-block-title { color: var(--royal-d); }
        .gdpr-block.ca .gdpr-block-title { color: var(--amber-d); }
        .gdpr-block-title svg { width: 14px; height: 14px; }
        .gdpr-text { font-size: 0.75rem; line-height: 1.7; margin: 0; color: var(--muted); }
        .gdpr-block a { color: var(--royal); font-weight: 600; }

        /* ─ Cookie items ─ */
        .cookie-items { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
        .cookie-item  { padding: 12px 14px; border-radius: 12px; border: 1px solid; }
        .cookie-item.essential  { background: rgba(220,38,38,0.04);  border-color: rgba(220,38,38,0.16); }
        .cookie-item.preference { background: var(--amber-xs);       border-color: rgba(245,158,11,0.20); }
        .cookie-item.analytics  { background: var(--green-xs);       border-color: rgba(34,197,94,0.20); }
        .cookie-type { font-size: 0.73rem; font-weight: 700; margin-bottom: 4px; }
        .cookie-item.essential  .cookie-type { color: #991B1B; }
        .cookie-item.preference .cookie-type { color: var(--amber-d); }
        .cookie-item.analytics  .cookie-type { color: var(--green-d); }
        .cookie-desc { font-size: 0.72rem; line-height: 1.65; color: var(--muted); margin: 0; }

        /* ─ Deletion box ─ */
        .deletion-box {
          padding: 14px 16px; background: var(--green-xs);
          border: 1px solid rgba(34,197,94,0.22); border-radius: 13px; margin-top: 10px;
        }
        .deletion-box-title {
          font-size: 0.75rem; font-weight: 700; color: var(--green-d);
          display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
        }
        .deletion-box-title svg { width: 14px; height: 14px; }
        .deletion-url {
          font-family: var(--mono); font-size: 0.68rem; color: var(--green-d);
          background: rgba(34,197,94,0.10); padding: 8px 12px;
          border-radius: 9px; display: block; word-break: break-all;
        }
        .deletion-box-note { font-size: 0.72rem; color: var(--green-d); margin-top: 8px; margin-bottom: 0; opacity: 0.85; }

        /* ─ Contact grid ─ */
        .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
        .contact-cell {
          padding: 13px 15px; background: var(--bg2);
          border: 1px solid var(--ice); border-radius: 13px;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .contact-cell:hover { border-color: var(--border-royal); background: var(--royal-xs); box-shadow: var(--sh-xs); }
        .contact-label { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--faint); margin-bottom: 5px; display: block; }
        .contact-value { font-size: 0.82rem; font-weight: 700; color: var(--text); word-break: break-word; }
        .contact-value.link { color: var(--royal); cursor: pointer; text-decoration: none; }
        .contact-value.link:hover { text-decoration: underline; }
        .contact-value.mono { font-family: var(--mono); font-size: 0.65rem; font-weight: 500; color: var(--muted); }

        /* ─ Content area ─ */
        .content-area { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px; }

        /* ─ Footer ─ */
        .footer {
          background: linear-gradient(90deg, var(--deep-d) 0%, var(--royal-d) 100%);
          position: relative; z-index: 1;
        }
        .footer-inner {
          max-width: 1240px; margin: 0 auto; padding: 1.4rem 2rem;
          display: flex; align-items: center; justify-content: space-between;
          gap: 1rem; flex-wrap: wrap;
        }
        .footer-brand { display: flex; align-items: center; gap: 10px; }
        .footer-logo-wrap {
          width: 30px; height: 30px; border-radius: 9px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.10); border: 1px solid rgba(208,228,247,0.18); flex-shrink: 0;
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
        @media (max-width: 1024px) { .sidebar { display: none; } }
        @media (max-width: 768px)  { .security-grid, .rights-grid { grid-template-columns: 1fr; } }
        @media (max-width: 640px)  {
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
            <span style={{color:"var(--faint)"}}>›</span>
            <span className="current">Privacy Policy</span>
          </div>

          <div className="nav-right">
            <Link href="/terms" className="btn-ghost">Terms of Service</Link>
            <a href={`mailto:${BRAND.email}`} className="btn-solid">Contact Us</a>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <div className="ticker">
        <div className="ticker-track">
          {[...Array(2)].map((_,ri) =>
            ["Privacy Policy","Data Protection","GDPR Compliance","CCPA Rights","Meta API Data","Data Deletion","Security Measures","User Rights","Cookie Policy","Data Retention"].map((item,i) => (
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
          <div className="hero-icon-wrap"><Shield /></div>
          <div>
            <div className="hero-badge">Legal Document</div>
            <h1 className="hero-title">Privacy Policy</h1>
            <p className="hero-desc">
              This Privacy Policy explains how {BRAND.company} collects, uses, and protects your data when you use {BRAND.name}, including all data accessed via Meta's APIs on your behalf.
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
                <SideNavLink key={s.id} section={s} isActive={activeId === s.id} onClick={() => scrollTo(s.id)} />
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="content-area">

          {/* 1 Overview */}
          <SectionCard id="pp-overview" icon={Shield} num="1" title="Overview">
            <p><strong>{BRAND.company}</strong> operates {BRAND.name} and is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal data when you use our Meta advertising automation platform.</p>
            <p>This policy has been prepared to satisfy the requirements of <strong>Meta's Platform Terms for apps requesting Advanced Access permissions</strong>, as well as applicable data protection laws including GDPR and CCPA.</p>
            <Callout type="info">
              {BRAND.name} functions as a <strong>data processor</strong> for Meta advertising data — meaning we process it strictly on your instruction. For personal data of end-users appearing in your ad audience and performance data, you are the <strong>data controller</strong> and bear primary responsibility for lawful processing.
            </Callout>
          </SectionCard>

          {/* 2 Data We Collect */}
          <SectionCard id="pp-collect" icon={Database} num="2" title="Data We Collect">
            <div className="collect-grid">
              {[
                { title: "Account & Registration Data", desc: `When you create a ${BRAND.name} account or sign in via Meta OAuth, we collect your name, email address, profile picture URL, Meta User ID, and information you voluntarily provide during onboarding.` },
                { title: "Usage & Log Data",            desc: "We automatically collect IP address, browser type, device information, OS, pages viewed, features used, actions taken, and timestamps. Used for security, debugging, and platform improvement." },
                { title: "Payment & Billing Data",      desc: "Payment and billing information is collected and processed by our PCI-DSS compliant third-party payment processor. We do not store full credit card numbers or CVV codes on our servers." },
                { title: "Support & Communications",    desc: "If you contact our support team, we retain records including your name, email, and the content of your inquiry to resolve issues and improve support quality." },
              ].map(({ title, desc }, i) => (
                <div className="collect-item" key={i}>
                  <span className="collect-item-title">{title}</span>
                  <p className="collect-item-desc">{desc}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 3 Meta Platform Data */}
          <SectionCard id="pp-meta-data" icon={Eye} num="3" title="Meta Platform Data We Access">
            <p>When you connect your Meta accounts to {BRAND.name}, we access the following data via Meta's APIs based on the permissions you explicitly grant:</p>
            <div className="perm-table-wrap">
              <table className="perm-table">
                <thead>
                  <tr>
                    <th style={{width:"170px"}}>Permissions</th>
                    <th>Data Accessed</th>
                    <th style={{width:"220px"}}>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {META_DATA.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <div className="perm-tags">
                          {row.tags.map(t => <code className="perm-code" key={t}>{t}</code>)}
                        </div>
                      </td>
                      <td className="perm-cell-muted">{row.data}</td>
                      <td className="perm-cell-muted">{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout type="warn">
              <strong>We do not access private messages, personal content of your audience, or any data not listed above.</strong> Meta advertising data is used exclusively to power your {BRAND.name} workspace — never for our own advertising, user profiling, or third-party sales.
            </Callout>
          </SectionCard>

          {/* 4 How We Use Data */}
          <SectionCard id="pp-use" icon={FileText} num="4" title="How We Use Your Data">
            <p>We use the data we collect for the following clearly defined purposes:</p>
            <ul className="check-list" style={{marginTop:"8px"}}>
              {[
                ["Service delivery",                     `Operate, maintain, and provide ${BRAND.name}'s features including dashboard display, campaign automation, performance reporting, budget alerting, and scheduled actions.`],
                ["Authentication & security",            "Verify your identity, manage sessions, detect unauthorized access, prevent fraud, and protect the integrity of our platform and your Meta assets."],
                ["Account management",                   "Manage your subscription, process payments, send transactional emails, and provide customer support."],
                ["Your explicit automation instructions", `Execute the automated advertising actions — campaign creation, budget adjustments, ad pausing, rule triggers — that you configure within ${BRAND.name}.`],
                ["Platform improvement",                 `Analyze aggregated, anonymized usage patterns (not your Meta advertising data) to improve ${BRAND.name}'s features and user experience.`],
                ["Legal compliance",                     "Comply with applicable laws, regulations, or valid legal requests, and enforce our Terms of Service."],
              ].map(([title, desc], i) => (
                <li key={i}>
                  <CheckCircle2 className="check-icon" />
                  <span><strong>{title}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
            <Callout type="success">
              We will <strong>never</strong> use your Meta advertising data for our own ad targeting, to profile other users, to train commercial machine learning models, or to benchmark against other advertisers without your explicit consent.
            </Callout>
          </SectionCard>

          {/* 5 Data Sharing */}
          <SectionCard id="pp-sharing" icon={Share2} num="5" title="Data Sharing & Disclosure">
            <p><strong>We do not sell, rent, or trade your personal data or Meta advertising data.</strong> We may share data only in the following limited circumstances:</p>
            <div className="share-items">
              {[
                ["Service providers & sub-processors", "Trusted third-party vendors (cloud hosting, payment processors, email delivery, analytics) that process data solely on our behalf under strict Data Processing Agreements (DPAs)."],
                ["Meta Platforms, Inc.",               "Certain data is transmitted to Meta's servers as part of API calls (ad creation, performance fetch). This is governed by Meta's own Privacy Policy and Platform Terms."],
                ["Legal requirements",                 "We may disclose data if required by law, court order, or governmental authority, or to protect the rights, property, or safety of our users or the public."],
                ["Business transfers",                 "In the event of a merger or acquisition, data may transfer to the successor entity under the same privacy protections, with prior notice to you."],
                ["With your explicit consent",         "We may share data for any other purpose only with your prior explicit written consent."],
              ].map(([title, desc], i) => (
                <div className="share-item" key={i}>
                  <ChevronRight style={{width:"14px",height:"14px",color:"var(--royal)",flexShrink:0,marginTop:"2px"}} />
                  <div>
                    <span className="share-title">{title}</span>
                    <span className="share-desc">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 6 Data Retention */}
          <SectionCard id="pp-retention" icon={Clock} num="6" title="Data Retention">
            <p>We retain your data only for as long as necessary to fulfill the purposes described in this policy:</p>
            <div className="ret-table-wrap">
              <table className="ret-table">
                <thead>
                  <tr>
                    <th>Data Type</th>
                    <th>Retention Period</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Active account data",                "Duration of account + 90 days after deletion"],
                    ["Meta OAuth tokens & API credentials","Deleted immediately upon disconnection or revocation"],
                    ["Campaign & performance data",        "Up to 24 months (earlier deletion available on request)"],
                    ["Billing & financial records",        "7 years (required by Indian tax and accounting laws)"],
                    ["Log & security data",                "Up to 12 months for security auditing"],
                    ["Support communications",             "2 years after ticket resolution"],
                  ].map(([type, period], i) => (
                    <tr key={i}>
                      <td className="ret-type">{type}</td>
                      <td className="ret-period">{period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{marginTop:"10px",fontSize:"0.75rem",color:"var(--faint)"}}>Upon receiving a verified deletion request, we will permanently delete your data within <strong style={{color:"var(--text)"}}>30 days</strong>, except where retention is required by law.</p>
          </SectionCard>

          {/* 7 Security */}
          <SectionCard id="pp-security" icon={Lock} num="7" title="Data Security">
            <p>{BRAND.company} implements industry-standard technical and organizational security measures:</p>
            <div className="security-grid">
              {[
                ["🔒", "TLS 1.2+",          "All data encrypted in transit"],
                ["🛡️", "AES-256",           "Sensitive data encrypted at rest"],
                ["🔑", "OAuth Tokens",      "Secure isolated storage with audit logging"],
                ["📱", "MFA Available",     "Multi-factor auth for all accounts"],
                ["👥", "RBAC",              "Strict need-to-know access controls"],
                ["⏰", "72hr Notification", "GDPR-compliant breach notification timeline"],
              ].map(([emoji, title, desc], i) => (
                <div className="sec-item" key={i}>
                  <span className="sec-item-emoji">{emoji}</span>
                  <div>
                    <span className="sec-item-title">{title}</span>
                    <span className="sec-item-desc">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{marginTop:"10px",fontSize:"0.73rem",color:"var(--faint)"}}>While we take security seriously, no method of transmission over the Internet is 100% secure. We encourage you to use a strong, unique password and enable two-factor authentication.</p>
          </SectionCard>

          {/* 8 Your Rights */}
          <SectionCard id="pp-rights" icon={CheckSquare} num="8" title="Your Data Rights">
            <p>Depending on your location, you have the following rights regarding your personal data:</p>
            <div className="rights-grid">
              {USER_RIGHTS.map(({ icon: Icon, title, desc }, i) => (
                <div className="right-item" key={i}>
                  <div className="right-icon-wrap"><Icon /></div>
                  <div>
                    <span className="right-title">{title}</span>
                    <span className="right-desc">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{marginTop:"12px",fontSize:"0.75rem",color:"var(--faint)"}}>To exercise any of these rights, contact us at <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>. We will respond to verified requests within <strong style={{color:"var(--text)"}}>30 days</strong>.</p>
          </SectionCard>

          {/* 9 GDPR & CCPA */}
          <SectionCard id="pp-gdpr" icon={Globe} num="9" title="GDPR (EEA Users) & CCPA (California Users)">
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              <div className="gdpr-block eu">
                <p className="gdpr-block-title"><Globe style={{width:"14px",height:"14px"}} /> GDPR — European Economic Area</p>
                <p className="gdpr-text">We process personal data under the following legal bases: <strong>performance of a contract</strong> (Art. 6(1)(b)), <strong>legal obligation</strong> (Art. 6(1)(c)), <strong>legitimate interests</strong> (Art. 6(1)(f)) for security and platform improvement, and <strong>consent</strong> (Art. 6(1)(a)) where required. International data transfers outside the EEA use Standard Contractual Clauses (SCCs) approved by the European Commission.</p>
              </div>
              <div className="gdpr-block ca">
                <p className="gdpr-block-title"><Shield style={{width:"14px",height:"14px"}} /> CCPA / CPRA — California Residents</p>
                <p className="gdpr-text">California residents have the right to know what personal information we collect and how it is used, to delete personal information, to opt out of "sale" or "sharing" of personal information (<strong>{BRAND.name} does not sell or share personal information as defined by CCPA</strong>), to correct inaccurate data, and to non-discrimination for exercising these rights. Submit a CCPA request to <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> with subject "CCPA Request."</p>
              </div>
            </div>
          </SectionCard>

          {/* 10 Cookies */}
          <SectionCard id="pp-cookies" icon={Cookie} num="10" title="Cookies & Tracking Technologies">
            <p>{BRAND.name} uses cookies and similar technologies for the following purposes:</p>
            <div className="cookie-items">
              {[
                { cls: "essential",  type: "Essential Cookies",   desc: "Required for authentication, session management, and platform security. Cannot be disabled without breaking core functionality." },
                { cls: "preference", type: "Preference Cookies",  desc: "Store your dashboard layout preferences, timezone settings, and UI customizations." },
                { cls: "analytics",  type: "Analytics Cookies",   desc: "Aggregate, anonymized usage data to understand feature usage and improve the platform. We use privacy-respecting analytics tools." },
              ].map(({ cls, type, desc }, i) => (
                <div className={`cookie-item ${cls}`} key={i}>
                  <p className="cookie-type">{type}</p>
                  <p className="cookie-desc">{desc}</p>
                </div>
              ))}
            </div>
            <p style={{marginTop:"10px",fontSize:"0.73rem",color:"var(--faint)"}}>We do <strong style={{color:"var(--text)"}}>not</strong> use third-party advertising cookies, cross-site tracking pixels, or behavioral retargeting cookies on our platform.</p>
          </SectionCard>

          {/* 11 Children */}
          <SectionCard id="pp-children" icon={Users} num="11" title="Children's Privacy">
            <p>{BRAND.name} is not directed to children under the age of <strong>13</strong> (or <strong>16</strong> in the EEA), and we do not knowingly collect personal data from minors.</p>
            <p>If you are a parent or guardian and believe we have inadvertently collected data from a minor, please contact us immediately at <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> and we will promptly delete that data.</p>
          </SectionCard>

          {/* 12 Data Deletion */}
          <SectionCard id="pp-deletion" icon={Trash2} num="12" title="Facebook Data Deletion">
            <p>In compliance with Meta's Platform Terms, {BRAND.name} provides a <strong>Facebook Data Deletion Callback</strong> endpoint. When you disconnect your Facebook account from {BRAND.name} via your Facebook App Settings, Meta can notify us to delete all data associated with your Facebook User ID.</p>
            <div className="deletion-box">
              <p className="deletion-box-title">
                <Trash2 style={{width:"14px",height:"14px"}} /> Data Deletion Callback URL
              </p>
              <code className="deletion-url">{DELETION_URL}</code>
              <p className="deletion-box-note">This endpoint automatically triggers deletion of all Meta-sourced data tied to your Facebook User ID within 30 days of the request.</p>
            </div>
            <p>You can also request manual deletion by emailing <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> with subject <em>"Data Deletion Request."</em> We will confirm deletion within 30 days and provide a confirmation code.</p>
            <p>To revoke {BRAND.name}'s access to your Meta accounts, visit: <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener" style={{display:"inline-flex",alignItems:"center",gap:"3px"}}>Facebook Settings → Apps and Websites <ExternalLink style={{width:"12px",height:"12px"}} /></a>.</p>
          </SectionCard>

          {/* 13 Changes */}
          <SectionCard id="pp-changes" icon={RefreshCw} num="13" title="Changes to This Policy">
            <p>{BRAND.company} reserves the right to update this Privacy Policy at any time. We will provide notice of material changes by:</p>
            <ul className="check-list" style={{marginTop:"6px"}}>
              {[
                "Sending an email notification to your registered email address at least 7 days before changes take effect.",
                `Displaying a prominent banner within the ${BRAND.name} dashboard.`,
                `Updating the "Last Updated" date at the top of this page.`,
              ].map((item, i) => (
                <li key={i}><ChevronRight className="arr-icon" /><span>{item}</span></li>
              ))}
            </ul>
            <p>Your continued use of {BRAND.name} after the effective date of any revised policy constitutes your acceptance of those changes.</p>
          </SectionCard>

          {/* 14 Contact */}
          <SectionCard id="pp-contact" icon={Phone} num="14" title="Contact Us">
            <p>For privacy-related questions, data requests, or concerns about how we handle your information:</p>
            <div className="contact-grid">
              {[
                { label: "Company",                value: BRAND.company, link: null,                                          mono: false },
                { label: "Platform",               value: BRAND.name,    link: `https://${BRAND.name.toLowerCase()}`,         mono: false },
                { label: "Privacy & Data Requests",value: BRAND.email,   link: `mailto:${BRAND.email}`,                       mono: false },
                { label: "Phone",                  value: BRAND.phone,   link: `tel:${BRAND.phone.replace(/\s/g,"")}`,         mono: false },
                { label: "Data Deletion Callback", value: DELETION_URL,  link: null,                                          mono: true  },
                { label: "Response Time",          value: "Within 30 days of verified request", link: null,                   mono: false },
              ].map(({ label, value, link, mono }, i) => (
                <div className="contact-cell" key={i}>
                  <span className="contact-label">{label}</span>
                  {link
                    ? <a href={link} className="contact-value link">{value}</a>
                    : <span className={`contact-value${mono ? " mono" : ""}`}>{value}</span>
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
            <li><Link href="/terms">Terms of Service</Link></li>
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