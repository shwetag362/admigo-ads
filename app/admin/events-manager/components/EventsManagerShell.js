// app/dashboard/events-manager/components/EventsManagerShell.js
"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const TABS = [
  { label: "Overview",        href: "/dashboard/events-manager/overview",        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Pixels",          href: "/dashboard/events-manager/pixels",           icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
  { label: "Conversions API", href: "/dashboard/events-manager/conversions-api",  icon: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { label: "Test Events",     href: "/dashboard/events-manager/test-events",      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { label: "Data Sources",    href: "/dashboard/events-manager/datasources",      icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
];

const SHELL_CSS = `
  @keyframes em-indicator-slide {
    from { opacity: 0; transform: scaleX(0.4); }
    to   { opacity: 1; transform: scaleX(1); }
  }
  @keyframes em-tab-pop {
    0%   { transform: translateY(0); }
    40%  { transform: translateY(-2px); }
    100% { transform: translateY(0); }
  }

  .em-shell-nav-wrap {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }

  .em-shell-nav-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 18px;
    display: flex;
    align-items: stretch;
    gap: 0;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .em-shell-nav-inner::-webkit-scrollbar { display: none; }

  .em-tab-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 4px;
    height: 48px;
    font-size: 13px;
    font-weight: 500;
    color: #6b7280;
    background: none;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.18s ease;
    margin-right: 4px;
    flex-shrink: 0;
    letter-spacing: 0.01em;
    font-family: inherit;
  }

  .em-tab-btn::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2.5px;
    background: #6366f1;
    border-radius: 2px 2px 0 0;
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
  }

  .em-tab-btn:hover { color: #374151; }
  .em-tab-btn:hover::after { transform: scaleX(0.5); opacity: 0.4; }

  .em-tab-btn.active {
    color: #6366f1;
    font-weight: 600;
  }
  .em-tab-btn.active::after {
    transform: scaleX(1);
    animation: em-indicator-slide 0.22s cubic-bezier(0.34,1.56,0.64,1) both;
  }

  .em-tab-icon {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    opacity: 0.75;
    transition: opacity 0.15s;
  }
  .em-tab-btn.active .em-tab-icon { opacity: 1; }
  .em-tab-btn:hover .em-tab-icon  { opacity: 0.9; }

  .em-tab-label-wrap {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    border-radius: 7px;
    transition: background 0.15s;
  }
  .em-tab-btn:hover .em-tab-label-wrap { background: #f3f4f6; }
  .em-tab-btn.active .em-tab-label-wrap { background: #eef2ff; }

  .em-shell-content {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 18px;
  }

  /* Mobile: hide icons on very small screens, compress padding */
  @media (max-width: 680px) {
    .em-shell-nav-inner { padding: 0 12px; }
    .em-tab-icon { display: none; }
    .em-tab-label-wrap { padding: 6px 8px; }
    .em-tab-btn { font-size: 12px; margin-right: 0; }
    .em-shell-content { padding: 0 12px; }
  }
  @media (max-width: 480px) {
    .em-tab-btn { height: 42px; font-size: 11.5px; }
    .em-tab-label-wrap { padding: 5px 7px; border-radius: 6px; }
  }
  @media (max-width: 360px) {
    .em-tab-label-wrap { padding: 4px 6px; }
    .em-tab-btn { font-size: 11px; }
    .em-shell-content { padding: 0 8px; }
  }
`;

export default function EventsManagerShell({ children }) {
  const pathname = usePathname();
  const router   = useRouter();

  return (
    <>
      <style>{SHELL_CSS}</style>

      {/* ── Tab Navigation ─────────────────────────────────────────── */}
      <div className="em-shell-nav-wrap">
        <div className="em-shell-nav-inner" role="tablist">
          {TABS.map(tab => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <button
                key={tab.href}
                role="tab"
                aria-selected={isActive}
                className={`em-tab-btn${isActive ? " active" : ""}`}
                onClick={() => router.push(tab.href)}
                title={tab.label}
              >
                <span className="em-tab-label-wrap">
                  <svg className="em-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? "2" : "1.75"} strokeLinecap="round" strokeLinejoin="round">
                    <path d={tab.icon} />
                  </svg>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Page Content ───────────────────────────────────────────── */}
      <div className="em-shell-content">
        {children}
      </div>
    </>
  );
}