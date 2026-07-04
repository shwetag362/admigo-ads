"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ClipboardList, Monitor, BarChart3, UserCog, Database,
  LogOut, ChevronsUpDown, House, Settings, ChevronRight, UserPlus,
  TrendingUp, FileText, PieChart, Users, Building2, Bell,
  Shield, Layers, Globe, Zap, LayoutDashboard, DatabaseZap,
  Crosshair, RefreshCw, AlignJustify, ArrowLeftRight,MonitorPlay,
} from "lucide-react";
import { FaAd } from "react-icons/fa";

import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import Image from "next/image";

const BRAND = {
  name:    process.env.NEXT_PUBLIC_BRAND_NAME    || "Admigo.net",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || "Automate. Optimize. Scale.",
  logo:    "/admigo.png",
};

// ─── Theme tokens — Royal Blue + Pure White + Ice Accent ─────────────────────
const T = {
  royal:       "#2B5CE6",
  royalD:      "#1A3BAF",
  royalL:      "#4A6FFF",
  royalXs:     "rgba(43,92,230,0.06)",
  royalS:      "rgba(43,92,230,0.13)",
  royalM:      "rgba(43,92,230,0.20)",
  borderRoyal: "rgba(43,92,230,0.22)",
  ice:         "#D0E4F7",
  sky:         "#4A90D9",
  deepD:       "#0D1B3E",
  bg:          "#F5F9FF",
  white:       "#FFFFFF",
  text:        "#0D1B3E",
  text2:       "#1A3BAF",
  muted:       "#4B6880",
  faint:       "#8AAFC8",
  border:      "rgba(43,92,230,0.10)",
  border2:     "rgba(43,92,230,0.18)",
};

export const SIDEBAR_HEADER_H = 64;

const NAV_ITEMS = [
  { name: "Overview", url: "/dashboard/overview", icon: House },
  {
    name: "Ads Manager", url: "/dashboard/ads-manager", icon: FaAd,
    children: [
      { name: "All Campaigns", url: "/dashboard/ads-manager",  icon: Layers },
      { name: "Facebook Pages",     url: "/dashboard/facebook-pages",     icon: Zap },
      { name: "Creative Media",     url: "/dashboard/creative-media",     icon: MonitorPlay },
    ],
  },
  {
    name: "Ads Reporting", url: "/dashboard/ads-reporting", icon: BarChart3,
    children: [
      { name: "Performance",    url: "/dashboard/ads-reporting/performance", icon: TrendingUp },
      { name: "Analytics",      url: "/dashboard/ads-reporting/analytics",   icon: PieChart },
    ],
  },
  {
    name: "Events Manager", url: "/dashboard/events-manager", icon: Database,
    children: [
      { name: "Overview",        url: "/dashboard/events-manager/overview",        icon: LayoutDashboard },
      { name: "Data Sources",    url: "/dashboard/events-manager/datasources",     icon: DatabaseZap },
      { name: "Pixel Setup",     url: "/dashboard/events-manager/pixels",          icon: Crosshair },
      { name: "Conversions API", url: "/dashboard/events-manager/conversions-api", icon: RefreshCw },
    ],
  },
  { name: "Orders Manager", url: "/dashboard/orders-manager", icon: ClipboardList },
  { name: "Ad Monitor",     url: "/dashboard/ad-monitor",     icon: Monitor },
  {
    name: "Account Manager", url: "/dashboard/account-manager", icon: UserCog,
    children: [
      { name: "Ad Accounts",   url: "/dashboard/account-manager/ad-accounts",  icon: FaAd },
    ],
  },
    {
    name: "Team", url: "/dashboard/team", icon: Users,
    children: [
      { name: "Members",    url: "/dashboard/team",         icon: Users },
      { name: "Invites",    url: "/dashboard/team/invites", icon: UserPlus },
    ],
  },
  {
    name: "Settings", url: "/dashboard/accounts", icon: Settings,
    children: [
      { name: "Connect Facebook", url: "/dashboard/settings/add-f-accounts", icon: ArrowLeftRight },
    ],
  },
];

const NAV_SECTIONS = [
  { label: "Main",        items: NAV_ITEMS.slice(0, 1) },
  { label: "Advertising", items: NAV_ITEMS.slice(1, 4) },
  { label: "Operations",  items: NAV_ITEMS.slice(4, 6) },
  { label: "Management",  items: NAV_ITEMS.slice(6)    },
];

const getInitials = (name) => {
  if (!name) return "U";
  return name.split(" ").map((w) => w.charAt(0)).join("").toUpperCase().slice(0, 2);
};

const isItemActive = (item, pathname) => {
  if (pathname === item.url) return true;
  if (pathname.startsWith(item.url + "/")) return true;
  return item.children?.some(
    (c) => pathname === c.url || pathname.startsWith(c.url + "/")
  ) ?? false;
};

