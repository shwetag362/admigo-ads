"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Bell, LogOut, Settings, ChevronDown, User } from "lucide-react";

// ─── Theme tokens — exactly mirrors sidebar ───────────────────────────────────
const T = {
  royal:       "#2B5CE6",
  royalD:      "#1A3BAF",
  royalL:      "#4A6FFF",
  royalXs:     "rgba(43,92,230,0.06)",
  royalS:      "rgba(43,92,230,0.11)",
  borderRoyal: "rgba(43,92,230,0.22)",
  ice:         "#D0E4F7",
  sky:         "#4A90D9",
  deepD:       "#0D1B3E",
  white:       "#FFFFFF",
  bg:          "#F5F9FF",
  text:        "#0D1B3E",
  muted:       "#4B6880",
  faint:       "#8AAFC8",
  border:      "rgba(43,92,230,0.10)",
  amber:       "#F59E0B",
  red:         "#DC2626",
  redXs:       "rgba(220,38,38,0.07)",
};

export const HEADER_H = 64;

const routeNameMap = {
  "/dashboard/overview":                   "Overview",
  "/dashboard/ads-manager":                "Ads Manager",
  "/dashboard/ads-manager/create":         "Create Ad",
  "/dashboard/ads-manager/campaigns":      "All Campaigns",
  "/dashboard/ads-manager/audiences":      "Audiences",
  "/dashboard/ads-manager/creatives":      "Creatives",
  "/dashboard/ads-reporting":              "Ads Reporting",
  "/dashboard/ads-reporting/performance":  "Performance",
  "/dashboard/ads-reporting/analytics":    "Analytics",
  "/dashboard/ads-reporting/export":       "Export Reports",
  "/dashboard/events-manager":             "Events Manager",
  "/dashboard/events-manager/overview":    "Events Overview",
  "/dashboard/events-manager/datasources": "Data Sources",
  "/dashboard/events-manager/pixels":      "Pixel Setup",
  "/dashboard/events-manager/conversions-api": "Conversions API",
  "/dashboard/events-manager/datasets":    "Datasets",
  "/dashboard/orders-manager":             "Orders Manager",
  "/dashboard/ad-monitor":                 "Ad Monitor",
  "/dashboard/account-manager":            "Account Manager",
  "/dashboard/account-manager/ad-accounts":  "Ad Accounts",
  "/dashboard/account-manager/team-members": "Team Members",
  "/dashboard/account-manager/orgs":         "Organizations",
  "/dashboard/settings/general":           "General Settings",
  "/dashboard/settings/add-f-accounts":    "Connect Facebook",
  "/dashboard/accounts/notifications":     "Notifications",
  "/dashboard/accounts/security":          "Security",
};

const getInitials = (name) => {
  if (!name) return "U";
  return name.split(" ").map((w) => w.charAt(0)).join("").toUpperCase().slice(0, 2);
};

const NOTIF_ITEMS = [
  { icon: "🔔", text: "New Instagram comment received",  time: "2m ago",  dot: T.amber },
  { icon: "✅", text: "Campaign successfully published", time: "1h ago",  dot: "#22C55E" },
  { icon: "💬", text: "5 unread messages",               time: "3h ago",  dot: T.royal },
];

