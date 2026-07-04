"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { notify } from "@/lib/toast";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  royal: "#2B5CE6", royalD: "#1A3BAF", royalL: "#4A6FFF",
  royalXs: "rgba(43,92,230,0.06)", royalS: "rgba(43,92,230,0.11)",
  borderRoyal: "rgba(43,92,230,0.22)",
  ice: "#D0E4F7", sky: "#4A90D9", deepD: "#0D1B3E",
  white: "#FFFFFF", bg: "#F5F9FF",
  text: "#0D1B3E", muted: "#4B6880", faint: "#8AAFC8",
  border: "rgba(43,92,230,0.10)", border2: "rgba(43,92,230,0.18)",
  green: "#22C55E", greenXs: "rgba(34,197,94,0.08)", greenB: "rgba(34,197,94,0.25)",
  amber: "#F59E0B", amberXs: "rgba(245,158,11,0.08)", amberB: "rgba(245,158,11,0.25)",
  red: "#DC2626", redXs: "rgba(220,38,38,0.07)", redB: "rgba(220,38,38,0.22)",
  shXs: "0 1px 4px rgba(13,27,62,0.07)",
  shSm: "0 2px 10px rgba(13,27,62,0.09)",
  shMd: "0 4px 18px rgba(43,92,230,0.15)",
};
const FONT = "var(--adm-sans,Sora,sans-serif)";
const MONO = "var(--adm-mono,'JetBrains Mono',monospace)";

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIVE HOOK (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function useBreakpoint() {
  const [bp, setBp] = useState("lg");
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480) setBp("xs");
      else if (w < 640) setBp("sm");
      else if (w < 768) setBp("md");
      else if (w < 1024) setBp("lg");
      else if (w < 1280) setBp("xl");
      else setBp("2xl");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return bp;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILS (unchanged except getGridCols)
// ─────────────────────────────────────────────────────────────────────────────
const ini = (n = "") => n.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??";
const bColor = name => {
  const p = [T.royal, "#1877F2", "#36A420", "#8B5CF6", T.amber, T.sky, "#DB2777", "#059669"];
  let h = 0; for (const c of (name || "")) h = (h * 31 + c.charCodeAt(0)) % p.length;
  return p[h];
};
const truncateName = (text, limit = 16) => {
  if (!text) return "";
  return text.length > limit ? text.slice(0, limit) + "…" : text;
};

const getGridCols = (bp) => {
  if (bp === "xs") return 2;
  if (bp === "sm") return 3;
  if (bp === "md") return 4;
  if (bp === "lg") return 5;
  if (bp === "xl") return 6;
  return 7;
};

// ─────────────────────────────────────────────────────────────────────────────
// UploadAccountModal (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function UploadAccountModal({
  open,
  files = [],
  mediaType,
  mediaItems = [],
  mode = "upload",
  accounts,
  disabledAccountId,
  onConfirm,
  onCancel,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) { setSelectedIds([]); setSearchQ(""); }
  }, [open]);

  if (!open) return null;

  const filtered = accounts.filter(a =>
    !searchQ ||
    a.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
    a.metaAccountId?.toLowerCase().includes(searchQ.toLowerCase())
  );

  const toggle = (id) => {
    if (id === disabledAccountId) return;
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const eligible = filtered
      .filter(a => a.id !== disabledAccountId)
      .map(a => a.id);
    const allSelected = eligible.every(id => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : [...new Set([...selectedIds, ...eligible])]);
  };

  const headerLabel = mode === "upload"
    ? (files.length === 1 ? truncateName(files[0].name, 28) : `${files.length} ${mediaType === "video" ? "videos" : "images"}`)
    : `${mediaItems.length} item${mediaItems.length !== 1 ? "s" : ""} selected`;

  const eligibleCount = filtered.filter(a => a.id !== disabledAccountId).length;
  const allEligibleSelected = eligibleCount > 0 &&
    filtered.filter(a => a.id !== disabledAccountId).every(a => selectedIds.includes(a.id));

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(13,27,62,0.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px", animation: "admIn 0.18s ease",
      }}
    >
      <div style={{
        background: T.white, borderRadius: 16,
        width: "100%", maxWidth: 480,
        boxShadow: "0 24px 64px rgba(13,27,62,0.22)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        maxHeight: "90vh",
      }}>

        <div style={{
          background: `linear-gradient(135deg,#020c1b 0%,#071530 20%,${T.deepD} 55%,${T.royal} 100%)`,
          padding: "10px 20px 16px",
          position: "relative", overflow: "hidden", flexShrink: 0,
        }}>
          <div style={{ position: "absolute", top: -30, right: -20, width: 110, height: 110, borderRadius: "50%", background: "rgba(43,92,230,0.12)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, marginBottom: 10, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {mode === "upload" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="rgba(208,228,247,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 20h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="rgba(208,228,247,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: FONT, letterSpacing: "-0.02em", marginBottom: 4 }}>
              {mode === "upload" ? "Upload to Ad Account(s)" : "Copy to Another Account(s)"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(208,228,247,0.6)", fontFamily: FONT }}>
              {mode === "upload" ? "Select one or more accounts to receive the upload" : "Select accounts to copy the selected media into"}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "4px 10px", borderRadius: 99, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
              <span style={{ fontSize: 11 }}>{mode === "copy" ? "📋" : mediaType === "video" ? "🎬" : "🖼️"}</span>
              <span style={{ fontSize: 10, color: T.ice, fontFamily: FONT, fontWeight: 600 }}>{headerLabel}</span>
            </div>
          </div>
          <button onClick={onCancel} style={{ position: "absolute", top: 14, right: 14, width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(208,228,247,0.8)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.18)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.10)"}
          >✕</button>
        </div>

        <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px" }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke={T.faint} strokeWidth="1.5" />
                <path d="M10.5 10.5L13 13" stroke={T.faint} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search accounts…" autoFocus
                style={{ flex: 1, border: "none", outline: "none", fontSize: 11, color: T.text, background: "transparent", fontFamily: FONT }} />
              {searchQ && <button onClick={() => setSearchQ("")} style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>}
            </div>
            {eligibleCount > 1 && (
              <button onClick={selectAll} style={{
                padding: "6px 10px", borderRadius: 7, border: `1px solid ${T.border2}`,
                background: allEligibleSelected ? T.royalXs : T.bg,
                fontSize: 10, fontWeight: 700, color: T.royal,
                cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap", flexShrink: 0,
                transition: "background 0.15s",
              }}>
                {allEligibleSelected ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 8px" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", fontSize: 11, color: T.faint, fontFamily: FONT }}>No accounts found</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map(acc => {
                const isDisabled = acc.id === disabledAccountId;
                const isSel = selectedIds.includes(acc.id);
                const color = bColor(acc.name || "A");
                return (
                  <div
                    key={acc.id}
                    onClick={() => toggle(acc.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      border: `1.5px solid ${isSel ? T.borderRoyal : T.border}`,
                      background: isDisabled ? "rgba(139,175,200,0.06)" : isSel ? T.royalXs : T.bg,
                      boxShadow: isSel ? T.shMd : "none",
                      opacity: isDisabled ? 0.55 : 1,
                      transition: "all 0.14s",
                    }}
                    onMouseEnter={e => { if (!isDisabled && !isSel) e.currentTarget.style.background = "rgba(43,92,230,0.04)"; }}
                    onMouseLeave={e => { if (!isDisabled && !isSel) e.currentTarget.style.background = T.bg; }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${isSel ? T.royal : isDisabled ? T.faint : T.faint}`,
                      background: isSel ? T.royal : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.14s",
                    }}>
                      {isSel && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: isDisabled ? T.faint : isSel ? T.royal : color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: FONT, transition: "background 0.14s" }}>
                      {ini(acc.name || "Ad")}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: FONT, color: isDisabled ? T.faint : isSel ? T.royal : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {acc.name || "Unnamed Account"}
                      </div>
                      <div style={{ fontSize: 9.5, marginTop: 1, fontFamily: MONO, color: T.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {acc.metaAccountId}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                      {isDisabled && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(139,175,200,0.15)", color: T.faint, border: `1px solid rgba(139,175,200,0.3)`, fontFamily: FONT }}>
                          Current
                        </span>
                      )}
                      {acc.currency && !isDisabled && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: isSel ? T.royalS : T.royalXs, color: T.royal, border: `1px solid ${T.border2}`, fontFamily: FONT }}>
                          {acc.currency}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px 16px", flexShrink: 0, borderTop: `1px solid ${T.border}`, background: T.bg, display: "flex", flexDirection: "column", gap: 8 }}>
          {selectedIds.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 8, background: T.royalXs, border: `1px solid ${T.border2}` }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke={T.royal} strokeWidth="1.5" />
                <path d="M5 8l2.5 2.5L11 5.5" stroke={T.royal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 10, color: T.royal, fontFamily: FONT, fontWeight: 700 }}>
                {mode === "upload" ? "Uploading to" : "Copying to"} {selectedIds.length} account{selectedIds.length !== 1 ? "s" : ""}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 8, background: T.amberXs, border: `1px solid ${T.amberB}` }}>
              <span style={{ fontSize: 10, color: T.amber, fontFamily: FONT, fontWeight: 600 }}>⚠ Select at least one account to continue</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCancel} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${T.border2}`, background: T.white, fontSize: 11, fontWeight: 700, color: T.muted, cursor: "pointer", fontFamily: FONT, transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.bg}
              onMouseLeave={e => e.currentTarget.style.background = T.white}
            >Cancel</button>
            <button
              onClick={() => selectedIds.length && onConfirm(selectedIds)}
              disabled={!selectedIds.length}
              style={{
                flex: 2, padding: "9px 0", borderRadius: 9, border: "none",
                background: selectedIds.length ? `linear-gradient(135deg,${T.royal} 0%,${T.royalD} 100%)` : T.border,
                color: selectedIds.length ? "#fff" : T.faint,
                fontSize: 11, fontWeight: 700,
                cursor: selectedIds.length ? "pointer" : "not-allowed",
                fontFamily: FONT, boxShadow: selectedIds.length ? T.shMd : "none",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {mode === "upload" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 20h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {mode === "upload"
                ? `Upload${files.length > 1 ? ` ${files.length} files` : ""} to ${selectedIds.length || ""} account${selectedIds.length !== 1 ? "s" : ""}`
                : `Copy to ${selectedIds.length || "…"} account${selectedIds.length !== 1 ? "s" : ""}`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON PULSE & Skeletons (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonPulse({ width, height, borderRadius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius, flexShrink: 0,
      background: `linear-gradient(90deg,${T.royalXs} 25%,rgba(43,92,230,0.10) 50%,${T.royalXs} 75%)`,
      backgroundSize: "200% 100%",
      animation: "skelShimmer 1.4s ease-in-out infinite",
      ...style,
    }} />
  );
}

function LeftPanelSkeleton() {
  return (
    <div style={{ width: 248, flexShrink: 0, background: T.white, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "11px 13px 9px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SkeletonPulse width={100} height={11} borderRadius={4} />
        <SkeletonPulse width={22} height={16} borderRadius={99} />
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
            <SkeletonPulse width={34} height={34} borderRadius={9} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <SkeletonPulse width="62%" height={10} borderRadius={4} />
              <SkeletonPulse width="42%" height={8} borderRadius={4} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RightPanelSkeleton({ bp }) {
  const cols = getGridCols(bp);
  const isSmall = bp === "xs" || bp === "sm" || bp === "md";
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
      <div style={{ background: `linear-gradient(135deg,#020c1b 0%,#071530 15%,${T.deepD} 45%,#1a3580 75%,${T.royal} 100%)`, padding: isSmall ? "12px 14px" : "14px 18px", flexShrink: 0 }}>
        <SkeletonPulse width={70} height={8} borderRadius={3} style={{ background: "rgba(255,255,255,0.12)", marginBottom: 8 }} />
        <SkeletonPulse width={180} height={16} borderRadius={5} style={{ background: "rgba(255,255,255,0.12)", marginBottom: 8 }} />
        <SkeletonPulse width={140} height={9} borderRadius={3} style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>
      <div style={{ padding: isSmall ? "8px 12px" : "10px 16px", background: T.white, borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <SkeletonPulse width={isSmall ? "100%" : "38%"} height={32} borderRadius={8} />
        {!isSmall && <SkeletonPulse width={148} height={32} borderRadius={8} />}
        <SkeletonPulse width={88} height={32} borderRadius={8} />
      </div>
      <div style={{ flex: 1, padding: isSmall ? "12px" : "18px", display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: isSmall ? 10 : 12 }}>
        {Array.from({ length: cols * 3 }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ width: "100%", aspectRatio: "1" }}><SkeletonPulse width="100%" height="100%" borderRadius={10} /></div>
            <SkeletonPulse width="70%" height={8} borderRadius={4} style={{ margin: "0 auto" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaGridSkeleton({ bp }) {
  const cols = getGridCols(bp);
  const isSmall = bp === "xs" || bp === "sm";
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: isSmall ? 10 : 12, padding: isSmall ? "12px" : "12px 16px" }}>
      {Array.from({ length: cols * 3 }).map((_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ width: "100%", aspectRatio: "1", borderRadius: 10, overflow: "hidden" }}><SkeletonPulse width="100%" height="100%" borderRadius={10} /></div>
          <SkeletonPulse width="70%" height={8} borderRadius={4} style={{ margin: "0 auto" }} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LeftPanel (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function LeftPanel({ accounts, selectedAccount, onSelect, searchQuery, isMobile, isOpen, onClose }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!isMobile) return;
    const handler = e => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.(); };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, isMobile, onClose]);

  const filtered = accounts.filter(acc =>
    !searchQuery ||
    acc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.metaAccountId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const panel = (
    <div ref={panelRef} style={{ width: 248, flexShrink: 0, background: T.white, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden", ...(isMobile ? { position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 200, width: 280, boxShadow: "4px 0 24px rgba(13,27,62,0.15)", transform: isOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.22s ease" } : {}) }}>
      <div style={{ padding: "11px 13px 9px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily: FONT }}>Ad Accounts</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: T.royalXs, color: T.royal, border: `1px solid ${T.border2}`, fontFamily: FONT }}>{accounts.length}</span>
        </div>
        {isMobile && <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.muted }}>✕</button>}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 11, color: T.faint, fontFamily: FONT }}>No accounts found</div>
        ) : filtered.map(acc => {
          const sel = selectedAccount?.id === acc.id;
          return (
            <div key={acc.id} onClick={() => { onSelect(acc); if (isMobile) onClose?.(); }}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", background: sel ? `linear-gradient(135deg,${T.royalD} 0%,${T.royal} 100%)` : "transparent", cursor: "pointer", transition: "background 0.12s", borderBottom: `1px solid ${T.border}` }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = T.royalXs; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: sel ? "rgba(255,255,255,0.18)" : bColor(acc.name || "A"), border: `1px solid ${sel ? "rgba(255,255,255,0.22)" : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: FONT }}>{ini(acc.name || "Ad")}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT, color: sel ? "#fff" : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name || "Unnamed Account"}</div>
                <div style={{ fontSize: 9.5, marginTop: 1, fontFamily: MONO, color: sel ? "rgba(208,228,247,0.65)" : T.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.metaAccountId}</div>
              </div>
              {sel && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M6 12l6-4-6-4v8z" fill="rgba(255,255,255,0.75)" /></svg>}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (isMobile) return (<>{isOpen && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(13,27,62,0.3)", backdropFilter: "blur(2px)" }} />}{panel}</>);
  return panel;
}

// ─────────────────────────────────────────────────────────────────────────────
// MediaCard  
// ─────────────────────────────────────────────────────────────────────────────
function MediaCard({ item, selected, onSelect, uploadProgress, isSmall }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onSelect(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: isSmall ? 8 : 10,
        overflow: "hidden",
        border: selected ? `3px solid ${T.royal}` : `1.5px solid ${T.border}`,
        boxShadow: selected ? T.shMd : hovered ? T.shSm : T.shXs,
        transition: "all 0.15s",
        background: T.royalXs,
        cursor: "pointer",
      }}
    >
      <div style={{ width: "100%", height: "100%", background: T.royalXs }}>
        <img
          src={item.thumbnail || item.url}
          alt={item.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          onError={e => { e.target.style.display = "none"; }}
        />
      </div>

      {item.type === "video" && !item.isUploading && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.22)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: isSmall ? 22 : 28, height: isSmall ? 22 : 28, borderRadius: "50%", background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
            <svg width={isSmall ? 7 : 9} height={isSmall ? 9 : 11} viewBox="0 0 9 11" fill="none"><path d="M1 1l7 4.5L1 10V1z" fill={T.royal} /></svg>
          </div>
        </div>
      )}

      {item.isUploading && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", zIndex: 20, gap: 4 }}>
          <span style={{ fontSize: isSmall ? 8 : 10, fontFamily: FONT }}>Uploading…</span>
          <span style={{ fontSize: isSmall ? 11 : 14, fontWeight: 700, fontFamily: FONT }}>{uploadProgress || 0}%</span>
          <div style={{ width: "75%", height: 3, background: "rgba(255,255,255,0.3)", borderRadius: 99 }}>
            <div style={{ height: "100%", background: T.royal, borderRadius: 99, width: `${uploadProgress || 0}%`, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {!isSmall && (
        <div onClick={e => { e.stopPropagation(); const url = item.type === "video" ? (item.videoUrl || item.url) : item.url; if (url) window.open(url, "_blank"); }}
          style={{ position: "absolute", bottom: 4, left: 4, zIndex: 20, background: "rgba(0,0,0,0.6)", padding: "3px 4px", borderRadius: 6, cursor: "pointer", opacity: hovered ? 1 : 0, transition: "opacity 0.15s" }} title="Preview"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#fff">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
      )}

      <div onClick={e => { e.stopPropagation(); onSelect(item); }} style={{ position: "absolute", top: isSmall ? 4 : 6, right: isSmall ? 4 : 6, zIndex: 10 }}>
        <div style={{ width: isSmall ? 14 : 16, height: isSmall ? 14 : 16, borderRadius: "50%", background: selected ? T.royal : "rgba(255,255,255,0.9)", border: selected ? "none" : "1.5px solid rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: selected ? T.shMd : "0 1px 3px rgba(0,0,0,0.15)", transition: "all 0.15s" }}>
          {selected && <svg width="7" height="5" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetPanel ── EQUAL SIZE GRID
// ─────────────────────────────────────────────────────────────────────────────
function AssetPanel({ selectedAccount, accounts, bp }) {
  const [mediaTab, setMediaTab] = useState("image");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("upload");
  const [pendingFiles, setPendingFiles] = useState([]);

  const isXs = bp === "xs";
  const isSmall = bp === "xs" || bp === "sm";
  const isMedium = bp === "md";
  const cols = getGridCols(bp);
  const gridGap = isSmall ? 10 : 12;
  const gridPadding = isSmall ? "12px" : isMedium ? "14px" : "18px 20px";

  useEffect(() => {
    if (!selectedAccount?.id) return;
    const adAccountId = selectedAccount.id;
    const fetchAssets = async () => {
      setLoadingMedia(true);
      setMediaFiles([]);
      setSelectedFiles([]);
      try {
        const res = await fetch(`/api/meta/ad-assets?adAccountId=${adAccountId}`, { credentials: "include" });
        const data = await res.json();
        if (!data.success) return;
        if (mediaTab === "image") {
          setMediaFiles((data.assets?.images || []).map(img => ({ id: img.id, name: img.name, hash: img.hash, thumbnail: img.url, url: img.url, width: img.width, height: img.height, type: "image" })));
        } else {
          setMediaFiles((data.assets?.videos || []).map(vid => ({ id: vid.id, name: vid.title, thumbnail: vid.thumbnail_url || "", url: vid.thumbnail_url || "", videoUrl: vid.playable_url || "", embedHtml: vid.embed_html || "", hash: vid.id, width: "—", height: "—", type: "video" })));
        }
      } catch (err) {
        console.error("Failed to fetch assets:", err);
      } finally {
        setLoadingMedia(false);
      }
    };
    fetchAssets();
  }, [selectedAccount?.metaAccountId, mediaTab]);
  console.log("Media files:", mediaFiles);

  const uploadImage = async (file, accountId) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("accountId", accountId);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(prev => ({ ...prev, [file.name]: Math.round((e.loaded / e.total) * 100) })); };
      xhr.onload = () => { if (xhr.status === 200) { setUploadProgress(prev => { const c = { ...prev }; delete c[file.name]; return c; }); resolve(JSON.parse(xhr.responseText)); } else reject(new Error("Upload failed")); };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.open("POST", "/api/media/upload-image");
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  };

  const uploadVideo = async (file, accountId) => {
    if (file.size > 4 * 1024 * 1024 * 1024) throw new Error("Video file size exceeds 4GB limit");
    if (!["video/mp4", "video/quicktime", "video/x-m4v"].includes(file.type)) throw new Error("Invalid video format. Only .mp4, .mov supported");
    const formData = new FormData();
    formData.append("video", file);
    formData.append("accountId", accountId);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(prev => ({ ...prev, [file.name]: Math.round((e.loaded / e.total) * 100) })); };
      xhr.onload = () => { if (xhr.status === 200) { setUploadProgress(prev => { const c = { ...prev }; delete c[file.name]; return c; }); resolve(JSON.parse(xhr.responseText)); } else { try { reject(new Error(JSON.parse(xhr.responseText).error || "Upload failed")); } catch { reject(new Error("Upload failed")); } } };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.open("POST", "/api/media/upload-video");
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  };

  const executeUploadToAccount = async (files, accountId) => {
    const accountName = accounts.find(a => a.id === accountId)?.name || accountId;
    for (const file of files) {
      const tempId = `temp-${Date.now()}-${Math.random()}-${file.name}`;
      if (accountId === selectedAccount?.id) {
        setMediaFiles(prev => [{
          id: tempId, name: file.name,
          thumbnail: URL.createObjectURL(file), url: URL.createObjectURL(file),
          videoUrl: mediaTab === "video" ? URL.createObjectURL(file) : "",
          embedHtml: "", width: "—", height: "—",
          type: mediaTab, isUploading: true, progressKey: file.name,
        }, ...prev]);
      }
      const toastId = notify.loading(`Uploading ${file.name} → ${accountName}…`);
      try {
        const result = mediaTab === "video"
          ? await uploadVideo(file, accountId)
          : await uploadImage(file, accountId);
        if (accountId === selectedAccount?.id) {
          setMediaFiles(prev => prev.map(item => item.id !== tempId ? item : {
            ...item,
            id: result.video_id || result.image_hash,
            hash: result.video_id || result.image_hash,
            name: result.title || result.name || file.name,
            thumbnail: result.thumbnail_url || item.thumbnail,
            url: result.thumbnail_url || result.url || item.url,
            videoUrl: result.playable_url || item.videoUrl,
            embedHtml: result.embed_html || "",
            isUploading: false,
          }));
        }
        notify.dismiss(toastId);
        notify.success(`${file.name} → ${accountName} ✓`);
      } catch (err) {
        notify.dismiss(toastId);
        notify.error(`${file.name}: ${err.message || "Upload failed"}`);
        if (accountId === selectedAccount?.id) {
          setMediaFiles(prev => prev.filter(x => x.id !== tempId));
          setUploadProgress(prev => { const c = { ...prev }; delete c[file.name]; return c; });
        }
      }
    }
  };

  const copyItemToAccount = async (item, accountId) => {
    const accountName = accounts.find(a => a.id === accountId)?.name || accountId;
    console.log("🟡 copyItemToAccount START", { item, accountId, accountName });

    const toastId = notify.loading(`Copying "${item.name}" → ${accountName}…`);
    try {
      const assetUrl = item.type === "video" ? (item.videoUrl || item.url) : item.url;
      const assetName = (item.name && item.name.trim()) ? item.name.trim() : (item.type === "video" ? "video.mp4" : "image.jpg");

      console.log("📦 Payload being sent:", {
        sourceAccountId: selectedAccount?.id,
        targetAccountId: accountId,
        assetType: item.type,
        assetUrl,
        assetName,
      });

      const res = await fetch("/api/meta/copy-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceAccountId: selectedAccount?.id,
          targetAccountId: accountId,
          assetType: item.type,
          assetUrl,
          assetName,
        }),
      });

      console.log("📡 API response status:", res.status, res.ok);

      const result = await res.json();
      console.log("📨 API response body:", result);

      if (!res.ok) {
        console.error("❌ API returned error:", result?.error || result?.message);
        throw new Error(result?.error || result?.message || "Copy failed");
      }

      console.log("✅ Copy success. Updating UI with:", {
        id: result.video_id || result.image_hash || result.id,
        name: result.title || result.name || item.name || assetName,
        thumbnail: result.thumbnail_url || item.thumbnail,
        videoUrl: result.playable_url || item.videoUrl || "",
      });

      if (accountId === selectedAccount?.id) {
        setMediaFiles(prev => [{
          id: result.video_id || result.image_hash || result.id,
          hash: result.video_id || result.image_hash || result.id,
          name: result.title || result.name || item.name || assetName,
          thumbnail: result.thumbnail_url || item.thumbnail,
          url: result.thumbnail_url || result.url || item.url,
          videoUrl: result.playable_url || item.videoUrl || "",
          embedHtml: result.embed_html || "",
          width: item.width, height: item.height,
          type: item.type,
        }, ...prev]);
      }

      notify.dismiss(toastId);
      notify.success(`"${item.name}" copied to ${accountName} ✓`);
    } catch (err) {
      console.error("💥 copyItemToAccount ERROR:", err.message, err);
      notify.dismiss(toastId);
      notify.error(`Copy failed: ${err.message || "Unknown error"}`);
    }
  };

  const handleFileInputChange = async e => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    if (!files.length) return;
    await executeUploadToAccount(files, selectedAccount.id);
  };

  const handleUploadConfirm = async (accountIds) => {
    setModalOpen(false);
    const files = pendingFiles;
    setPendingFiles([]);
    await Promise.all(accountIds.map(id => executeUploadToAccount(files, id)));
  };

  const handleOpenCopyModal = () => {
    setModalMode("copy");
    setModalOpen(true);
  };

  const handleCopyConfirm = async (accountIds) => {
    setModalOpen(false);
    const items = selectedFiles;
    const tasks = items.flatMap(item => accountIds.map(id => copyItemToAccount(item, id)));
    await Promise.all(tasks);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setPendingFiles([]);
  };

  // const handleSelect = item => {
  //   setSelectedFiles(prev => prev.find(x => x.id === item.id) ? prev.filter(x => x.id !== item.id) : [...prev, item]);
  // };

  const handleSelect = item => {
    setSelectedFiles(prev =>
      prev.length && prev[0].id === item.id ? [] : [item]
    );
  };

  const filteredFiles = mediaFiles.filter(item => item.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!selectedAccount) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>💳</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.muted, fontFamily: FONT }}>Select an Ad Account</div>
          <div style={{ fontSize: 11, color: T.faint, marginTop: 4, fontFamily: FONT }}>Choose an account from the left panel</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <UploadAccountModal
        open={modalOpen}
        mode={modalMode}
        files={pendingFiles}
        mediaType={mediaTab}
        mediaItems={selectedFiles}
        accounts={accounts}
        disabledAccountId={modalMode === "copy" ? selectedAccount?.id : undefined}
        onConfirm={modalMode === "upload" ? handleUploadConfirm : handleCopyConfirm}
        onCancel={handleModalCancel}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>

        <div style={{ background: `linear-gradient(135deg,#020c1b 0%,#071530 15%,${T.deepD} 45%,#1a3580 75%,${T.royal} 100%)`, padding: isSmall ? "10px 14px" : "14px 18px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(43,92,230,0.08)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.sky, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 4, fontFamily: FONT }}>Ad Account</div>
            <div style={{ fontSize: isSmall ? 13 : 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", fontFamily: FONT, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedAccount.name || "Unnamed Account"}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 9.5, color: "rgba(208,228,247,0.5)", fontFamily: MONO }}>ID: {selectedAccount.metaAccountId}</span>
              {selectedAccount.status && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "rgba(255,255,255,0.12)", color: T.ice, border: "1px solid rgba(255,255,255,0.18)", fontFamily: FONT }}>{selectedAccount.status}</span>}
              {selectedAccount.currency && !isXs && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "rgba(255,255,255,0.08)", color: "rgba(208,228,247,0.65)", border: "1px solid rgba(255,255,255,0.12)", fontFamily: FONT }}>{selectedAccount.currency}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isSmall ? 7 : 10, padding: isSmall ? "8px 12px" : "10px 16px", background: T.white, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: isSmall ? "1 1 100%" : 1, minWidth: isSmall ? "100%" : 140, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", order: 0 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke={T.faint} strokeWidth="1.5" /><path d="M10.5 10.5L13 13" stroke={T.faint} strokeWidth="1.5" strokeLinecap="round" /></svg>
            <input type="text" placeholder="Search media…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, border: "none", outline: "none", fontSize: 11, color: T.text, background: "transparent", fontFamily: FONT }} />
            {searchQuery && <button onClick={() => setSearchQuery("")} style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>}
          </div>

          <div style={{ display: "flex", gap: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 3, flexShrink: 0, order: 1, flex: isSmall ? "1 1 auto" : "0 0 auto" }}>
            {[
              { id: "image", label: isXs ? "Img" : "Images", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" /><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" /><path d="M21 15l-6-6L3 21" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg> },
              { id: "video", label: isXs ? "Vid" : "Videos", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="M9 9l6 3-6 3V9z" fill="currentColor" /></svg> },
            ].map(t => (
              <button key={t.id} onClick={() => setMediaTab(t.id)} style={{ padding: isSmall ? "5px 10px" : "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: FONT, flex: isSmall ? 1 : "0 0 auto", background: mediaTab === t.id ? `linear-gradient(135deg,${T.royal} 0%,${T.royalD} 100%)` : "transparent", color: mediaTab === t.id ? "#fff" : T.muted, boxShadow: mediaTab === t.id ? T.shMd : "none", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, whiteSpace: "nowrap" }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          <button onClick={() => fileInputRef.current?.click()}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: isSmall ? "7px 12px" : "7px 14px", borderRadius: 8, cursor: "pointer", background: T.royalXs, border: `1px solid ${T.border2}`, fontSize: 11, fontWeight: 700, color: T.royal, fontFamily: FONT, flexShrink: 0, transition: "background 0.15s", order: 2, whiteSpace: "nowrap" }}
            onMouseEnter={e => e.currentTarget.style.background = T.royalS}
            onMouseLeave={e => e.currentTarget.style.background = T.royalXs}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {isXs ? "Upload" : "Upload new"}
          </button>

          {selectedFiles.length > 0 && (
            <button onClick={() => setSelectedFiles([])} style={{ padding: isSmall ? "6px 10px" : "7px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, fontSize: 11, fontWeight: 700, color: T.muted, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>
              Clear
            </button>
          )}

          {selectedFiles.length > 0 && accounts.length > 1 && (
            <button
              onClick={handleOpenCopyModal}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: isSmall ? "6px 10px" : "7px 14px", borderRadius: 8,
                border: `1px solid ${T.border2}`, background: T.royalXs,
                fontSize: 11, fontWeight: 700, color: T.royal,
                cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.royalS}
              onMouseLeave={e => e.currentTarget.style.background = T.royalXs}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 20h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {isXs ? "Copy" : "Upload to another account"}
            </button>
          )}

          {/* <input ref={fileInputRef} type="file" accept={mediaTab === "image" ? "image/*" : "video/mp4,video/quicktime,video/x-m4v"} hidden onChange={handleFileInputChange} />*/}

          <input
            ref={fileInputRef}
            type="file"
            accept={mediaTab === "image"
              ? "image/jpeg,image/jpg,image/png,image/gif,image/webp"
              : "video/mp4,video/quicktime,video/mov,video/avi,video/mpeg"
            }
            hidden
            onChange={handleFileInputChange}
          />

          {selectedFiles.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, fontFamily: FONT, color: T.royal, background: T.royalXs, border: `1px solid ${T.border2}`, borderRadius: 99, padding: "3px 10px", flexShrink: 0, order: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.royal, boxShadow: `0 0 4px ${T.royal}` }} />
              {selectedFiles.length} selected
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loadingMedia ? (
            <MediaGridSkeleton bp={bp} />
          ) : filteredFiles.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: 8 }}>
              <div style={{ fontSize: 32 }}>{mediaTab === "video" ? "🎬" : "🖼️"}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, fontFamily: FONT }}>No {mediaTab === "video" ? "videos" : "images"} found</div>
              <div style={{ fontSize: 10, color: T.faint, fontFamily: FONT }}>Upload your first {mediaTab} to get started</div>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: gridGap,
              padding: gridPadding,
              alignContent: "start",
            }}>
              {filteredFiles.map(item => (
                <div key={item.id} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <MediaCard
                    item={item}
                    selected={selectedFiles.some(x => x.id === item.id)}
                    onSelect={handleSelect}
                    uploadProgress={uploadProgress[item.progressKey]}
                    isSmall={isSmall}
                  />
                  <p style={{
                    marginTop: isSmall ? 4 : 6,
                    textAlign: "center",
                    fontSize: isSmall ? 9 : 10,
                    fontWeight: 600,
                    color: T.text,
                    fontFamily: FONT,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    padding: "0 2px",
                  }}>
                    {truncateName(item.name, isSmall ? 10 : 14)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: isSmall ? "8px 12px" : "10px 16px", borderTop: `1px solid ${T.border}`, background: T.white, flexShrink: 0, position: "sticky", bottom: 0, zIndex: 10, boxShadow: "0 -2px 8px rgba(13,27,62,0.06)", gap: 8 }}>
          <span style={{ fontSize: isSmall ? 10 : 11, color: T.faint, fontFamily: FONT, whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 700, color: T.text }}>{selectedFiles.length}</span>
            {!isXs && ` / ${mediaFiles.length}`}
            {isXs ? " sel" : " selected"}
          </span>
          {/* <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={() => { if (!selectedFiles.length) return; console.log("🟢 Selected files:", selectedFiles); }} disabled={selectedFiles.length === 0}
              style={{ padding: isSmall ? "6px 14px" : "7px 20px", borderRadius: 8, border: "none", background: selectedFiles.length === 0 ? T.border : `linear-gradient(135deg,${T.royal} 0%,${T.royalD} 100%)`, color: selectedFiles.length === 0 ? T.faint : "#fff", fontSize: 11, fontWeight: 700, cursor: selectedFiles.length === 0 ? "not-allowed" : "pointer", fontFamily: FONT, boxShadow: selectedFiles.length === 0 ? "none" : T.shMd, transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {isXs ? "Create →" : "Create Ad →"}
            </button>
          </div> */}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export default function MediaManagerPage() {
  const bp = useBreakpoint();
  const isMobile = bp === "xs" || bp === "sm" || bp === "md";
  const isXs = bp === "xs";

  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchAdAccounts = async () => {
      try {
        const res = await fetch("/api/meta-accounts", { credentials: "include" });
        if (res.ok) {
          const { accounts } = await res.json();
          setAccounts(accounts || []);
          if (accounts?.length > 0) setSelectedAccount(accounts[0]);
        } else {
          setError("Failed to load ad accounts");
        }
      } catch (err) {
        console.error("Error fetching accounts:", err);
        setError("Could not connect to Meta API");
      } finally {
        setLoadingAccounts(false);
      }
    };
    fetchAdAccounts();
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT, background: T.bg }}>
      <style>{`
        @keyframes admSpin { to { transform: rotate(360deg) } }
        @keyframes admIn { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: none } }
        @keyframes skelShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        * { box-sizing: border-box }
        ::-webkit-scrollbar { width: 4px; height: 4px }
        ::-webkit-scrollbar-thumb { background: ${T.ice}; border-radius: 99px }
        ::-webkit-scrollbar-track { background: transparent }
      `}</style>

      <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, flexShrink: 0, boxShadow: T.shXs }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, padding: "0 20px", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(p => !p)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            )}
            <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `linear-gradient(135deg,${T.royal} 0%,${T.royalD} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: T.shMd }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" fill="#fff" opacity="0.9" /><rect x="13" y="3" width="8" height="8" rx="2" fill="#fff" opacity="0.6" /><rect x="3" y="13" width="8" height="8" rx="2" fill="#fff" opacity="0.6" /><rect x="13" y="13" width="8" height="8" rx="2" fill="#fff" opacity="0.3" /></svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, letterSpacing: "-0.03em", fontFamily: FONT, lineHeight: 1.2 }}>Media Manager</div>
              {!isXs && <div style={{ fontSize: 9.5, color: T.faint, fontFamily: FONT, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loadingAccounts ? "Loading accounts…" : selectedAccount ? `${selectedAccount.name} · ${selectedAccount.metaAccountId}` : `${accounts.length} account${accounts.length !== 1 ? "s" : ""} connected`}</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9.5, fontWeight: 600, color: loadingAccounts ? T.amber : T.green, background: loadingAccounts ? T.amberXs : T.greenXs, border: `1px solid ${loadingAccounts ? T.amberB : T.greenB}`, borderRadius: 99, padding: "3px 10px", fontFamily: FONT, whiteSpace: "nowrap", flexShrink: 0 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: loadingAccounts ? T.amber : T.green, boxShadow: `0 0 4px ${loadingAccounts ? T.amber : T.green}` }} />
            {loadingAccounts ? "…" : isXs ? `${accounts.length}` : `${accounts.length} acct${accounts.length !== 1 ? "s" : ""}`}
          </div>
        </div>
        {!isMobile && (
          <div style={{ padding: "0 14px 9px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 11px" }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke={T.faint} strokeWidth="1.5" /><path d="M10.5 10.5L13 13" stroke={T.faint} strokeWidth="1.5" strokeLinecap="round" /></svg>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search ad accounts…" style={{ flex: 1, border: "none", outline: "none", fontSize: 11, color: T.text, background: "transparent", fontFamily: FONT }} />
              {searchQuery && <button onClick={() => setSearchQuery("")} style={{ border: "none", background: "none", cursor: "pointer", color: T.faint, fontSize: 12, lineHeight: 1 }}>✕</button>}
            </div>
          </div>
        )}
      </div>

      {error && <div style={{ padding: "8px 14px", background: T.redXs, borderBottom: `1px solid ${T.redB}`, fontSize: 11, color: T.red, fontWeight: 700, fontFamily: FONT, flexShrink: 0 }}>⚠ {error}</div>}

      <div style={{ flex: 1, display: "flex", overflow: "hidden", animation: "admIn 0.25s ease" }}>
        {loadingAccounts ? (
          <>{!isMobile && <LeftPanelSkeleton />}<RightPanelSkeleton bp={bp} /></>
        ) : (
          <>
            <LeftPanel accounts={accounts} selectedAccount={selectedAccount} onSelect={setSelectedAccount} searchQuery={searchQuery} isMobile={isMobile} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <AssetPanel selectedAccount={selectedAccount} accounts={accounts} bp={bp} />
          </>
        )}
      </div>
    </div>
  );
}