const shouldBeOpen = (item, pathname) => {
  if (!item.children?.length) return false;
  if (pathname === item.url || pathname.startsWith(item.url + "/")) return true;
  return item.children.some(
    (c) => pathname === c.url || pathname.startsWith(c.url + "/")
  );
};

// ─── BrandLogo ────────────────────────────────────────────────────────────────
const BrandLogo = React.memo(({ isCollapsed }) => (
  <div style={{
    display:        "flex",
    alignItems:     "center",
    justifyContent: isCollapsed ? "center" : "flex-start",
    gap:            isCollapsed ? 0 : "10px",
    width:          "100%",
    minWidth:       0,
  }}>
    <div style={{
      flexShrink:     0,
      width:          "34px",
      height:         "34px",
      borderRadius:   "9px",
      overflow:       "hidden",
      background:     T.white,
      border:         `1.5px solid ${T.ice}`,
      boxShadow:      "0 1px 6px rgba(13,27,62,0.10)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
    }}>
      <Image
        src={BRAND.logo} alt={BRAND.name}
        width={34} height={34}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        priority
      />
    </div>

    {!isCollapsed && (
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <p style={{
          fontSize: "0.84rem", fontWeight: 800, color: T.text,
          letterSpacing: "-0.03em", margin: 0, lineHeight: 1.2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {BRAND.name}
        </p>
        <p style={{
          fontSize: "0.58rem", color: T.faint, fontWeight: 500,
          letterSpacing: "0.02em", margin: "2px 0 0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {BRAND.tagline}
        </p>
      </div>
    )}
  </div>
));
BrandLogo.displayName = "BrandLogo";

// ─── SectionLabel ─────────────────────────────────────────────────────────────
const SectionLabel = React.memo(({ label, isCollapsed }) => {
  if (isCollapsed) return <div style={{ height: "1px", background: T.ice, margin: "8px 6px" }} />;
  return (
    <div style={{ padding: "12px 12px 4px", display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{
        fontSize: "0.54rem", fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: T.faint, whiteSpace: "nowrap",
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: "1px", background: T.ice }} />
    </div>
  );
});
SectionLabel.displayName = "SectionLabel";

// ─── SubNavItem ───────────────────────────────────────────────────────────────
const SubNavItem = React.memo(({ item, isActive, onClick }) => (
  <li style={{ listStyle: "none" }}>
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "9px",  justifyContent: "flex-start", // 👈 ADD THIS
  textAlign: "left", 
        paddingLeft: "14px", paddingRight: "10px",
        paddingTop: "7px", paddingBottom: "7px",
        borderRadius: "8px", fontSize: "0.74rem",
        fontWeight: isActive ? 600 : 500, border: "none", cursor: "pointer",
        transition: "background 0.15s, color 0.15s", fontFamily: "inherit",
        background: isActive ? T.royalS : "transparent",
        color:      isActive ? T.royal  : T.muted,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = T.royalXs;
          e.currentTarget.style.color = T.text;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = T.muted;
        }
      }}
    >
      <item.icon style={{
        width: "13px", height: "13px", flexShrink: 0,
        color: isActive ? T.royal : T.faint,
      }} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.name}
      </span>
      {isActive && (
        <span style={{
          width: "5px", height: "5px", borderRadius: "50%",
          background: T.royal, flexShrink: 0,
        }} />
      )}
    </button>
  </li>
));
SubNavItem.displayName = "SubNavItem";

// ─── NavItem ──────────────────────────────────────────────────────────────────
const NavItem = React.memo(({ item, pathname, onNavigate, isCollapsed, openKey, setOpenKey }) => {
  const hasChildren = Boolean(item.children?.length);
  const active      = isItemActive(item, pathname);

  // Exclusive accordion: this item is open only if openKey matches its url
  const isOpen = openKey === item.url;

  // On mount / pathname change: auto-open if this item should be open
  React.useEffect(() => {
    if (shouldBeOpen(item, pathname)) {
      setOpenKey(item.url);
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = React.useCallback(() => {
    if (hasChildren) {
      if (isCollapsed) {
        onNavigate(item.url);
      } else {
        // Toggle: open this, close others; if already open → close
        setOpenKey((prev) => (prev === item.url ? null : item.url));
      }
    } else {
      onNavigate(item.url);
    }
  }, [hasChildren, isCollapsed, onNavigate, item.url, setOpenKey]);

  const childHandlers = React.useMemo(
    () => item.children?.map((child) => () => onNavigate(child.url)) ?? [],
    [item.children, onNavigate]
  );

  const maxHeight = (item.children?.length ?? 0) * 34 + 6;

  return (
    <SidebarMenuItem style={{ listStyle: "none" }}>
      <SidebarMenuButton
        onClick={handleClick}
        title={isCollapsed ? item.name : undefined}
        style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: isCollapsed ? "9px" : "8px 11px",
          justifyContent: isCollapsed ? "center" : "flex-start",
          borderRadius: "10px", fontSize: "0.81rem", fontWeight: 600,
          border: "none",
          cursor: "pointer",
          width: "100%",
          height: "auto", minHeight: "unset",
          transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
          fontFamily: "inherit",
          ...(
            active
              ? {
                  background: `linear-gradient(135deg, ${T.royal} 0%, ${T.royalD} 100%)`,
                  color: "#fff",
                  boxShadow: `0 2px 10px rgba(43,92,230,0.28)`,
                }
              : { background: "transparent", color: T.muted }
          ),
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = T.royalXs;
            e.currentTarget.style.color = T.text;
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color      = T.muted;
          }
        }}
      >
        <item.icon style={{
          width: "16px", height: "16px", flexShrink: 0,
          color: active ? "#fff" : T.muted,
        }} />
        {!isCollapsed && (
          <>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.name}
            </span>
            {hasChildren && (
              <ChevronRight style={{
                width: "12px", height: "12px", flexShrink: 0,
                color: active ? "rgba(255,255,255,0.7)" : T.faint,
                transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }} />
            )}
          </>
        )}
      </SidebarMenuButton>

      {/* Children accordion */}
      {hasChildren && !isCollapsed && (
        <div style={{
          overflow: "hidden",
          maxHeight: isOpen ? `${maxHeight}px` : "0px",
          transition: "max-height 0.22s cubic-bezier(.16,1,.3,1)",
        }}>
          <ul style={{
            margin: "2px 0 2px 14px",
            padding: "3px 0 3px 10px",
            borderLeft: `2px solid ${T.borderRoyal}`,
            display: "flex", flexDirection: "column", gap: "1px",
            listStyle: "none",
          }}>
            {item.children.map((child, ci) => {
              const childActive = pathname === child.url || pathname.startsWith(child.url + "/");
              return (
                <SubNavItem
                  key={child.url}
                  item={child}
                  isActive={childActive}
                  onClick={childHandlers[ci]}
                />
              );
            })}
          </ul>
        </div>
      )}
    </SidebarMenuItem>
  );
});
NavItem.displayName = "NavItem";

