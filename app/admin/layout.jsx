// "use client";

// import { useState, useEffect } from "react";
// import { usePathname } from "next/navigation";
// import { AppSidebar } from "../components/Sidebar";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // ✅ Import Avatar component
// import {
//   Breadcrumb,
//   BreadcrumbItem,
//   BreadcrumbLink,
//   BreadcrumbList,
//   BreadcrumbPage,
//   BreadcrumbSeparator,
// } from "@/components/ui/breadcrumb";
// import { Separator } from "@/components/ui/separator";
// import {
//   SidebarInset,
//   SidebarProvider,
//   SidebarTrigger,
// } from "@/components/ui/sidebar";
// import { Bell } from "lucide-react";

// // ========================================
// // ROUTE NAME MAPPING
// // ========================================
// const routeNameMap = {
//   "/dashboard/overview": "Overview",
//   "/dashboard/ads-manager": "Ads Manager",
//   "/dashboard/ads-manager/create-ads-manager": "Create Ads Manager",
//   "/dashboard/ads-reporting": "Ads Reporting",
//   "/dashboard/datasource-manager": "Datasource Manager",
//   "/dashboard/user-center": "User Center",
//   "/dashboard/account-manager": "Account Manager",
// };

// // ✅ Helper function for initials (same as sidebar)
// const getInitials = (name) => {
//   if (!name) return "U";
//   return name
//     .split(" ")
//     .map((word) => word.charAt(0))
//     .join("")
//     .toUpperCase()
//     .slice(0, 2);
// };

// // ========================================
// // MAIN PAGE COMPONENT
// // ========================================
// export default function Page({ children }) {
//   const pathname = usePathname();
//   const currentPageName = routeNameMap[pathname] || "Overview";

//   // ========================================
//   // STATE MANAGEMENT
//   // ========================================
//   const [showDropdown, setShowDropdown] = useState(false);
//   const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
//   const [activeAdsTab, setActiveAdsTab] = useState(
//     pathname === "/dashboard/ads-manager" ? "campaigns" : ""
//   );

//   // User data state
//   const [userData, setUserData] = useState({
//     name: "",
//     email: "",
//     avatar: null,
//     firstName: "",
//     lastName: "",
//   });
//   const [isLoadingUser, setIsLoadingUser] = useState(true);

//   // ========================================
//   // HANDLERS
//   // ========================================
//   const toggleDropdown = () => setShowDropdown((prev) => !prev);

//   // ========================================
//   // FETCH USER DATA
//   // ========================================
//   useEffect(() => {
//     const fetchUserData = async () => {
//       try {
//         setIsLoadingUser(true);
//         const response = await fetch('/api/user/me');
        
//         if (response.ok) {
//           const data = await response.json();
          
//           if (data.success && data.user) {
//             // Split name into first and last name
//             const nameParts = (data.user.name || "").split(" ");
//             const firstName = nameParts[0] || "";
//             const lastName = nameParts.slice(1).join(" ") || "";

//             setUserData({
//               name: data.user.name || "User",
//               email: data.user.email || "",
//               avatar: data.user.avatarUrl || null,
//               firstName: firstName,
//               lastName: lastName,
//             });
//             console.log('✅ User data loaded in header:', data.user.email);
//           }
//         } else {
//           console.error('❌ Failed to fetch user data');
//         }
//       } catch (error) {
//         console.error('❌ Error fetching user:', error);
//       } finally {
//         setIsLoadingUser(false);
//       }
//     };

//     fetchUserData();
//   }, []);

//   // ========================================
//   // LISTEN FOR ADS MANAGER TAB CHANGE
//   // ========================================
//   useEffect(() => {
//     const handleTabChange = (e) => setActiveAdsTab(e.detail);
//     window.addEventListener("adsManagerTabChange", handleTabChange);
//     return () =>
//       window.removeEventListener("adsManagerTabChange", handleTabChange);
//   }, []);

//   // ========================================
//   // RENDER
//   // ========================================
//   return (
//     <SidebarProvider>
//       <AppSidebar onCollapseChange={setIsSidebarCollapsed} />

