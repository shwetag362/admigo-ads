
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../components/Sidebar";
import { AppHeader, HEADER_H } from "../components/Header";

// ─── Global CSS — Royal Blue + Pure White + Ice Accent ────────────────────────
const GLOBAL_CSS = `
  :root {
    --sidebar-width:      16rem;
    --sidebar-width-icon: 3rem;
  }

  /* ── Prevent sidebar root from adding top padding ─────────────────────── */
  [data-sidebar="sidebar"] {
    padding-top: 0 !important;
    margin-top:  0 !important;
  }

  /* ── Sidebar header — exact height match with AppHeader ───────────────── */
  [data-sidebar="header"] {
    height:         var(--dashboard-header-h, 64px) !important;
    min-height:     var(--dashboard-header-h, 64px) !important;
    max-height:     var(--dashboard-header-h, 64px) !important;
    padding-top:    0 !important;
    padding-bottom: 0 !important;
    box-sizing:     border-box !important;
    display:        flex !important;
    align-items:    center !important;
    flex-shrink:    0 !important;
    overflow:       hidden !important;
  }

  /* Reset ALL children inside the sidebar header */
  [data-sidebar="header"] ul,
  [data-sidebar="header"] li,
  [data-sidebar="header"] button {
    height:     auto !important;
    min-height: 0 !important;
    padding:    0 !important;
    margin:     0 !important;
  }

  /* ── Nav + footer menu buttons: no forced heights from shadcn ─────────── */
  [data-sidebar="content"] [data-sidebar="menu-button"],
  [data-sidebar="footer"]  [data-sidebar="menu-button"] {
    height:     auto !important;
    min-height: 0 !important;
  }

  /* ── SidebarInset — smooth slide transition, NEVER overflow ──────────── */
  [data-sidebar="inset"] {
    transition:  margin-left 0.2s ease !important;
    min-width:   0 !important;
    overflow-x:  hidden !important;
    width:       0 !important;        /* flex child: grow to fill remaining space */
    flex:        1 1 0% !important;   /* take all space sidebar doesn't use */
  }
  @media (max-width: 767px) {
    [data-sidebar="inset"] {
      margin-left: 0 !important;
    }
  }

  /* ── SidebarTrigger — Royal Blue theme ───────────────────────────────── */
  [data-sidebar="trigger"] {
    width:           34px !important;
    height:          34px !important;
    min-width:       34px !important;
    border-radius:   9px  !important;
    border:          1px solid rgba(43,92,230,0.10) !important;
    color:           #4B6880 !important;
    background:      transparent !important;
    transition:      background 0.15s, border-color 0.15s, color 0.15s !important;
    display:         flex !important;
    align-items:     center !important;
    justify-content: center !important;
    padding:         0 !important;
    flex-shrink:     0 !important;
    cursor:          pointer !important;
  }
  [data-sidebar="trigger"]:hover {
    background:   rgba(43,92,230,0.06) !important;
    border-color: rgba(43,92,230,0.22) !important;
    color:        #2B5CE6 !important;
  }
  [data-sidebar="trigger"] svg {
    width:  15px !important;
    height: 15px !important;
  }

  /* ── Notification dropdown animation ─────────────────────────────────── */
  @keyframes notifDrop {
    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }

  /* ── Notification list item hover ────────────────────────────────────── */
  .notif-item:hover {
    background: rgba(43,92,230,0.06) !important;
  }

  /* ── Scrollbar styling — subtle royal blue tint ──────────────────────── */
  [data-sidebar="content"]::-webkit-scrollbar {
    width: 4px;
  }
  [data-sidebar="content"]::-webkit-scrollbar-track {
    background: transparent;
  }
  [data-sidebar="content"]::-webkit-scrollbar-thumb {
    background: rgba(43,92,230,0.18);
    border-radius: 4px;
  }
  [data-sidebar="content"]::-webkit-scrollbar-thumb:hover {
    background: rgba(43,92,230,0.30);
  }
`;

function GlobalStyles() {
  useEffect(() => {
    const id = "dashboard-layout-styles";
    if (document.getElementById(id)) return;

    // Set CSS variable for sidebar header height sync
    document.documentElement.style.setProperty("--dashboard-header-h", `${HEADER_H}px`);

    const el = document.createElement("style");
    el.id = id;
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => document.getElementById(id)?.remove();
  }, []);
  return null;
}

export default function DashboardLayout({ children }) {
  const router = useRouter();

  const [userData,      setUserData]      = useState({ name: "", email: "", avatar: null });
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/me");
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUserData({
              name:   data.user.name      || "User",
              email:  data.user.email     || "",
              avatar: data.user.avatarUrl || null,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      } finally {
        if (!cancelled) setIsLoadingUser(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) router.push("/login");
      else alert("Logout failed");
    } catch {
      alert("Something went wrong");
    }
  }, [router]);

  return (
    <SidebarProvider>
      <GlobalStyles />

      <AppSidebar
        userData={userData}
        isLoadingUser={isLoadingUser}
        onLogout={handleLogout}
      />

      <AppHeader
        userData={userData}
        isLoadingUser={isLoadingUser}
      />

      {/*
        KEY FIX:
        - SidebarInset is a flex child inside SidebarProvider (which is display:flex)
        - minWidth:0 + overflow:hidden prevent it from ever growing past its flex allocation
        - width:100% fills the remaining space after sidebar
        - Children should use w-full, NOT w-screen (w-screen = 100vw = ignores sidebar)
      */}
      <SidebarInset style={{ minWidth: 0, overflow: "hidden", width: "100%" }}>
        <div style={{
          paddingTop:    `${HEADER_H}px`,
          minHeight:     "100vh",
          display:       "flex",
          flexDirection: "column",
          background:    "#F5F9FF",
          boxSizing:     "border-box",
          width:         "100%",
          maxWidth:      "100%",
          overflow:      "hidden",
        }}>
          <main style={{
            flex:          1,
            display:       "flex",
            flexDirection: "column",
            width:         "100%",
            maxWidth:      "100%",
            minWidth:      0,        /* critical: allows flex child to shrink below content size */
            overflow:      "hidden",
          }}>
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}