// ─── AppSidebar ───────────────────────────────────────────────────────────────
export function AppSidebar({ userData, isLoadingUser, onLogout }) {
  const [isMobile,      setIsMobile]      = React.useState(false);
  const [userMenuHover, setUserMenuHover] = React.useState(false);

  // ── Exclusive accordion state: only one item open at a time ──
  const [openKey, setOpenKey] = React.useState(null);

  const router   = useRouter();
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const check = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", check);
    return () => mql.removeEventListener("change", check);
  }, []);

  const handleNavClick = React.useCallback((url) => router.push(url), [router]);

  return (
    <Sidebar
      collapsible="icon"
      style={{
        background:   T.white,
        borderRight:  `1px solid ${T.ice}`,
      }}
    >
      {/* ── HEADER ── */}
      <div
        data-sidebar="header"
        style={{
          height:         `${SIDEBAR_HEADER_H}px`,
          minHeight:      `${SIDEBAR_HEADER_H}px`,
          maxHeight:      `${SIDEBAR_HEADER_H}px`,
          boxSizing:      "border-box",
          flexShrink:     0,
          display:        "flex",
          alignItems:     "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          paddingLeft:    isCollapsed ? "0" : "14px",
          paddingRight:   isCollapsed ? "0" : "14px",
          borderBottom:   `1px solid ${T.ice}`,
          position:       "relative",
          background:     T.white,
          overflow:       "hidden",
        }}
      >
        {/* Gradient accent bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "3px",
          background: `linear-gradient(90deg, ${T.ice}, ${T.sky}, ${T.royalD})`,
          pointerEvents: "none", zIndex: 1,
        }} />
        <div style={{ position: "relative", zIndex: 2, width: "100%", minWidth: 0 }}>
          <BrandLogo isCollapsed={isCollapsed} />
        </div>
      </div>

      {/* ── NAV ── */}
      <SidebarContent
        style={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          background: T.bg,
        }}
      >
        <div style={{
          position: "sticky", top: 0, zIndex: 1, height: "8px",
          background: `linear-gradient(to bottom, ${T.bg}, transparent)`,
          pointerEvents: "none",
        }} />
        <SidebarMenu style={{
          padding: isCollapsed ? "0 6px 12px" : "0 8px 12px",
          display: "flex", flexDirection: "column", gap: 0,
          listStyle: "none", margin: 0,
        }}>
          {NAV_SECTIONS.map((section) => (
            <React.Fragment key={section.label}>
              <SectionLabel label={section.label} isCollapsed={isCollapsed} />
              {/* gap: "2px" between items, marginBottom: "4px" after each section's items */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "4px" }}>
                {section.items.map((item) => (
                  <NavItem
                    key={item.url}
                    item={item}
                    pathname={pathname}
                    onNavigate={handleNavClick}
                    isCollapsed={isCollapsed}
                    openKey={openKey}
                    setOpenKey={setOpenKey}
                  />
                ))}
              </div>
            </React.Fragment>
          ))}
        </SidebarMenu>
        <div style={{
          position: "sticky", bottom: 0, height: "8px",
          background: `linear-gradient(to top, ${T.bg}, transparent)`,
          pointerEvents: "none",
        }} />
      </SidebarContent>

      {/* ── FOOTER ── */}
      <SidebarFooter
        style={{
          borderTop: `1px solid ${T.ice}`,
          padding: "8px",
          background: T.white,
        }}
      >
        <SidebarMenu style={{ listStyle: "none", margin: 0, padding: 0 }}>
          <SidebarMenuItem style={{ listStyle: "none" }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  onMouseEnter={() => setUserMenuHover(true)}
                  onMouseLeave={() => setUserMenuHover(false)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    gap: isCollapsed ? 0 : "9px",
                    padding: isCollapsed ? "7px" : "7px 9px",
                    justifyContent: isCollapsed ? "center" : "flex-start",
                    borderRadius: "10px", border: "none", cursor: "pointer",
                    background: userMenuHover ? T.royalXs : "transparent",
                    transition: "background 0.15s", height: "auto", minHeight: "unset",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "8px",
                    overflow: "hidden", flexShrink: 0,
                    border: `1.5px solid ${T.borderRoyal}`,
                    background: T.royalXs,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {userData?.avatar
                      ? <img src={userData.avatar} alt={userData.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: "0.63rem", fontWeight: 700, color: T.royal, fontFamily: "inherit" }}>
                          {getInitials(userData?.name)}
                        </span>
                    }
                  </div>
                  {!isCollapsed && (
                    <>
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <p style={{
                          fontSize: "0.73rem", fontWeight: 700, color: T.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          margin: 0, lineHeight: 1.3,
                        }}>
                          {isLoadingUser ? "Loading..." : userData?.name}
                        </p>
                        <p style={{
                          fontSize: "0.6rem", color: T.faint,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          margin: 0, lineHeight: 1.3,
                        }}>
                          {userData?.email}
                        </p>
                      </div>
                      <ChevronsUpDown style={{ width: "12px", height: "12px", color: T.faint, flexShrink: 0 }} />
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={8}
                style={{
                  width: "220px", borderRadius: "14px",
                  border: `1px solid ${T.ice}`,
                  boxShadow: "0 8px 28px rgba(13,27,62,0.13)",
                  background: T.white, overflow: "hidden",
                }}
              >
                {/* Gradient accent */}
                <div style={{
                  height: "3px",
                  background: `linear-gradient(90deg, ${T.ice}, ${T.sky}, ${T.royalD})`,
                }} />

                <DropdownMenuLabel style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "34px", height: "34px", borderRadius: "9px",
                      overflow: "hidden", flexShrink: 0,
                      border: `1.5px solid ${T.borderRoyal}`,
                      background: T.royalXs,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {userData?.avatar
                        ? <img src={userData.avatar} alt={userData.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: "0.7rem", fontWeight: 700, color: T.royal }}>
                            {getInitials(userData?.name)}
                          </span>
                      }
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "0.8rem", fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.3 }}>
                        {userData?.name}
                      </p>
                      <p style={{
                        fontSize: "0.66rem", color: T.faint, margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap", maxWidth: "140px",
                      }}>
                        {userData?.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator style={{ background: T.ice, margin: "0 8px" }} />

                <div style={{ padding: "4px 6px" }}>
                  <DropdownMenuItem
                    onClick={() => handleNavClick("/dashboard/settings/general")}
                    style={{
                      cursor: "pointer", borderRadius: "8px",
                      padding: "8px 10px", fontSize: "0.77rem",
                      fontWeight: 500, color: T.muted,
                      display: "flex", alignItems: "center", gap: "8px",
                    }}
                  >
                    <Settings style={{ width: "13px", height: "13px", color: T.faint }} />
                    Account Settings
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator style={{ background: T.ice, margin: "0 8px" }} />

                <div style={{ padding: "4px 6px 8px" }}>
                  <DropdownMenuItem
                    onClick={onLogout}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,38,38,0.07)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    style={{
                      cursor: "pointer", borderRadius: "8px",
                      padding: "8px 10px", fontSize: "0.77rem",
                      fontWeight: 600, color: "#DC2626",
                      display: "flex", alignItems: "center", gap: "8px",
                      background: "transparent",
                    }}
                  >
                    <LogOut style={{ width: "13px", height: "13px" }} />
                    Log out
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}