// ─── CSS injection for animations ─────────────────────────────────────────────
const injectStyles = () => {
  if (typeof document === "undefined") return;
  const id = "app-header-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @keyframes dropIn {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    .notif-row:hover {
      background: ${T.royalXs} !important;
    }
    .user-menu-item:hover {
      background: ${T.royalXs} !important;
    }
    .logout-item:hover {
      background: ${T.redXs} !important;
      color: ${T.red} !important;
    }
  `;
  document.head.appendChild(style);
};

// ─── NotifDropdown ────────────────────────────────────────────────────────────
const NotifDropdown = ({ onClose, isMobile, isSmall }) => (
  <div
    data-notif-dropdown
    style={{
      // On mobile: fixed + centred horizontally so it never clips
      position:     isMobile ? "fixed" : "absolute",
      top:          isMobile ? `${HEADER_H + 8}px` : "calc(100% + 10px)",
      // Desktop: align to right edge of bell button
      // Mobile: stretch edge-to-edge with small margin
      ...(isMobile
        ? {
            left:  "10px",
            right: "10px",
            width: "auto",
          }
        : {
            right: 0,
            width: "300px",
          }),
      background:   T.white,
      border:       `1px solid ${T.ice}`,
      borderRadius: "16px",
      boxShadow:    `0 16px 48px rgba(13,27,62,0.18), 0 2px 8px rgba(13,27,62,0.08)`,
      overflow:     "hidden",
      zIndex:       300,
      animation:    "dropIn 0.18s cubic-bezier(.16,1,.3,1) both",
    }}
  >
    {/* Dark-to-light gradient accent — exact match to sidebar/header */}
    <div style={{
      height: "3px",
      background: `linear-gradient(90deg, #020c1b 0%, #071530 8%, ${T.deepD} 20%, ${T.royalD} 42%, ${T.royal} 62%, ${T.sky} 80%, ${T.ice} 100%)`,
    }} />

    {/* Header */}
    <div style={{
      padding: "13px 16px 11px",
      borderBottom: `1px solid ${T.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <p style={{ fontSize: "0.78rem", fontWeight: 700, color: T.text, margin: 0 }}>
        Notifications
      </p>
      <span style={{
        fontSize: "0.6rem", fontWeight: 700, color: T.royal,
        background: T.royalXs, border: `1px solid ${T.borderRoyal}`,
        padding: "2px 7px", borderRadius: "99px",
      }}>
        3 new
      </span>
    </div>

    {/* List */}
    <ul style={{ padding: "6px", margin: 0, listStyle: "none" }}>
      {NOTIF_ITEMS.map((n, i) => (
        <li
          key={i}
          className="notif-row"
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "9px 10px", borderRadius: "10px",
            cursor: "pointer", transition: "background 0.12s",
            marginBottom: i < NOTIF_ITEMS.length - 1 ? "2px" : 0,
          }}
        >
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: T.royalXs, border: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: "0.9rem",
          }}>
            {n.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: "block", fontSize: "0.72rem", color: T.text,
              fontWeight: 500, lineHeight: 1.35,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {n.text}
            </span>
            <span style={{ fontSize: "0.62rem", color: T.faint, marginTop: "1px", display: "block" }}>
              {n.time}
            </span>
          </div>
          <span style={{
            width: "7px", height: "7px", borderRadius: "50%",
            background: n.dot, flexShrink: 0,
          }} />
        </li>
      ))}
    </ul>

    {/* Footer */}
    <div style={{ padding: "4px 6px 8px" }}>
      <button
        onClick={onClose}
        style={{
          width: "100%", padding: "8px", borderRadius: "10px",
          fontSize: "0.72rem", fontWeight: 600, color: T.royal,
          background: T.royalXs, border: `1px solid ${T.borderRoyal}`,
          cursor: "pointer", fontFamily: "inherit",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = T.royalS; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = T.royalXs; }}
      >
        View all notifications →
      </button>
    </div>
  </div>
);

// ─── UserDropdown ──────────────────────────────────────────────────────────────
const UserDropdown = ({ userData, onNavigate, onLogout, onClose, isMobile }) => (
  <div
    data-user-dropdown
    style={{
      position:     isMobile ? "fixed" : "absolute",
      top:          isMobile ? `${HEADER_H + 8}px` : "calc(100% + 10px)",
      ...(isMobile
        ? { left: "10px", right: "10px", width: "auto" }
        : { right: 0, width: "232px" }),
      background:   T.white,
      border:       `1px solid ${T.ice}`,
      borderRadius: "16px",
      boxShadow:    `0 16px 48px rgba(13,27,62,0.18), 0 2px 8px rgba(13,27,62,0.08)`,
      overflow:     "hidden",
      zIndex:       300,
      animation:    "dropIn 0.18s cubic-bezier(.16,1,.3,1) both",
    }}
  >
    {/* Dark-to-light gradient accent */}
    <div style={{
      height: "3px",
      background: `linear-gradient(90deg, #020c1b 0%, #071530 8%, ${T.deepD} 20%, ${T.royalD} 42%, ${T.royal} 62%, ${T.sky} 80%, ${T.ice} 100%)`,
    }} />

    {/* User info */}
    <div style={{
      padding: "14px 16px 12px",
      borderBottom: `1px solid ${T.border}`,
      display: "flex", alignItems: "center", gap: "11px",
    }}>
      <div style={{
        width: "38px", height: "38px", borderRadius: "10px",
        overflow: "hidden", flexShrink: 0,
        border: `1.5px solid ${T.borderRoyal}`,
        background: T.royalXs,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {userData?.avatar
          ? <img src={userData.avatar} alt={userData.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: "0.72rem", fontWeight: 700, color: T.royal }}>
              {getInitials(userData?.name)}
            </span>
        }
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{
          fontSize: "0.82rem", fontWeight: 700, color: T.text,
          margin: 0, lineHeight: 1.25,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {userData?.name || "User"}
        </p>
        <p style={{
          fontSize: "0.65rem", color: T.faint, margin: "2px 0 0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {userData?.email}
        </p>
      </div>
    </div>

    {/* Menu items */}
    <div style={{ padding: "6px" }}>
      <button
        className="user-menu-item"
        onClick={() => { onNavigate("/dashboard/settings/general"); onClose(); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "9px",
          padding: "9px 10px", borderRadius: "9px",
          fontSize: "0.77rem", fontWeight: 500, color: T.muted,
          background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit",
          transition: "background 0.12s, color 0.12s",
        }}
      >
        <Settings style={{ width: "14px", height: "14px", color: T.faint, flexShrink: 0 }} />
        Account Settings
      </button>

      <button
        className="user-menu-item"
        onClick={() => { onNavigate("/dashboard/accounts/notifications"); onClose(); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "9px",
          padding: "9px 10px", borderRadius: "9px",
          fontSize: "0.77rem", fontWeight: 500, color: T.muted,
          background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit",
          transition: "background 0.12s, color 0.12s",
        }}
      >
        <Bell style={{ width: "14px", height: "14px", color: T.faint, flexShrink: 0 }} />
        Notifications
      </button>
    </div>

    <div style={{ height: "1px", background: T.border, margin: "0 8px" }} />

    <div style={{ padding: "6px 6px 8px" }}>
      <button
        className="logout-item"
        onClick={() => { onLogout(); onClose(); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "9px",
          padding: "9px 10px", borderRadius: "9px",
          fontSize: "0.77rem", fontWeight: 600, color: T.red,
          background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit",
          transition: "background 0.12s",
        }}
      >
        <LogOut style={{ width: "14px", height: "14px", flexShrink: 0 }} />
        Log out
      </button>
    </div>
  </div>
);

// ─── AppHeader ────────────────────────────────────────────────────────────────
export function AppHeader({ userData, isLoadingUser, onLogout }) {
  const pathname    = usePathname();
  const router      = useRouter();
  const { state }   = useSidebar();
  const isCollapsed = state === "collapsed";

  const [isMobile,       setIsMobile]       = useState(false);
  const [isSmall,        setIsSmall]         = useState(false);
  const [showNotif,      setShowNotif]       = useState(false);
  const [showUserMenu,   setShowUserMenu]    = useState(false);
  const [activeAdsTab,   setActiveAdsTab]    = useState("");

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    const mqlM = window.matchMedia("(max-width: 767px)");
    const mqlS = window.matchMedia("(max-width: 480px)");
    const checkM = (e) => setIsMobile(e.matches);
    const checkS = (e) => setIsSmall(e.matches);
    setIsMobile(mqlM.matches);
    setIsSmall(mqlS.matches);
    mqlM.addEventListener("change", checkM);
    mqlS.addEventListener("change", checkS);
    return () => {
      mqlM.removeEventListener("change", checkM);
      mqlS.removeEventListener("change", checkS);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e) => {
      if (!e.target.closest("[data-notif-dropdown]"))    setShowNotif(false);
      if (!e.target.closest("[data-user-dropdown-wrap]")) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    const handle = (e) => setActiveAdsTab(e.detail);
    window.addEventListener("adsManagerTabChange", handle);
    return () => window.removeEventListener("adsManagerTabChange", handle);
  }, []);

  const handleNavClick  = useCallback((url) => router.push(url), [router]);
  const handleLogout    = useCallback(async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) router.push("/login");
      else alert("Logout failed. Please try again.");
    } catch {
      alert("Something went wrong. Please try again.");
    }
  }, [router, onLogout]);

  const currentPageName = routeNameMap[pathname] || "Dashboard";

  const headerLeft = isMobile
    ? "0px"
    : isCollapsed
      ? "var(--sidebar-width-icon, 3rem)"
      : "var(--sidebar-width, 16rem)";

  return (
    <header
      style={{
        position:    "fixed",
        top:         0,
        right:       0,
        left:        headerLeft,
        height:      `${HEADER_H}px`,
        minHeight:   `${HEADER_H}px`,
        maxHeight:   `${HEADER_H}px`,
        zIndex:      50,
        transition:  "left 0.2s ease",
        display:     "flex",
        alignItems:  "center",
        justifyContent: "space-between",
        gap:         "8px",
        paddingLeft:  isSmall ? "10px" : isMobile ? "14px" : "18px",
        paddingRight: isSmall ? "10px" : isMobile ? "14px" : "22px",
        boxSizing:   "border-box",
        background:  T.white,
        borderBottom: `1px solid ${T.ice}`,
        boxShadow:   `0 1px 0 ${T.border}, 0 4px 16px rgba(13,27,62,0.04)`,
      }}
    >
      {/* ── Dark-to-light gradient accent bar — mirrors sidebar exactly ── */}
      <div style={{
        position:      "absolute",
        top:           0, left: 0, right: 0,
        height:        "3px",
        background:    `linear-gradient(90deg, #020c1b 0%, #071530 8%, ${T.deepD} 20%, ${T.royalD} 42%, ${T.royal} 62%, ${T.sky} 80%, ${T.ice} 100%)`,
        pointerEvents: "none",
        zIndex:        2,
      }} />

      {/* ══ LEFT: Trigger + Breadcrumb ══ */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: "10px", minWidth: 0, flex: 1, overflow: "hidden",
      }}>
        {/* Sidebar toggle */}
        <SidebarTrigger style={{
          flexShrink: 0,
          width: "34px", height: "34px",
          borderRadius: "9px",
          border: `1px solid ${T.ice}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: T.muted, background: "transparent",
          transition: "background 0.15s, border-color 0.15s, color 0.15s",
        }} />

        {/* Divider */}
        {!isSmall && (
          <div style={{ width: "1px", height: "20px", background: T.ice, flexShrink: 0 }} />
        )}

        {/* Breadcrumb */}
        <Breadcrumb style={{ minWidth: 0 }}>
          <BreadcrumbList style={{ gap: "4px", flexWrap: "nowrap", margin: 0, padding: 0 }}>
            {!isMobile && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="/dashboard/overview"
                    style={{
                      fontSize: "0.74rem", fontWeight: 500,
                      color: T.faint, textDecoration: "none",
                      whiteSpace: "nowrap", transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.royal)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = T.faint)}
                  >
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator style={{ color: T.faint }} />
              </>
            )}

            <BreadcrumbItem style={{ minWidth: 0 }}>
              <BreadcrumbLink
                href={pathname}
                style={{
                  fontSize: "0.75rem", fontWeight: 700,
                  color: T.royal, textDecoration: "none",
                  letterSpacing: "-0.02em",
                  padding: "3px 10px", borderRadius: "7px",
                  background: T.royalXs,
                  border: `1px solid ${T.borderRoyal}`,
                  whiteSpace: "nowrap", overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: isSmall ? "110px" : isMobile ? "160px" : "none",
                  display: "block",
                }}
              >
                {currentPageName}
              </BreadcrumbLink>
            </BreadcrumbItem>

            {!isMobile && pathname.startsWith("/dashboard/ads-manager") && activeAdsTab && (
              <>
                <BreadcrumbSeparator style={{ color: T.faint }} />
                <BreadcrumbItem>
                  <BreadcrumbPage style={{
                    fontSize: "0.73rem", fontWeight: 600, color: T.sky,
                  }}>
                    {activeAdsTab.charAt(0).toUpperCase() + activeAdsTab.slice(1)}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* ── Mobile backdrop — closes any open dropdown on tap ── */}
      {isMobile && (showNotif || showUserMenu) && (
        <div
          onClick={() => { setShowNotif(false); setShowUserMenu(false); }}
          style={{
            position: "fixed", inset: 0,
            zIndex: 290,
            background: "rgba(13,27,62,0.18)",
            backdropFilter: "blur(1px)",
          }}
        />
      )}

      {/* ══ RIGHT: Bell + User ══ */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: isSmall ? "4px" : isMobile ? "6px" : "8px", flexShrink: 0,
      }}>

        {/* ── Notification Bell ── */}
        <div data-notif-dropdown style={{ position: "relative" }}>
          <button
            onClick={() => { setShowNotif((p) => !p); setShowUserMenu(false); }}
            aria-label="Notifications"
            aria-expanded={showNotif}
            style={{
              position: "relative", display: "flex",
              alignItems: "center", justifyContent: "center",
              width: "36px", height: "36px", borderRadius: "10px",
              border: `1px solid ${showNotif ? T.borderRoyal : T.ice}`,
              background: showNotif ? T.royalXs : "transparent",
              cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background  = T.royalXs;
              e.currentTarget.style.borderColor = T.borderRoyal;
              e.currentTarget.querySelector("svg").style.color = T.royal;
            }}
            onMouseLeave={(e) => {
              if (!showNotif) {
                e.currentTarget.style.background  = "transparent";
                e.currentTarget.style.borderColor = T.ice;
                e.currentTarget.querySelector("svg").style.color = T.muted;
              }
            }}
          >
            <Bell style={{
              width: "15px", height: "15px",
              color: showNotif ? T.royal : T.muted,
              transition: "color 0.15s",
            }} />
            {/* Amber dot */}
            <span style={{
              position: "absolute", top: "7px", right: "7px",
              width: "7px", height: "7px", borderRadius: "50%",
              background: T.amber, border: `2px solid ${T.white}`,
              pointerEvents: "none",
            }} />
          </button>

          {showNotif && (
            <NotifDropdown onClose={() => setShowNotif(false)} isMobile={isMobile} isSmall={isSmall} />
          )}
        </div>

        {/* Divider */}
        {!isMobile && (
          <div style={{ width: "1px", height: "20px", background: T.ice, flexShrink: 0 }} />
        )}

        {/* ── User Menu ── */}
        <div data-user-dropdown-wrap style={{ position: "relative" }}>
          <button
            onClick={() => { setShowUserMenu((p) => !p); setShowNotif(false); }}
            style={{
              display: "flex", alignItems: "center",
              gap: "9px",
              padding: isSmall ? "4px" : isMobile ? "4px 6px 4px 4px" : "5px 10px 5px 5px",
              borderRadius: "11px",
              border: `1px solid ${showUserMenu ? T.borderRoyal : T.ice}`,
              background: showUserMenu ? T.royalXs : "transparent",
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background  = T.royalXs;
              e.currentTarget.style.borderColor = T.borderRoyal;
            }}
            onMouseLeave={(e) => {
              if (!showUserMenu) {
                e.currentTarget.style.background  = "transparent";
                e.currentTarget.style.borderColor = T.ice;
              }
            }}
          >
            {/* Avatar */}
            <div style={{
              width: "28px", height: "28px", borderRadius: "8px",
              overflow: "hidden", flexShrink: 0,
              border: `1.5px solid ${T.borderRoyal}`,
              background: T.royalXs,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {userData?.avatar ? (
                <img src={userData.avatar} alt={userData.name || "User"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: T.royal }}>
                  {isLoadingUser ? "…" : getInitials(userData?.name)}
                </span>
              )}
            </div>

            {/* Name + email — desktop only */}
            {!isMobile && !isSmall && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{
                  fontSize: "0.74rem", fontWeight: 700, color: T.text,
                  letterSpacing: "-0.02em", whiteSpace: "nowrap",
                  maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis",
                  lineHeight: 1.25,
                }}>
                  {isLoadingUser ? "Loading…" : (userData?.name || "User")}
                </span>
                <span style={{
                  fontSize: "0.59rem", color: T.faint, fontWeight: 500,
                  whiteSpace: "nowrap", maxWidth: "120px",
                  overflow: "hidden", textOverflow: "ellipsis",
                  lineHeight: 1.25,
                }}>
                  {userData?.email}
                </span>
              </div>
            )}

            {/* Chevron */}
            {!isMobile && !isSmall && (
              <ChevronDown style={{
                width: "12px", height: "12px", color: T.faint, flexShrink: 0,
                transform: showUserMenu ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }} />
            )}
          </button>

          {showUserMenu && (
            <UserDropdown
              userData={userData}
              onNavigate={handleNavClick}
              onLogout={handleLogout}
              onClose={() => setShowUserMenu(false)}
              isMobile={isMobile}
            />
          )}
        </div>
      </div>
    </header>
  );
}