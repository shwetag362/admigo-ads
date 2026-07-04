"use client";
import React, { useEffect, useState, useMemo } from "react";

// ─── Skeleton primitives ──────────────────────────────────────────────────────
const skBase = {
  borderRadius: 5,
  background: "linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)",
  backgroundSize: "200% 100%",
  animation: "am-shimmer 1.4s infinite",
  display: "block",
};
function Skel({ w = "100%", h = 12, mb = 0, radius = 5 }) {
  return <span style={{ ...skBase, width: w, height: h, marginBottom: mb, borderRadius: radius, flexShrink: 0 }} />;
}

const SKELETON_CSS = `
  @keyframes am-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

// ─── Top-bar skeleton ─────────────────────────────────────────────────────────
function TopBarSkeleton() {
  return (
    <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
      <style>{SKELETON_CSS}</style>
      <div className="max-w-7xl mx-auto p-4">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-200 rounded-lg flex-shrink-0" style={{ animation: "am-shimmer 1.4s infinite", background: "linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)", backgroundSize: "200% 100%" }} />
            <div>
              <Skel w={120} h={14} mb={5} />
              <Skel w={180} h={9} />
            </div>
          </div>
          <Skel w={80} h={30} radius={6} />
        </div>
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <Skel w="50%" h={20} mb={6} radius={4} />
              <Skel w="70%" h={8} radius={3} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Table skeleton (desktop) ─────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="grid px-3 py-2.5" style={{ gridTemplateColumns: "40px 1fr 144px 160px 96px 144px", gap: "0 12px" }}>
          {["w-6", "w-28", "w-24", "w-20", "w-12", "w-20"].map((w, i) => (
            <Skel key={i} w={w} h={9} radius={3} />
          ))}
        </div>
      </div>
      {/* Rows */}
      {[...Array(7)].map((_, i) => (
        <div key={i} className="border-b border-slate-100 px-3 py-3 grid items-center"
          style={{ gridTemplateColumns: "40px 1fr 144px 160px 96px 144px", gap: "0 12px" }}>
          <Skel w={20} h={10} radius={3} />
          {/* Name with avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Skel w={28} h={28} radius={8} />
            <Skel w={`${55 + (i % 3) * 15}%`} h={11} radius={4} />
          </div>
          <Skel w="80%" h={20} radius={4} />
          <Skel w={`${50 + (i % 4) * 12}%`} h={11} radius={4} />
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Skel w={36} h={18} radius={4} />
          </div>
          <div>
            <Skel w="70%" h={10} mb={4} radius={3} />
            <Skel w="45%" h={8} radius={3} />
          </div>
        </div>
      ))}
      {/* Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between">
        <Skel w={160} h={10} radius={3} />
        <div style={{ display: "flex", gap: 4 }}>
          {[...Array(5)].map((_, i) => <Skel key={i} w={24} h={24} radius={4} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Card skeleton (mobile) ───────────────────────────────────────────────────
function CardsSkeleton() {
  return (
    <div className="md:hidden space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <Skel w={36} h={36} radius={10} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Skel w={`${60 + (i % 3) * 12}%`} h={12} mb={5} radius={4} />
              <Skel w="45%" h={9} mb={8} radius={3} />
              <div style={{ display: "flex", gap: 6 }}>
                <Skel w={36} h={18} radius={4} />
                <Skel w={80} h={18} radius={4} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Full loading skeleton ────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <style>{SKELETON_CSS}</style>
      <TopBarSkeleton />
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3 sm:py-4">
        {/* Search + rows bar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Skel w={220} h={32} radius={6} />
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            <Skel w={28} h={10} radius={3} />
            {[...Array(4)].map((_, i) => <Skel key={i} w={28} h={28} radius={4} />)}
          </div>
        </div>
        <TableSkeleton />
        <CardsSkeleton />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AccountManager() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [expandedRow, setExpandedRow] = useState(null);

  async function fetchAccounts() {
    try {
      setLoading(true);
      const res = await fetch("/api/meta-accounts");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("Fetch accounts error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAccounts(); }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts.filter(a =>
      !q ||
      (a.name || "").toLowerCase().includes(q) ||
      (a.metaAccountId || "").toLowerCase().includes(q) ||
      (a.businessName || "").toLowerCase().includes(q) ||
      (a.currency || "").toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sortKey] ?? "", bv = b[sortKey] ?? "";
      if (sortKey === "createdAt") { av = new Date(av); bv = new Date(bv); }
      else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return (
      <svg className="w-3 h-3 text-slate-300 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
    return sortDir === "asc"
      ? <svg className="w-3 h-3 text-indigo-500 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
      : <svg className="w-3 h-3 text-indigo-500 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>;
  };

  const CurrencyBadge = ({ currency }) => {
    if (!currency) return <span className="text-slate-300 text-[10px]">—</span>;
    const colors = {
      USD: "bg-green-50 text-green-700 border-green-200",
      EUR: "bg-blue-50 text-blue-700 border-blue-200",
      GBP: "bg-purple-50 text-purple-700 border-purple-200",
      INR: "bg-orange-50 text-orange-700 border-orange-200",
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${colors[currency] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
        {currency}
      </span>
    );
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── TOP BAR ── */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto p-4">

          {/* Title + stats */}
          <div className="flex items-center justify-between gap-3 ">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Ad Accounts</h1>
                <p className="text-[10px] text-slate-500 hidden sm:block">All connected Meta ad accounts</p>
              </div>
            </div>

            <button onClick={fetchAccounts}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

       
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3 sm:py-4">

           {/* Stats strip */}
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 mb-4">
            {[
              { label: "Total Accounts", value: accounts.length,   color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
              { label: "Currencies",     value: [...new Set(accounts.map(a => a.currency).filter(Boolean))].length, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
              { label: "Showing",        value: filtered.length,    color: "text-slate-700",  bg: "bg-slate-50 border-slate-200" },
            ].map((s) => (
              <div key={s.label} className={`border rounded-lg px-3 py-2 ${s.bg}`}>
                <p className={`text-base sm:text-xl font-bold leading-tight ${s.color}`}>{s.value}</p>
                <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

        {/* Search + page size row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px] max-w-sm">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search accounts…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] text-slate-500">Rows:</span>
            {[5, 10, 20, 50].map(n => (
              <button key={n} onClick={() => { setPageSize(n); setPage(0); }}
                className={`px-2 py-1 text-[10px] font-semibold rounded border transition-colors ${pageSize === n ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* ── MOBILE CARDS (< md) ── */}
        <div className="md:hidden space-y-2">
          {paginated.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="text-xs font-semibold text-slate-700 mb-1">No accounts found</p>
              <p className="text-[10px] text-slate-400">{search ? `No results for "${search}"` : "No ad accounts connected yet"}</p>
            </div>
          ) : paginated.map((account, idx) => {
            const isExp = expandedRow === account.id || expandedRow === idx;
            return (
              <div key={account.id || idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold text-sm">
                      {(account.name || "A")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{account.name || "—"}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{account.metaAccountId || "—"}</p>
                        </div>
                        <button onClick={() => setExpandedRow(isExp ? null : (account.id || idx))}
                          className="text-slate-300 hover:text-slate-500 flex-shrink-0 ml-1 mt-0.5">
                          <svg className={`w-4 h-4 transition-transform ${isExp ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <CurrencyBadge currency={account.currency} />
                        {account.businessName && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-medium truncate max-w-[120px]">
                            {account.businessName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExp && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1.5">
                      {[
                        ["Meta Account ID", account.metaAccountId],
                        ["Business Name",   account.businessName],
                        ["Currency",        account.currency],
                        ["Created At",      account.createdAt ? new Date(account.createdAt).toLocaleString("en-IN") : null],
                      ].filter(([, v]) => v).map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-2 text-[10px]">
                          <span className="text-slate-400 font-medium">{label}</span>
                          <span className="text-slate-800 font-semibold text-right font-mono">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── DESKTOP TABLE (md+) ── */}
        <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    { key: null,            label: "#",              w: "w-10",   align: "text-center" },
                    { key: "name",          label: "Account Name",   w: "w-auto", align: "text-left"   },
                    { key: "metaAccountId", label: "Meta Account ID",w: "w-36",   align: "text-left"   },
                    { key: "businessName",  label: "Business Name",  w: "w-40",   align: "text-left"   },
                    { key: "currency",      label: "Currency",       w: "w-24",   align: "text-center" },
                    { key: "createdAt",     label: "Created At",     w: "w-36",   align: "text-left"   },
                  ].map(({ key, label, w, align }) => (
                    <th key={label}
                      onClick={() => key && handleSort(key)}
                      className={`px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${align} ${w} ${key ? "cursor-pointer hover:bg-slate-100 select-none" : ""} transition-colors`}>
                      <div className={`flex items-center gap-0.5 ${align === "text-center" ? "justify-center" : ""}`}>
                        <span>{label}</span>
                        {key && <SortIcon col={key} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mb-0.5">No accounts found</p>
                      <p className="text-[10px] text-slate-400">{search ? `No results for "${search}"` : "No ad accounts connected yet"}</p>
                    </td>
                  </tr>
                ) : paginated.map((account, idx) => (
                  <tr key={account.id || idx}
                    className="hover:bg-indigo-50/40 transition-colors group">
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[10px] font-mono text-slate-400">{page * pageSize + idx + 1}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold text-[10px]">
                          {(account.name || "A")[0].toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-900 truncate max-w-[180px]">
                          {account.name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                        {account.metaAccountId || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-600 truncate max-w-[150px] block">
                        {account.businessName || <span className="text-slate-300">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <CurrencyBadge currency={account.currency} />
                    </td>
                    <td className="px-3 py-2.5">
                      {account.createdAt ? (
                        <>
                          <p className="text-[10px] font-medium text-slate-700">
                            {new Date(account.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {new Date(account.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </>
                      ) : <span className="text-slate-300 text-[10px]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px] text-slate-500">
              Showing <strong className="text-slate-700">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)}</strong> of <strong className="text-slate-700">{sorted.length}</strong> accounts
              {search && <span className="text-slate-400"> (filtered from {accounts.length})</span>}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(0)} disabled={page === 0}
                  className="p-1 rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1 rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p;
                  if (totalPages <= 5) p = i;
                  else if (page < 3) p = i;
                  else if (page > totalPages - 3) p = totalPages - 5 + i;
                  else p = page - 2 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-6 h-6 text-[10px] font-semibold rounded border transition-colors ${page === p ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}>
                      {p + 1}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1 rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                  className="p-1 rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile pagination */}
        {totalPages > 1 && (
          <div className="md:hidden flex items-center justify-between mt-3">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md disabled:opacity-30 disabled:cursor-not-allowed shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Prev
            </button>
            <span className="text-[10px] text-slate-500">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md disabled:opacity-30 disabled:cursor-not-allowed shadow-sm">
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}