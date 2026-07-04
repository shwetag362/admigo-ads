'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

const BRAND = {
  name:    process.env.NEXT_PUBLIC_BRAND_NAME    || "Admigo.net",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || "Automate. Optimize. Scale.",
  short:   process.env.NEXT_PUBLIC_BRAND_SHORT   || "Ad",
  company: process.env.NEXT_PUBLIC_BRAND_COMPANY || "MARCADEO MEDIA PRIVATE LIMITED",
  email:   process.env.NEXT_PUBLIC_BRAND_EMAIL   || "admin@realfam.co.in",
  phone:   process.env.NEXT_PUBLIC_BRAND_PHONE   || "+91 6388807379",
  logo:    "/admigo.png",
};

/* ── Animated counter ── */
function useCounter(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0 = null;
    const tick = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      const ease = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2,3)/2;
      setCount(Math.floor(ease * target));
      if (p < 1) requestAnimationFrame(tick);
      else setCount(target);
    };
    requestAnimationFrame(tick);
  }, [start, target, duration]);
  return count;
}

/* ── Scroll reveal hook ── */
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ── Stat card ── */
function StatCard({ value, suffix, label, sub, delay, inView }) {
  const num = useCounter(value, 2000, inView);
  return (
    <div className="stat-card reveal-child" style={{ '--delay': `${delay}ms` }}>
      <div className="stat-icon-line" />
      <div className="stat-value">{num.toLocaleString()}{suffix}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

const FEATURES = [
  { emoji: "⚡", tag: "Automation",      title: "Smart Campaign Rules",    desc: "Define conditions once. Admigo watches your metrics 24/7 and executes bid adjustments, budget shifts, and pause triggers automatically." },
  { emoji: "📊", tag: "Analytics",       title: "Unified Performance Hub", desc: "All your Meta ad accounts, Pages, and Instagram assets in a single real-time dashboard. No tab switching, no CSV exports." },
  { emoji: "🎯", tag: "Targeting",       title: "Audience Intelligence",   desc: "Visualize audience overlap, monitor frequency fatigue, and discover top-performing segments across every campaign." },
  { emoji: "🔔", tag: "Alerts",          title: "Budget Sentinel",         desc: "Set spend thresholds and ROAS floors. Get notified the instant a campaign drifts — before it impacts your results." },
  { emoji: "🏗️", tag: "Infrastructure", title: "Meta API Native",          desc: "Built directly on Meta Marketing API with Advanced Access. Reliable, fast, and fully compliant with Meta's platform policies." },
  { emoji: "🔐", tag: "Security",        title: "Enterprise Auth",         desc: "OAuth 2.0, AES-256 encryption at rest, TLS 1.3 in transit, and RBAC across your entire team workspace." },
];

const PERMS = [
  { icon: "📧", label: "ads_management",      desc: "Full campaign lifecycle" },
  { icon: "📈", label: "ads_read",             desc: "Real-time performance" },
  { icon: "🏢", label: "business_management",  desc: "Business Manager assets" },
  { icon: "📄", label: "pages_show_list",       desc: "Facebook Pages" },
  { icon: "📸", label: "instagram_basic",       desc: "Instagram identity" },
];

const STEPS = [
  { icon: "🔗", title: "Connect Meta Account", desc: "Authorize via Meta OAuth. We only access what you explicitly grant." },
  { icon: "🏗️", title: "Import Your Assets",   desc: "Ad accounts, Pages, and campaigns sync automatically." },
  { icon: "⚡",  title: "Set Automation Rules",  desc: "Budget caps, ROAS floors, CPC limits — one click to activate." },
  { icon: "📊", title: "Watch It Work",          desc: "Monitor live. Admigo runs your rules 24/7 while you focus on growth." },
];

export default function AdmigoHome() {
  const [scrollY, setScrollY] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  const [statsRef, statsVisible] = useReveal(0.2);
  const [featRef, featVisible]   = useReveal(0.1);
  const [stepsRef, stepsVisible] = useReveal(0.1);
  const [ctaRef, ctaVisible]     = useReveal(0.2);

  useEffect(() => {
    const timer = setTimeout(() => setHeroReady(true), 120);
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(timer); window.removeEventListener('scroll', onScroll); };
  }, []);

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
          --deep-s:       rgba(13,27,62,0.08);

          /* Green – status / success */
          --green:        #22C55E;
          --green-d:      #16A34A;
          --green-s:      rgba(34,197,94,0.12);
          --green-xs:     rgba(34,197,94,0.07);

          /* Amber – CTA hover accent */
          --amber:        #F59E0B;
          --amber-d:      #D97706;
          --amber-s:      rgba(245,158,11,0.12);
          --amber-xs:     rgba(245,158,11,0.07);
          --amber-glow:   rgba(245,158,11,0.28);
          --sh-amb:       0 6px 22px rgba(245,158,11,0.28);

          /* Backgrounds – Pure White family */
          --bg:           #FFFFFF;
          --bg2:          #F5F9FF;   /* Soft White / Ice tinted */
          --bg3:          #EBF3FD;
          --white:        #FFFFFF;

          /* Text */
          --text:         #0D1B3E;   /* Dark Navy */
          --text2:        #1A3BAF;   /* Deep Royal */
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
          --r-xs:         8px;

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

        /* ═══ BACKGROUND ═══ */
        .bg-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; }

        .bg-mesh {
          background:
            radial-gradient(ellipse 80% 60% at 75% -5%,  rgba(43,92,230,0.09) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at -5% 75%,  rgba(208,228,247,0.20) 0%, transparent 60%),
            radial-gradient(ellipse 50% 50% at 100% 55%, rgba(26,59,175,0.05)  0%, transparent 50%);
        }

        .bg-dots {
          background-image: radial-gradient(circle, rgba(43,92,230,0.09) 1px, transparent 1px);
          background-size: 30px 30px;
          mask-image: radial-gradient(ellipse 100% 70% at 50% 0%, black 0%, transparent 75%);
          opacity: 0.40;
        }

        .bg-orbs { overflow: hidden; }
        .orb { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0; animation: orbIn 1.5s ease forwards; }
        .orb-1 {
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(208,228,247,0.20), transparent 70%);
          top: -200px; right: -150px;
          animation: orbIn 1.5s ease 0.1s forwards, orbDrift1 22s ease-in-out 1.6s infinite;
        }
        .orb-2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(43,92,230,0.10), transparent 70%);
          bottom: 5%; left: -100px;
          animation: orbIn 1.5s ease 0.4s forwards, orbDrift2 26s ease-in-out 1.9s infinite;
        }
        .orb-3 {
          width: 340px; height: 340px;
          background: radial-gradient(circle, rgba(26,59,175,0.07), transparent 70%);
          top: 45%; left: 38%;
          animation: orbIn 1.5s ease 0.7s forwards, orbDrift3 30s ease-in-out 2.2s infinite;
        }
        @keyframes orbIn { to { opacity: 1; } }
        @keyframes orbDrift1 {
          0%,100% { transform: translate(0,0) scale(1); }
          30%     { transform: translate(-45px,55px) scale(1.06); }
          65%     { transform: translate(32px,-28px) scale(0.96); }
        }
        @keyframes orbDrift2 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%     { transform: translate(55px,-45px) scale(1.08); }
          70%     { transform: translate(-28px,32px) scale(0.94); }
        }
        @keyframes orbDrift3 {
          0%,100% { transform: translate(-50%,-50%) scale(1); }
          50%     { transform: translate(-44%,-56%) scale(1.12); }
        }

        /* ═══ REVEAL ANIMATIONS ═══ */
        .reveal {
          opacity: 0; transform: translateY(32px);
          transition: opacity 0.8s cubic-bezier(.16,1,.3,1), transform 0.8s cubic-bezier(.16,1,.3,1);
        }
        .reveal.in { opacity: 1; transform: translateY(0); }

        .reveal-children .reveal-child {
          opacity: 0; transform: translateY(22px);
          transition: opacity 0.7s cubic-bezier(.16,1,.3,1), transform 0.7s cubic-bezier(.16,1,.3,1);
          transition-delay: var(--delay, 0ms);
        }
        .reveal-children.in .reveal-child { opacity: 1; transform: translateY(0); }

        .h-enter {
          opacity: 0; transform: translateY(28px);
          transition: opacity 0.8s cubic-bezier(.16,1,.3,1), transform 0.8s cubic-bezier(.16,1,.3,1);
          transition-delay: var(--hd, 0ms);
        }
        .h-enter.go { opacity: 1; transform: translateY(0); }

        /* ═══ NAV ═══ */
        .nav {
          position: sticky; top: 0; z-index: 200;
          transition: background 0.3s, box-shadow 0.3s, border-color 0.3s;
          background: rgba(255,255,255,0.80);
          backdrop-filter: blur(20px) saturate(1.6);
          -webkit-backdrop-filter: blur(20px) saturate(1.6);
          border-bottom: 1px solid transparent;
        }
        .nav.up {
          background: rgba(255,255,255,0.95);
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
        .nav-brand { display: flex; flex-direction: column; }
        .nav-name { font-size: 0.9rem; font-weight: 800; color: var(--text); line-height: 1; letter-spacing: -0.03em; }
        .nav-sub  { font-size: 0.6rem; color: var(--faint); margin-top: 2px; line-height: 1; font-weight: 500; letter-spacing: 0.03em; }

        .nav-links { display: flex; gap: 2px; list-style: none; }
        .nav-links a {
          display: flex; align-items: center;
          padding: 7px 14px; border-radius: 10px;
          font-size: 0.8rem; font-weight: 600; color: var(--muted);
          text-decoration: none; letter-spacing: -0.01em;
          transition: background 0.15s, color 0.15s;
        }
        .nav-links a:hover { background: var(--royal-xs); color: var(--royal); }

        .nav-right { display: flex; gap: 8px; align-items: center; }
        .btn-ghost {
          padding: 8px 18px; background: transparent;
          border: 1.5px solid var(--ice); border-radius: 11px;
          font-size: 0.8rem; font-weight: 700; color: var(--royal);
          text-decoration: none; letter-spacing: -0.01em;
          transition: border-color 0.2s, background 0.2s, transform 0.2s;
        }
        .btn-ghost:hover { border-color: var(--royal); background: var(--royal-xs); transform: translateY(-1px); }

        .btn-solid {
          padding: 8px 20px;
          background: linear-gradient(135deg, var(--royal), var(--royal-d));
          border: 1.5px solid var(--royal); border-radius: 11px;
          font-size: 0.8rem; font-weight: 700; color: white;
          text-decoration: none; letter-spacing: -0.01em;
          transition: all 0.22s;
          box-shadow: 0 2px 10px var(--royal-glow2);
        }
        .btn-solid:hover {
          background: linear-gradient(135deg, var(--royal-l), var(--royal));
          border-color: var(--royal-l);
          box-shadow: var(--sh-royal);
          transform: translateY(-1px);
        }

        /* ═══ HERO ═══ */
        .hero-section {
          position: relative; z-index: 1;
          background: var(--white);
          border-bottom: 1px solid var(--ice);
          overflow: hidden;
        }
        .hero-section::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,1) 40%, rgba(208,228,247,0.18) 100%);
          pointer-events: none;
        }
        .hero-section::after {
          content: '';
          position: absolute; top: -80px; right: -120px;
          width: 600px; height: 600px;
          background: radial-gradient(ellipse, rgba(208,228,247,0.35) 0%, transparent 65%);
          border-radius: 50%;
          pointer-events: none;
          animation: heroGlow 8s ease-in-out infinite alternate;
        }
        @keyframes heroGlow {
          from { transform: scale(0.9) translate(0, 0); opacity: 0.7; }
          to   { transform: scale(1.1) translate(-30px, 40px); opacity: 1; }
        }

        .hero-inner {
          max-width: 1240px; margin: 0 auto;
          padding: 80px 2rem 88px;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 5rem; align-items: center;
          position: relative; z-index: 1;
        }

        /* ── eyebrow badge ── */
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 9px;
          font-size: 0.7rem; font-weight: 700; color: var(--royal);
          background: var(--royal-xs); border: 1px solid var(--border-royal);
          padding: 6px 16px; border-radius: 100px; margin-bottom: 1.6rem;
          letter-spacing: 0.03em;
        }
        .eyebrow-pulse {
          width: 7px; height: 7px; background: var(--royal); border-radius: 50%; position: relative;
        }
        .eyebrow-pulse::before {
          content: ''; position: absolute; inset: -3px;
          border-radius: 50%; background: var(--royal);
          animation: pingOut 2s ease infinite;
        }
        @keyframes pingOut {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.6); opacity: 0; }
        }

        .hero-title {
          font-size: clamp(2.6rem, 5vw, 4.1rem);
          font-weight: 800; letter-spacing: -0.05em; line-height: 1.02;
          color: var(--text); margin-bottom: 1.5rem;
        }
        .hero-title .accent {
          color: var(--royal); position: relative; display: inline-block;
        }
        .hero-title .accent::after {
          content: '';
          position: absolute; left: 0; bottom: -5px; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--ice), var(--sky), var(--royal-d));
          border-radius: 2px;
          transform: scaleX(0); transform-origin: left;
          animation: underlineGrow 0.9s cubic-bezier(.16,1,.3,1) 0.9s forwards;
        }
        @keyframes underlineGrow { to { transform: scaleX(1); } }
        .hero-title .dim { color: var(--faint); }

        .hero-desc {
          font-size: 1.05rem; color: var(--muted); line-height: 1.78;
          max-width: 460px; margin-bottom: 2.4rem; font-weight: 400;
        }

        .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 2.25rem; }

        .btn-cta {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 15px 34px;
          background: linear-gradient(135deg, var(--royal) 0%, var(--royal-l) 50%, var(--royal-d) 100%);
          color: white; font-size: 0.925rem; font-weight: 700;
          border-radius: 13px; text-decoration: none;
          border: 1.5px solid var(--royal); letter-spacing: -0.01em;
          transition: all 0.25s cubic-bezier(.34,1.56,.64,1);
          box-shadow: 0 4px 18px var(--royal-glow2);
          position: relative; overflow: hidden;
        }
        .btn-cta::before {
          content: '';
          position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.20), transparent);
          transition: left 0.5s ease;
        }
        .btn-cta:hover::before { left: 150%; }
        .btn-cta:hover {
          background: linear-gradient(135deg, var(--sky) 0%, var(--royal-l) 50%, var(--royal) 100%);
          border-color: var(--sky);
          box-shadow: var(--sh-royal);
          transform: translateY(-3px) scale(1.02);
        }
        .btn-cta .arrow {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; background: rgba(255,255,255,0.22);
          border-radius: 7px; font-size: 0.85rem;
          transition: transform 0.2s;
        }
        .btn-cta:hover .arrow { transform: translateX(3px); }

        .btn-sec {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 15px 32px; background: var(--white);
          color: var(--text); font-size: 0.925rem; font-weight: 700;
          border-radius: 13px; text-decoration: none;
          border: 1.5px solid var(--ice); letter-spacing: -0.01em;
          transition: all 0.2s;
        }
        .btn-sec:hover {
          border-color: var(--royal); color: var(--royal);
          background: var(--royal-xs); transform: translateY(-2px);
        }

        .trust-row { display: flex; gap: 1.5rem; flex-wrap: wrap; }
        .trust-item { display: flex; align-items: center; gap: 7px; font-size: 0.78rem; color: var(--muted); font-weight: 500; }
        .trust-icon {
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--green-s); display: flex; align-items: center; justify-content: center;
          font-size: 9px; color: var(--green-d); flex-shrink: 0;
        }

        /* ── DASHBOARD MOCKUP ── */
        .dash-wrap { display: flex; flex-direction: column; gap: 12px; }

        .dash-card {
          background: var(--white);
          border: 1px solid var(--ice);
          border-radius: var(--r);
          box-shadow: var(--sh);
          padding: 1.25rem 1.5rem;
          opacity: 0;
          animation: dashSlide 0.8s cubic-bezier(.16,1,.3,1) forwards;
          transition: box-shadow 0.3s, transform 0.3s;
          position: relative; overflow: hidden;
        }
        .dash-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--ice), var(--sky), var(--royal-d));
          opacity: 0.85;
        }
        .dash-card:hover { box-shadow: var(--sh-lg); transform: translateY(-3px); }
        @keyframes dashSlide {
          from { opacity: 0; transform: translateX(28px) rotate(0.8deg); }
          to   { opacity: 1; transform: translateX(0) rotate(0); }
        }

        .dash-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.1rem; }
        .dash-title { font-size: 0.8rem; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }

        .pill-green { font-size: 0.62rem; font-weight: 700; padding: 3px 10px; border-radius: 100px; background: var(--green-s); color: var(--green-d); display: flex; align-items: center; gap: 5px; }
        .pill-royal { font-size: 0.62rem; font-weight: 700; padding: 3px 10px; border-radius: 100px; background: var(--royal-xs); color: var(--royal); }
        .pill-sky   { font-size: 0.62rem; font-weight: 700; padding: 3px 10px; border-radius: 100px; background: var(--sky-xs); color: var(--sky); }
        .live-dot { width: 6px; height: 6px; background: var(--green); border-radius: 50%; animation: livePulse 1.5s ease infinite; }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.6)} }

        .dash-metrics { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.7rem; }
        .dash-metric { text-align: center; padding: 0.7rem 0.4rem; background: var(--bg2); border-radius: 11px; border: 1px solid var(--ice); }
        .dm-val { font-size: 1.1rem; font-weight: 800; color: var(--text); letter-spacing: -0.03em; display: block; }
        .dm-key { font-size: 0.58rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px; display: block; font-family: var(--mono); }
        .dm-up  { font-size: 0.58rem; color: var(--green-d); font-weight: 600; display: block; margin-top: 2px; }

        .dash-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .dbr-label { font-size: 0.68rem; color: var(--muted); width: 90px; flex-shrink: 0; font-weight: 500; }
        .dbr-track { flex: 1; height: 5px; background: var(--bg2); border-radius: 3px; overflow: hidden; }
        .dbr-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--royal), var(--sky));
          border-radius: 3px;
          animation: barFill 1.6s cubic-bezier(.16,1,.3,1) forwards;
        }
        @keyframes barFill { from { width: 0 !important; } }
        .dbr-pct { font-size: 0.65rem; font-weight: 700; color: var(--text); width: 32px; text-align: right; font-family: var(--mono); }

        .dash-rule { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--bg2); border-radius: 9px; margin-bottom: 5px; cursor: default; transition: background 0.15s; border: 1px solid transparent; }
        .dash-rule:hover { background: var(--royal-xs); border-color: var(--border-royal); }
        .dr-text { font-size: 0.68rem; color: var(--text); font-weight: 500; font-family: var(--mono); }
        .dr-active { font-size: 0.6rem; font-weight: 700; padding: 2px 8px; border-radius: 100px; background: var(--green-s); color: var(--green-d); }
        .dr-paused { font-size: 0.6rem; font-weight: 700; padding: 2px 8px; border-radius: 100px; background: var(--amber-s); color: var(--amber-d); }

        /* ── TICKER ── */
        .ticker {
          position: relative; z-index: 1;
          background: linear-gradient(90deg, var(--royal-d) 0%, var(--deep-d) 100%);
          height: 38px; overflow: hidden;
          display: flex; align-items: center;
        }
        .ticker::before, .ticker::after {
          content: ''; position: absolute; top: 0; bottom: 0; width: 80px; z-index: 2;
        }
        .ticker::before { left: 0; background: linear-gradient(to right, var(--royal-d), transparent); }
        .ticker::after  { right: 0; background: linear-gradient(to left, var(--deep-d), transparent); }
        .ticker-track { display: flex; white-space: nowrap; animation: scroll 30s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        .ticker-item {
          font-family: var(--mono); font-size: 0.65rem; font-weight: 500;
          color: rgba(208,228,247,0.55); padding: 0 2rem;
          display: flex; align-items: center; gap: 10px;
        }
        .ticker-item b { color: var(--ice); font-weight: 600; }
        .ticker-sep { color: rgba(208,228,247,0.25); font-size: 0.8rem; }
        @keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        /* ═══ STATS ═══ */
        .stats-outer { position: relative; z-index: 1; padding: 2.5rem 2rem; max-width: 1240px; margin: 0 auto; }
        .stats-grid {
          display: grid; grid-template-columns: repeat(4,1fr);
          border: 1px solid var(--ice); border-radius: var(--r);
          overflow: hidden; background: var(--ice); gap: 1px;
          box-shadow: var(--sh-sm);
        }
        .stat-card {
          background: var(--white); padding: 2.1rem 1.5rem; text-align: center;
          position: relative; overflow: hidden;
          opacity: 0; transform: translateY(20px);
          transition: background 0.2s, transform 0.3s;
        }
        .stat-card:hover { background: var(--bg2); transform: translateY(-3px); }
        .stat-icon-line {
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--ice), var(--sky), var(--royal-d));
          transform: scaleX(0); transition: transform 0.5s cubic-bezier(.16,1,.3,1);
        }
        .stat-card:hover .stat-icon-line { transform: scaleX(1); }
        .stat-value {
          font-size: 2.5rem; font-weight: 800; color: var(--royal);
          letter-spacing: -0.05em; line-height: 1;
        }
        .stat-label { font-size: 0.8rem; font-weight: 700; color: var(--text); margin-top: 0.4rem; letter-spacing: -0.01em; }
        .stat-sub   { font-size: 0.67rem; color: var(--faint); margin-top: 0.2rem; }

        /* ═══ SECTION CHROME ═══ */
        .section { max-width: 1240px; margin: 0 auto; padding: 88px 2rem; position: relative; z-index: 1; }
        .section-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 0.67rem; font-weight: 700; color: var(--royal);
          background: var(--royal-xs); border: 1px solid var(--border-royal);
          padding: 5px 14px; border-radius: 100px;
          margin-bottom: 1rem; letter-spacing: 0.06em; text-transform: uppercase;
        }
        .section-title {
          font-size: clamp(1.8rem, 3.2vw, 2.7rem); font-weight: 800;
          letter-spacing: -0.045em; color: var(--text); line-height: 1.1;
          margin-bottom: 0.8rem;
        }
        .section-sub {
          font-size: 1rem; color: var(--muted); line-height: 1.75;
          max-width: 520px; margin-bottom: 2.75rem; font-weight: 400;
        }

        /* ═══ FEATURES ═══ */
        .feat-grid {
          display: grid; grid-template-columns: repeat(3,1fr);
          gap: 1px; border: 1px solid var(--ice);
          background: var(--ice); border-radius: var(--r);
          overflow: hidden; box-shadow: var(--sh-sm);
        }
        .feat-card {
          background: var(--white); padding: 2rem 1.75rem 2.1rem;
          position: relative; overflow: hidden;
          opacity: 0; transform: translateY(18px);
          transition: background 0.25s, transform 0.3s, opacity 0.7s cubic-bezier(.16,1,.3,1);
          transition-delay: var(--delay, 0ms);
          cursor: default;
        }
        .feat-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--ice) 0%, var(--sky) 50%, var(--royal-d) 100%);
          transform: scaleX(0); transform-origin: left;
          transition: transform 0.4s cubic-bezier(.16,1,.3,1);
        }
        .feat-card:hover { background: var(--bg2); }
        .feat-card:hover::before { transform: scaleX(1); }
        .feat-card:hover .feat-arrow { opacity: 1; transform: translate(0,0); }
        .feat-card:hover .feat-icon-bg { background: var(--royal-m); box-shadow: 0 0 0 7px var(--royal-xs); }

        .feat-icon-bg {
          width: 46px; height: 46px; border-radius: 14px;
          background: var(--royal-xs); border: 1px solid var(--border-royal);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.3rem; margin-bottom: 1.1rem;
          transition: background 0.25s, box-shadow 0.25s;
        }
        .feat-tag   { font-size: 0.62rem; font-weight: 700; color: var(--royal); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 0.45rem; }
        .feat-title { font-size: 0.95rem; font-weight: 800; color: var(--text); margin-bottom: 0.55rem; letter-spacing: -0.02em; }
        .feat-desc  { font-size: 0.82rem; color: var(--muted); line-height: 1.7; }
        .feat-arrow {
          position: absolute; top: 1.75rem; right: 1.75rem;
          color: var(--royal); font-size: 1rem; font-weight: 700;
          opacity: 0; transform: translate(-5px, 5px);
          transition: opacity 0.2s, transform 0.2s;
        }

        /* ═══ PERMISSIONS (Deep Navy band) ═══ */
        .perms-band {
          background: linear-gradient(135deg, var(--deep-d) 0%, var(--royal-d) 100%);
          position: relative; z-index: 1; overflow: hidden;
        }
        .perms-band::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 80% 100% at 50% 50%, rgba(208,228,247,0.07), transparent 70%);
          pointer-events: none;
        }
        .perms-inner { max-width: 1240px; margin: 0 auto; padding: 2.75rem 2rem; position: relative; z-index: 1; }
        .perms-label {
          font-size: 0.65rem; font-weight: 700; color: rgba(208,228,247,0.55);
          letter-spacing: 0.18em; text-transform: uppercase;
          text-align: center; margin-bottom: 1.5rem;
        }
        .perms-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
        .perm-chip {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 10px 18px; background: rgba(255,255,255,0.07);
          border: 1px solid rgba(208,228,247,0.15); border-radius: 12px;
          cursor: default;
          transition: border-color 0.2s, background 0.2s, transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s;
        }
        .perm-chip:hover {
          border-color: rgba(208,228,247,0.40); background: rgba(208,228,247,0.10);
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 6px 18px rgba(13,27,62,0.35);
        }
        .perm-code {
          font-family: var(--mono); font-size: 0.68rem; font-weight: 500;
          color: var(--ice); background: rgba(208,228,247,0.10);
          padding: 2px 9px; border-radius: 6px;
        }
        .perm-text { font-size: 0.73rem; color: rgba(208,228,247,0.65); font-weight: 500; }

        /* ═══ HOW IT WORKS ═══ */
        .hiw-section {
          background: var(--bg2);
          border-top: 1px solid var(--ice);
          border-bottom: 1px solid var(--ice);
          position: relative; z-index: 1;
        }
        .steps-grid {
          display: grid; grid-template-columns: repeat(4,1fr);
          gap: 1.75rem; position: relative;
        }
        .steps-connector {
          position: absolute; top: 28px; left: 12.5%; right: 12.5%; height: 2px;
          background: linear-gradient(90deg, var(--ice), var(--sky), var(--royal-d));
          border-radius: 2px; opacity: 0.50;
        }
        .step {
          text-align: center; position: relative; z-index: 1;
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.7s cubic-bezier(.16,1,.3,1), transform 0.7s cubic-bezier(.16,1,.3,1);
          transition-delay: var(--delay, 0ms);
        }
        .step-num {
          width: 58px; height: 58px; border-radius: 50%;
          background: var(--white); border: 2px solid var(--royal);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.35rem; margin: 0 auto 1.2rem;
          box-shadow: var(--sh-sm);
          position: relative; z-index: 1;
          transition: box-shadow 0.3s, transform 0.3s;
        }
        .step:hover .step-num {
          box-shadow: var(--sh), 0 0 0 8px var(--royal-xs);
          transform: scale(1.1);
        }
        .step-title { font-size: 0.9rem; font-weight: 800; color: var(--text); margin-bottom: 0.4rem; letter-spacing: -0.02em; }
        .step-desc  { font-size: 0.78rem; color: var(--muted); line-height: 1.68; }

        /* ═══ CTA ═══ */
        .cta-section {
          background: var(--white);
          border-top: 1px solid var(--ice);
          position: relative; z-index: 1; overflow: hidden;
        }
        .cta-section::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(208,228,247,0.12) 0%, rgba(43,92,230,0.04) 50%, transparent 100%);
          pointer-events: none;
        }
        .cta-glow {
          position: absolute; top: -120px; left: 50%; transform: translateX(-50%);
          width: 900px; height: 600px;
          background: radial-gradient(ellipse, rgba(43,92,230,0.08), transparent 65%);
          pointer-events: none;
          animation: ctaPulse 7s ease-in-out infinite alternate;
        }
        @keyframes ctaPulse {
          from { opacity: 0.6; transform: translateX(-50%) scale(0.95); }
          to   { opacity: 1;   transform: translateX(-50%) scale(1.08); }
        }
        .cta-inner {
          max-width: 680px; margin: 0 auto;
          padding: 96px 2rem; text-align: center; position: relative; z-index: 1;
        }
        .cta-title {
          font-size: clamp(1.9rem, 4vw, 3.2rem); font-weight: 800;
          letter-spacing: -0.05em; color: var(--text); line-height: 1.08;
          margin-bottom: 1rem;
        }
        .cta-title span { color: var(--royal); }
        .cta-sub { font-size: 1rem; color: var(--muted); margin-bottom: 2.25rem; line-height: 1.75; }
        .cta-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .cta-note { margin-top: 1.1rem; font-size: 0.7rem; color: var(--faint); letter-spacing: 0.02em; }

        /* ─ trust strip on CTA ─ */
        .cta-trust {
          display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap;
          margin-top: 2.5rem; padding-top: 2rem; border-top: 1px solid var(--ice);
        }
        .cta-trust-item { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--muted); font-weight: 500; }
        .cta-trust-icon { font-size: 1rem; }

        /* ═══ FOOTER ═══ */
        footer {
          background: linear-gradient(90deg, var(--deep-d) 0%, var(--royal-d) 100%);
          position: relative; z-index: 1;
        }
        .footer-inner {
          max-width: 1240px; margin: 0 auto; padding: 1.6rem 2rem;
          display: flex; align-items: center; justify-content: space-between;
          gap: 1rem; flex-wrap: wrap;
        }
        .footer-brand { display: flex; align-items: center; gap: 10px; }
        .footer-logo-wrap {
          width: 32px; height: 32px; border-radius: 9px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.10); border: 1px solid rgba(208,228,247,0.20);
          flex-shrink: 0;
        }
        .footer-name    { font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.92); }
        .footer-sep     { font-size: 0.8rem; color: rgba(208,228,247,0.25); }
        .footer-company { font-size: 0.72rem; color: rgba(208,228,247,0.50); }

        .footer-links { display: flex; gap: 1.5rem; list-style: none; flex-wrap: wrap; }
        .footer-links a {
          font-size: 0.78rem; font-weight: 500;
          color: rgba(208,228,247,0.60); text-decoration: none;
          transition: color 0.15s;
        }
        .footer-links a:hover { color: var(--ice); }
        .footer-copy { font-size: 0.7rem; color: rgba(208,228,247,0.35); }

        /* ═══ RESPONSIVE ═══ */
        @media (max-width: 1024px) {
          .hero-inner { grid-template-columns: 1fr; gap: 3.5rem; padding: 56px 2rem 64px; }
          .dash-wrap { max-width: 560px; }
          .feat-grid { grid-template-columns: repeat(2,1fr); }
          .steps-grid { grid-template-columns: repeat(2,1fr); }
          .steps-connector { display: none; }
          .stats-grid { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 640px) {
          .nav-links { display: none; }
          .btn-ghost  { display: none; }
          .feat-grid  { grid-template-columns: 1fr; }
          .steps-grid { grid-template-columns: 1fr; }
          .footer-inner { flex-direction: column; align-items: flex-start; }
          .cta-trust { gap: 1rem; }
        }
      `}</style>

      {/* ── Background layers ── */}
      <div className="bg-layer bg-mesh" aria-hidden="true" />
      <div className="bg-layer bg-dots"  aria-hidden="true" />
      <div className="bg-layer bg-orbs"  aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* ═══ NAV ═══ */}
      <header className={`nav${navElevated ? ' up' : ''}`}>
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-wrap">
              <Image src={BRAND.logo} alt={BRAND.name} width={40} height={40} className="object-contain" />
            </div>
            <div className="nav-brand">
              <span className="nav-name">{BRAND.name}</span>
              <span className="nav-sub">{BRAND.tagline}</span>
            </div>
          </Link>

          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How it works</a></li>
            <li><Link href="/privacy-policy">Privacy</Link></li>
            <li><Link href="/terms-of-service">Terms</Link></li>
          </ul>

          <div className="nav-right">
            <Link href="/login"    className="btn-ghost">Sign In</Link>
            <Link href="/register" className="btn-solid">Get Started →</Link>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <div className="hero-section">
        <div className="hero-inner">
          {/* Left copy */}
          <div>
            <div className={`hero-eyebrow h-enter${heroReady ? ' go' : ''}`} style={{'--hd':'0ms'}}>
              <span className="eyebrow-pulse" />
              Meta Advanced Access · Verified
              <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:'var(--sky)',marginLeft:'2px',opacity:0.85}} />
            </div>

            <h1 className={`hero-title h-enter${heroReady ? ' go' : ''}`} style={{'--hd':'100ms'}}>
              Meta Ads<br />on <span className="accent">Autopilot</span>.<br />
              <span className="dim">Finally.</span>
            </h1>

            <p className={`hero-desc h-enter${heroReady ? ' go' : ''}`} style={{'--hd':'200ms'}}>
              {BRAND.name} connects directly to Meta's Marketing API. {BRAND.tagline} — while your competitors are still managing everything manually.
            </p>

            <div className={`hero-actions h-enter${heroReady ? ' go' : ''}`} style={{'--hd':'300ms'}}>
              <Link href="/register" className="btn-cta">
                Start Free Trial <span className="arrow">→</span>
              </Link>
              <Link href="/login" className="btn-sec">Sign In</Link>
            </div>

            <div className={`trust-row h-enter${heroReady ? ' go' : ''}`} style={{'--hd':'420ms'}}>
              {["No credit card required","GDPR & CCPA compliant","Meta verified app"].map(t => (
                <div className="trust-item" key={t}>
                  <div className="trust-icon">✓</div>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Dashboard Mockup */}
          <div className="dash-wrap">
            {/* Card 1 */}
            <div className="dash-card" style={{ animationDelay: '320ms' }}>
              <div className="dash-head">
                <span className="dash-title">Campaign Overview</span>
                <span className="pill-green"><span className="live-dot"/>Live</span>
              </div>
              <div className="dash-metrics">
                {[
                  { val:'₹2.4L', key:'Spend',  up:'+18%' },
                  { val:'4.8x',  key:'ROAS',   up:'+0.4x' },
                  { val:'12.3K', key:'Clicks',  up:'+22%' },
                ].map(m => (
                  <div className="dash-metric" key={m.key}>
                    <span className="dm-val">{m.val}</span>
                    <span className="dm-key">{m.key}</span>
                    <span className="dm-up">↑ {m.up}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2 */}
            <div className="dash-card" style={{ animationDelay: '460ms' }}>
              <div className="dash-head">
                <span className="dash-title">Top Campaigns</span>
                <span className="pill-royal">This Week</span>
              </div>
              {[
                { name:'Diwali Sale',     pct:87 },
                { name:'Brand Awareness', pct:64 },
                { name:'Retargeting',     pct:52 },
              ].map(r => (
                <div className="dash-bar-row" key={r.name}>
                  <span className="dbr-label">{r.name}</span>
                  <div className="dbr-track">
                    <div className="dbr-fill" style={{ width:`${r.pct}%` }} />
                  </div>
                  <span className="dbr-pct">{r.pct}%</span>
                </div>
              ))}
            </div>

            {/* Card 3 */}
            <div className="dash-card" style={{ animationDelay: '600ms' }}>
              <div className="dash-head">
                <span className="dash-title">Automation Rules</span>
                <span className="pill-green">2 Active</span>
              </div>
              {[
                { rule:'Pause if CPC > ₹15',       status:'active' },
                { rule:'Boost budget if ROAS > 5x', status:'active' },
                { rule:'Alert if CTR < 0.5%',       status:'paused' },
              ].map(r => (
                <div className="dash-rule" key={r.rule}>
                  <span className="dr-text">{r.rule}</span>
                  <span className={r.status === 'active' ? 'dr-active' : 'dr-paused'}>
                    {r.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TICKER ═══ */}
      <div className="ticker">
        <div className="ticker-track">
          {[...Array(2)].map((_,ri) =>
            ['Campaign Automation','Budget Rules','ROAS Monitoring','Audience Overlap','Multi-Account','API-Native','Real-time Alerts','Meta Advanced Access','Automated Reporting','Smart Bidding'].map((item,i) => (
              <span className="ticker-item" key={`${ri}-${i}`}>
                <b>{item}</b>
                <span className="ticker-sep">·</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* ═══ STATS ═══ */}
      <div ref={statsRef}>
        <div className="stats-outer">
          <div className={`stats-grid reveal-children${statsVisible ? ' in' : ''}`}>
            <StatCard value={2800} suffix="+"  label="Active Advertisers"  sub="Across India & globally"  delay={0}   inView={statsVisible} />
            <StatCard value={142}  suffix="M+"  label="Ad Spend Managed"   sub="Via Meta Marketing API"   delay={120} inView={statsVisible} />
            <StatCard value={99}   suffix="%"   label="API Uptime SLA"     sub="24/7 monitoring"          delay={240} inView={statsVisible} />
            <StatCard value={18}   suffix="x"   label="Time Saved/Week"    sub="vs manual management"    delay={360} inView={statsVisible} />
          </div>
        </div>
      </div>

      {/* ═══ FEATURES ═══ */}
      <section className="section" id="features" ref={featRef}>
        <div className="section-eyebrow">Platform Features</div>
        <h2 className="section-title">
          Everything your Meta ads<br />
          <span style={{color:'var(--faint)'}}>workflow demands.</span>
        </h2>
        <p className="section-sub">
          From campaign automation to budget intelligence — {BRAND.name} gives performance marketers the tools Meta's native interface simply doesn't provide.
        </p>
        <div className="feat-grid">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="feat-card"
              style={{
                '--delay': `${i * 75}ms`,
                ...(featVisible ? { opacity:1, transform:'translateY(0)' } : {})
              }}
            >
              <div className="feat-icon-bg">{f.emoji}</div>
              <div className="feat-tag">{f.tag}</div>
              <div className="feat-title">{f.title}</div>
              <div className="feat-desc">{f.desc}</div>
              <span className="feat-arrow">↗</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PERMISSIONS (Deep Navy + Royal band) ═══ */}
      
   {/*   <div className="perms-band">
        <div className="perms-inner">
          <div className="perms-label">Meta API permissions — used transparently</div>
          <div className="perms-row">
            {PERMS.map(p => (
              <div className="perm-chip" key={p.label}>
                <span>{p.icon}</span>
                <code className="perm-code">{p.label}</code>
                <span className="perm-text">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div> */}

      {/* ═══ HOW IT WORKS ═══ */}
      <div className="hiw-section">
        <section className="section" id="how-it-works" ref={stepsRef}>
          <div style={{textAlign:'center', marginBottom:'3.5rem'}}>
            <div className="section-eyebrow" style={{justifyContent:'center',background:'var(--sky-xs)',borderColor:'rgba(74,144,217,0.25)',color:'var(--sky)'}}>How It Works</div>
            <h2 className="section-title" style={{textAlign:'center',margin:'0 auto 0.8rem'}}>Up and running in minutes</h2>
            <p className="section-sub" style={{textAlign:'center',margin:'0 auto'}}>
              No engineers needed. Connect your Meta account and start automating in under 5 minutes.
            </p>
          </div>
          <div className="steps-grid">
            <div className="steps-connector" />
            {STEPS.map((s, i) => (
              <div
                key={i}
                className="step"
                style={{
                  '--delay': `${i * 120}ms`,
                  ...(stepsVisible ? { opacity:1, transform:'translateY(0)' } : {})
                }}
              >
                <div className="step-num">{s.icon}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ═══ CTA ═══ */}
      <div className="cta-section" ref={ctaRef}>
        <div className="cta-glow" />
        <div className={`cta-inner reveal${ctaVisible ? ' in' : ''}`}>
          <div className="section-eyebrow" style={{justifyContent:'center',marginBottom:'1.1rem',background:'var(--green-xs)',borderColor:'rgba(34,197,94,0.22)',color:'var(--green-d)'}}>
            Ready to automate?
          </div>
          <h2 className="cta-title">
            Stop managing ads.<br />
            <span>Start scaling them.</span>
          </h2>
          <p className="cta-sub">
            Join thousands of performance marketers running smarter Meta campaigns with {BRAND.name}.
          </p>
          <div className="cta-btns">
            <Link href="/register" className="btn-cta">
              Create Free Account <span className="arrow">→</span>
            </Link>
            <Link href="/privacy-policy" className="btn-sec">Read Privacy Policy</Link>
          </div>
          <p className="cta-note">No credit card required · Cancel anytime · Meta Advanced Access verified</p>
          <div className="cta-trust">
            {[
              { icon:'🔒', text:'AES-256 Encryption' },
              { icon:'🛡️', text:'GDPR Compliant' },
              { icon:'✅', text:'Meta Verified App' },
              { icon:'⚡',  text:'99% Uptime SLA' },
            ].map(t => (
              <div className="cta-trust-item" key={t.text}>
                <span className="cta-trust-icon">{t.icon}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo-wrap">
              <Image src={BRAND.logo} alt={BRAND.name} width={32} height={32} className="object-contain" />
            </div>
            <span className="footer-name">{BRAND.name}</span>
            <span className="footer-sep">—</span>
            <span className="footer-company">{BRAND.company}</span>
          </div>

          <ul className="footer-links">
            <li><Link href="/terms-of-service">Terms of Service</Link></li>
            <li><Link href="/privacy-policy">Privacy Policy</Link></li>
            <li><a href={`mailto:${BRAND.email}`}>Contact</a></li>
            <li><a href={`tel:${BRAND.phone.replace(/\s/g,'')}`}>{BRAND.phone}</a></li>
          </ul>

          <span className="footer-copy">© {new Date().getFullYear()} {BRAND.company}</span>
        </div>
      </footer>
    </>
  );
}