//       <SidebarInset>
//         {/* ========================================
//             HEADER
//             ======================================== */}
//         <header
//           className={`fixed top-0 z-50 right-0 bg-white/80 backdrop-blur-md border-b shadow-sm flex h-16 shrink-0 items-center justify-between gap-2 px-4 transition-all duration-300
//           ${isSidebarCollapsed ? "left-0 md:left-12" : "left-0 md:left-62"}`}
//         >
//           {/* ========================================
//               LEFT SIDE - BREADCRUMB
//               ======================================== */}
//           <div className="flex items-center gap-2">
//             <SidebarTrigger
//               className="-ml-1"
//               onClick={() => setIsSidebarCollapsed((prev) => !prev)}
//             />
//             <Separator
//               orientation="vertical"
//               className="mr-2 data-[orientation=vertical]:h-4"
//             />

//             <Breadcrumb>
//               <BreadcrumbList>
//                 <BreadcrumbItem className="hidden md:block">
//                   <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
//                 </BreadcrumbItem>
//                 <BreadcrumbSeparator className="hidden md:block" />
//                 <BreadcrumbItem>
//                   <BreadcrumbLink href={pathname}>
//                     {currentPageName}
//                   </BreadcrumbLink>
//                 </BreadcrumbItem>

//                 {/* Sub-tab for Ads Manager */}
//                 {pathname === "/dashboard/ads-manager" && activeAdsTab && (
//                   <>
//                     <BreadcrumbSeparator />
//                     <BreadcrumbItem>
//                       <BreadcrumbPage>
//                         {activeAdsTab.charAt(0).toUpperCase() +
//                           activeAdsTab.slice(1)}
//                       </BreadcrumbPage>
//                     </BreadcrumbItem>
//                   </>
//                 )}
//               </BreadcrumbList>
//             </Breadcrumb>
//           </div>

//           {/* ========================================
//               RIGHT SIDE - NOTIFICATIONS & USER
//               ======================================== */}
//           <div className="flex items-center gap-4 relative">
//             {/* ========================================
//                 NOTIFICATION BELL
//                 ======================================== */}
//             <div className="relative">
//               <button
//                 onClick={toggleDropdown}
//                 className="relative flex items-center justify-center cursor-pointer p-3 rounded-full hover:bg-gray-100 transition"
//                 aria-label="Notifications"
//               >
//                 <Bell className="h-5 w-5 text-gray-700" />
//                 <span className="absolute top-2 right-3 h-2 w-2 rounded-full bg-red-500"></span>
//               </button>

//               {/* Notification Dropdown */}
//               {showDropdown && (
//                 <div className="absolute right-0 mt-2 w-64 bg-white shadow-lg rounded-lg p-3 z-50 border border-gray-200">
//                   <p className="text-sm text-gray-600 font-semibold mb-2">
//                     Notifications
//                   </p>
//                   <ul className="text-sm text-gray-700 space-y-1">
//                     <li className="p-2 rounded-md hover:bg-gray-50 cursor-pointer transition">
//                       🔔 New Instagram comment received
//                     </li>
//                     <li className="p-2 rounded-md hover:bg-gray-50 cursor-pointer transition">
//                       ✅ Campaign successfully published
//                     </li>
//                     <li className="p-2 rounded-md hover:bg-gray-50 cursor-pointer transition">
//                       💬 5 unread messages
//                     </li>
//                   </ul>
//                 </div>
//               )}
//             </div>

//             {/* ========================================
//                 USER PROFILE SECTION - USING AVATAR COMPONENT
//                 ======================================== */}
//             <div className="flex items-center gap-3">
//               {/* ✅ Use Avatar component (same as sidebar) */}
//               <Avatar className="h-9 w-9 rounded-full border-2 border-gray-200">
//                 <AvatarImage 
//                   src={userData.avatar} 
//                   alt={userData.name || "User Avatar"} 
//                 />
//                 <AvatarFallback className="bg-indigo-100 text-indigo-600 text-sm font-semibold">
//                   {isLoadingUser ? "..." : getInitials(userData.name)}
//                 </AvatarFallback>
//               </Avatar>

//               {/* User Name */}
//               <span className="font-semibold text-gray-800 text-sm hidden sm:block">
//                 {isLoadingUser ? "Loading..." : userData.name}
//               </span>
//             </div>
//           </div>
//         </header>

//         {/* ========================================
//             MAIN CONTENT AREA
//             ======================================== */}
//         <div className="flex flex-1 flex-col gap-4 bg-gradient-to-b from-white to-gray-50 pt-12">
//           {children}
//         </div>
//       </SidebarInset>
//     </SidebarProvider>
//   );
// }


"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../components/adminSidebar";

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