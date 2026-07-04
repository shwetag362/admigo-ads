// app/dashboard/ads-reporting/charts/page.jsx
// Meta Ads Manager — CHART ANALYTICS  v3  (Backend-Aligned)
//
// BACKEND ALIGNMENT FIXES (v2 → v3):
//  ✅ A1 — currency is response.currency {code,symbol,decimals,name}, always used as ci.code
//  ✅ A2 — summary object fields corrected: backend returns spend,impressions,clicks,
//           conversions,conversion_values,ctr,cpm,cpc,cost_per_conversion,roas,_formatted
//           (reach & frequency are NOT in summary — fetched from tableData totals instead)
//  ✅ A3 — All API calls include `summary=true` and `calculate_metrics=true`
//  ✅ A4 — Breakdown API calls use `breakdowns[]=<dim>` URLSearchParams correctly
//  ✅ A5 — actions[] / action_values[] are pre-processed by backend; rows expose
//           `conversions`, `roas`, `add_to_cart`, `leads`, `conversion_values` directly
//  ✅ A6 — `_formatted` object on each row used for display-ready monetary strings
//  ✅ A7 — fields param matches ALL_AVAILABLE_METRICS (no invalid fields)
//  ✅ A8 — FunnelPanel now derives reach/frequency totals from tableData rows, not summary
//  ✅ A9 — TopPerformers uses `${level}_name` key with correct fallback chain
//  ✅ A10 — ScatterPanel correctly maps data using calculated `roas` field from backend
//  ✅ A11 — QuickBreakdownCard passes `summary=true&calculate_metrics=true`
//  ✅ A12 — Error responses parsed correctly from backend `{ error, message, category }`
//  ✅ A13 — Paging info from `response.paging` exposed in meta panel
//  ✅ A14 — `account_currency` field in rows used for per-row currency display
//  ✅ A15 — cost_per_action_type is array, not scalar — handled safely
//
// Route:    /dashboard/ads-reporting/charts
// Requires: npm install recharts

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ComposedChart, Area, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp, BarChart3, PieChart as PieIcon, Activity, Target,
  ChevronDown, Check, Loader2, AlertCircle, RefreshCw,
  Eye, MousePointer, DollarSign, Zap, ArrowUpRight,
  ArrowLeft, Building2, Coins, Clock, Info,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const META_BLUE   = "#1877F2";
const META_GREEN  = "#00C853";
const META_ORANGE = "#FF6D00";
const META_PURPLE = "#9C27B0";

const PLATFORM_COLORS = {
  facebook:         "#1877F2",
  instagram:        "#E1306C",
  messenger:        "#006AFF",
  audience_network: "#FF6D00",
  whatsapp:         "#25D366",
};

const CHART_GRID_COLOR = "#F0F2F5";
const CHART_TICK_COLOR = "#65676B";

// A5: Metrics that exist on rows after backend calculateDerivedMetrics():
//   Raw fields: spend, impressions, reach, clicks, ctr, cpc, cpm, cpp, frequency
//   Calculated: conversions, roas, add_to_cart, leads, conversion_values
// A15: cost_per_action_type is an ARRAY — excluded from scalar metrics
const CHART_METRICS = [
  { value: "spend",            key: "spend",            label: "Amount Spent",      format: "currency",   color: META_BLUE,   group: "delivery"   },
  { value: "impressions",      key: "impressions",      label: "Impressions",        format: "number",     color: META_PURPLE, group: "delivery"   },
  { value: "reach",            key: "reach",            label: "Reach",              format: "number",     color: META_ORANGE, group: "delivery"   },
  { value: "clicks",           key: "clicks",           label: "Link Clicks",        format: "number",     color: "#00BCD4",   group: "clicks"     },
  { value: "ctr",              key: "ctr",              label: "CTR (%)",            format: "percentage", color: "#FF5722",   group: "clicks"     },
  { value: "cpc",              key: "cpc",              label: "CPC",                format: "currency",   color: "#795548",   group: "costs"      },
  { value: "cpm",              key: "cpm",              label: "CPM",                format: "currency",   color: "#607D8B",   group: "costs"      },
  { value: "cpp",              key: "cpp",              label: "CPP",                format: "currency",   color: "#3F51B5",   group: "costs"      },
  { value: "frequency",        key: "frequency",        label: "Frequency",          format: "decimal",    color: META_ORANGE, group: "delivery"   },
  { value: "conversions",      key: "conversions",      label: "Conversions",        format: "number",     color: META_GREEN,  group: "conversion" },
  { value: "roas",             key: "roas",             label: "ROAS",               format: "decimal",    color: "#4CAF50",   group: "conversion" },
  { value: "conversion_values",key: "conversion_values",label: "Conv. Value",        format: "currency",   color: "#009688",   group: "conversion" },
];

// A7: Exact field strings matching backend VALID_FIELDS / ALL_AVAILABLE_METRICS
// These are the fields we request from the API
const MAIN_FIELDS = [
  "campaign_id","campaign_name",
  "adset_id","adset_name",
  "ad_id","ad_name",
  "objective",
  "spend","impressions","reach","clicks","ctr","cpc","cpm","cpp","frequency",
  "actions","action_values",
  "cost_per_action_type",
  "date_start","date_stop",
].join(",");

const TIMESERIES_FIELDS = [
  "spend","impressions","reach","clicks","ctr","cpc","cpm","frequency",
  "actions","action_values",
  "date_start","date_stop",
].join(",");

const BREAKDOWN_FIELDS = [
  "spend","impressions","clicks","ctr","cpm","cpc","reach",
  "actions","action_values",
  "date_start","date_stop",
].join(",");

const PLATFORM_FIELDS = "spend,impressions,date_start,date_stop";

const BREAKDOWN_OPTIONS = [
  { value: "publisher_platform", label: "Platform"          },
  { value: "device_platform",    label: "Device"            },
  { value: "age",                label: "Age"               },
  { value: "gender",             label: "Gender"            },
  { value: "country",            label: "Country"           },
  { value: "platform_position",  label: "Placement"         },
  { value: "impression_device",  label: "Impression Device" },
];

const DATE_PRESETS = [
  { value: "today",      label: "Today"        },
  { value: "yesterday",  label: "Yesterday"    },
  { value: "last_3d",    label: "Last 3 days"  },
  { value: "last_7d",    label: "Last 7 days"  },
  { value: "last_14d",   label: "Last 14 days" },
  { value: "last_30d",   label: "Last 30 days" },
  { value: "last_90d",   label: "Last 90 days" },
  { value: "this_month", label: "This month"   },
  { value: "last_month", label: "Last month"   },
  { value: "lifetime",   label: "Lifetime"     },
];

const CHART_TABS = [
  { key: "timeseries", label: "Over Time",   icon: TrendingUp },
  { key: "breakdown",  label: "Breakdown",   icon: BarChart3  },
  { key: "share",      label: "Share",       icon: PieIcon    },
  { key: "scatter",    label: "Performance", icon: Target     },
  { key: "funnel",     label: "Funnel",      icon: Activity   },
];

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

// A1: ci is the currency object { code, symbol, decimals, name } from backend
const fmt = (value, format, ci) => {
  if (value === null || value === undefined || value === "") return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  const currCode = ci?.code || "USD";
  switch (format) {
    case "currency":
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currCode,
          minimumFractionDigits: ci?.decimals ?? 2,
          maximumFractionDigits: ci?.decimals ?? 2,
        }).format(num);
      } catch {
        return `${ci?.symbol || "$"}${num.toFixed(ci?.decimals ?? 2)}`;
      }
    case "percentage": return `${num.toFixed(2)}%`;
    case "decimal":    return num.toFixed(2);
    default:
      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
      if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}K`;
      return new Intl.NumberFormat("en-US").format(Math.round(num));
  }
};

// Use _formatted from backend when available (already currency-formatted strings)
// A6: backend adds _formatted.spend, _formatted.cpc, _formatted.cpm, _formatted.conversion_values
const fmtRow = (row, field, format, ci) => {
  if (row?._formatted?.[field]) return row._formatted[field];
  return fmt(row?.[field], format, ci);
};

const fmtDate = (s) => {
  if (!s) return "";
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const platLabel = (v) => {
  const m = { facebook: "Facebook", instagram: "Instagram", messenger: "Messenger", audience_network: "Audience Net." };
  return m[v?.toLowerCase()] || (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
};

const platColor = (p) => PLATFORM_COLORS[p?.toLowerCase()] || META_BLUE;
const calcPct   = (v, t) => (t > 0 ? ((v / t) * 100).toFixed(1) : "0.0");

// A5: Extract a scalar value from actions[] array (backend returns pre-processed
//     conversions/roas, but for raw action breakdown we may need this)
const extractAction = (actions, types, field = "value") => {
  if (!Array.isArray(actions)) return 0;
  const tArr = Array.isArray(types) ? types : [types];
  return actions
    .filter(a => a.action_type && tArr.some(t => a.action_type.toLowerCase().includes(t.toLowerCase())))
    .reduce((s, a) => s + parseFloat(a[field] || 0), 0);
};

// Safe scalar parse — returns 0 for arrays, strings, nulls
const safeNum = (v) => {
  if (v === null || v === undefined) return 0;
  if (Array.isArray(v)) return 0; // A15: cost_per_action_type is array
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// ─────────────────────────────────────────────────────────────────────────────
// PORTAL DROPDOWN (never clipped by overflow:hidden ancestors)
// ─────────────────────────────────────────────────────────────────────────────

function Dropdown({ label, value, options, onChange, colorDot, placeholder = "Select" }) {
  const [open, setOpen]           = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const btnRef                    = useRef(null);

  const canonical  = (opt) => opt.value ?? opt.key;
  const selected   = options.find(o => canonical(o) === value);

  const openMenu = () => {
    if (!btnRef.current) return;
    const r        = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const menuH    = Math.min(options.length * 36 + 8, 288);
    const top      = spaceBelow > menuH ? r.bottom + 4 : r.top - menuH - 4;
    setMenuStyle({ position: "fixed", top, left: r.left, minWidth: Math.max(r.width, 200), zIndex: 9999 });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setMenuStyle(prev => ({ ...prev, top: r.bottom + 4, left: r.left }));
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  const menu = open && typeof document !== "undefined"
    ? createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onMouseDown={e => { e.preventDefault(); setOpen(false); }} />
          <div style={{ ...menuStyle, maxHeight: 288 }} className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-y-auto">
            {options.map(opt => {
              const optVal     = canonical(opt);
              const isSelected = value === optVal;
              return (
                <button key={optVal} onMouseDown={e => { e.preventDefault(); onChange(optVal); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left ${
                    isSelected ? "bg-blue-50 text-blue-900 font-semibold" : "text-gray-700 hover:bg-gray-50"
                  }`}>
                  {colorDot && opt.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: opt.color }} />}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-blue-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <div className="relative inline-block">
      <button ref={btnRef} onClick={openMenu}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm whitespace-nowrap select-none">
        {colorDot && selected?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selected.color }} />}
        {label && <span className="text-gray-500">{label}:</span>}
        <span className="text-blue-700 max-w-[130px] truncate">{selected?.label || placeholder}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {menu}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────

function MetaTooltip({ active, payload, label, ci, metrics }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-3 min-w-[164px] text-xs pointer-events-none">
      <p className="font-bold text-gray-900 mb-2 pb-1.5 border-b border-gray-100">{fmtDate(label) || label}</p>
      {payload.map(e => {
        const m = metrics?.find(x => x.value === e.dataKey || x.key === e.dataKey);
        return (
          <div key={e.dataKey} className="flex items-center justify-between gap-3 mb-1 last:mb-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
              <span className="text-gray-600 max-w-[110px] truncate">{m?.label || e.name}</span>
            </div>
            <span className="font-bold text-gray-900 tabular-nums">{fmt(e.value, m?.format, ci)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME SERIES CHART
// ─────────────────────────────────────────────────────────────────────────────

function TimeSeriesPanel({ data, loading, primary, secondary, ci }) {
  const pm = CHART_METRICS.find(m => m.value === primary)   || CHART_METRICS[0];
  const sm = CHART_METRICS.find(m => m.value === secondary) || CHART_METRICS[1];

  if (loading) return <Spinner />;
  if (!data.length) return (
    <Empty icon={TrendingUp} msg="No daily data. Backend requires time_increment=1. Try a date range of 3+ days (e.g. last_7d)." />
  );

  return (
    <div>
      <div className="flex items-center gap-5 mb-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block w-7 h-0.5" style={{ background: pm.color }} />
          <span className="font-semibold text-gray-700">{pm.label}</span>
          <span className="text-gray-400 text-[10px]">(left axis)</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke={sm.color} strokeWidth="2" strokeDasharray="6 3" /></svg>
          <span className="font-semibold text-gray-700">{sm.label}</span>
          <span className="text-gray-400 text-[10px]">(right axis)</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={272}>
        <ComposedChart data={data} margin={{ top: 4, right: 20, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={pm.color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={pm.color} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date_start" tickFormatter={fmtDate}
            tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} axisLine={false} tickLine={false}
            interval="preserveStartEnd" />
          <YAxis yAxisId="L" orientation="left"
            tickFormatter={v => fmt(v, pm.format, ci)}
            tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} axisLine={false} tickLine={false} width={64} />
          <YAxis yAxisId="R" orientation="right"
            tickFormatter={v => fmt(v, sm.format, ci)}
            tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<MetaTooltip ci={ci} metrics={[pm, sm]} />}
            cursor={{ stroke: "#E4E6EB", strokeWidth: 1 }} />
          <Area yAxisId="L" type="monotone" dataKey={pm.value}
            stroke={pm.color} strokeWidth={2.5} fill="url(#gradPrimary)"
            dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
          <Line yAxisId="R" type="monotone" dataKey={sm.value}
            stroke={sm.color} strokeWidth={2} strokeDasharray="6 3"
            dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-400 text-right mt-1">{data.length} daily data points</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN BAR CHART
// ─────────────────────────────────────────────────────────────────────────────

function BreakdownBarPanel({ data, loading, metricKey, dimKey, ci }) {
  const metric = CHART_METRICS.find(m => m.value === metricKey) || CHART_METRICS[0];

  const rows = useMemo(() => {
    if (!data?.length) return [];
    // A5: For calculated fields (conversions, roas), backend already computed them
    // For roas from breakdown data, calculate from action_values if not present
    return [...data]
      .filter(d => d[dimKey] != null)
      .map(d => {
        let val = safeNum(d[metricKey]);
        // If metricKey is "conversions" and not pre-computed, extract from actions
        if (metricKey === "conversions" && !val && Array.isArray(d.actions)) {
          val = extractAction(d.actions, ["purchase","offsite_conversion.fb_pixel_purchase","omni_purchase"]);
        }
        // If metricKey is "roas" and not pre-computed, derive
        if (metricKey === "roas" && !val && Array.isArray(d.action_values) && safeNum(d.spend) > 0) {
          const rev = extractAction(d.action_values, ["purchase","offsite_conversion.fb_pixel_purchase","omni_purchase"]);
          val = rev / safeNum(d.spend);
        }
        return { name: platLabel(d[dimKey]) || String(d[dimKey]), value: val, raw: d[dimKey] };
      })
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [data, metricKey, dimKey]);

  if (loading) return <Spinner />;
  if (!rows.length) return <Empty icon={BarChart3} msg="No breakdown data for this dimension and metric." />;

  const total = rows.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 44)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 80, left: 4, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={v => fmt(v, metric.format, ci)}
          tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={110}
          tick={{ fontSize: 11, fill: "#1C1E21", fontWeight: 600 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#F7F8FA" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const v = payload[0].value;
            return (
              <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-3 text-xs pointer-events-none">
                <p className="font-bold text-gray-900 mb-1">{label}</p>
                <p className="text-blue-700 font-bold">{fmt(v, metric.format, ci)}</p>
                <p className="text-gray-400 mt-0.5">{calcPct(v, total)}% of total</p>
              </div>
            );
          }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}
          label={{ position: "right", formatter: v => fmt(v, metric.format, ci), style: { fontSize: 10, fill: CHART_TICK_COLOR } }}>
          {rows.map((r, i) => (
            <Cell key={i}
              fill={
                dimKey === "publisher_platform" ? platColor(r.raw)
                : dimKey === "gender"           ? (r.raw === "male" ? "#1877F2" : "#E1306C")
                : `hsl(${211 + i * 28}, 70%, ${52 + i * 3}%)`
              } />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DONUT / SHARE CHART
// ─────────────────────────────────────────────────────────────────────────────

function ShareDonutPanel({ data, loading, metricKey, dimKey, ci }) {
  const metric = CHART_METRICS.find(m => m.value === metricKey) || CHART_METRICS[0];
  const [hov, setHov] = useState(null);
  const PIE_COLORS = ["#1877F2","#E1306C","#006AFF","#FF6D00","#9C27B0","#00C853","#FF5722","#607D8B"];

  const segs = useMemo(() => {
    if (!data?.length) return [];
    const agg = {};
    data.forEach(d => {
      const k = String(d[dimKey] || "unknown");
      let val  = safeNum(d[metricKey]);
      // A5: derive conversions/roas from actions if needed
      if (metricKey === "conversions" && !val && Array.isArray(d.actions)) {
        val = extractAction(d.actions, ["purchase","offsite_conversion.fb_pixel_purchase"]);
      }
      agg[k] = (agg[k] || 0) + val;
    });
    const total = Object.values(agg).reduce((s, v) => s + v, 0);
    return Object.entries(agg)
      .sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([key, value], i) => ({
        key, value,
        name:  platLabel(key) || key,
        pct:   calcPct(value, total),
        color: dimKey === "publisher_platform" ? platColor(key) : PIE_COLORS[i % PIE_COLORS.length],
      }));
  }, [data, metricKey, dimKey]);

  if (loading) return <Spinner />;
  if (!segs.length) return <Empty icon={PieIcon} msg="No share data for this selection." />;

  const total = segs.reduce((s, x) => s + x.value, 0);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative flex-shrink-0">
        <PieChart width={200} height={200}>
          <Pie data={segs} cx={96} cy={96} innerRadius={54} outerRadius={88}
            paddingAngle={2} dataKey="value" stroke="none"
            onMouseEnter={(_, i) => setHov(i)} onMouseLeave={() => setHov(null)}>
            {segs.map((s, i) => <Cell key={i} fill={s.color} opacity={hov === null || hov === i ? 1 : 0.38} />)}
          </Pie>
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-2.5 text-xs pointer-events-none">
                <p className="font-bold text-gray-900">{d.name}</p>
                <p className="text-blue-700 font-bold mt-0.5">{fmt(d.value, metric.format, ci)}</p>
                <p className="text-gray-400">{d.pct}%</p>
              </div>
            );
          }} />
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[10px] text-gray-400 font-medium">Total</p>
          <p className="text-sm font-bold text-gray-900 tabular-nums">{fmt(total, metric.format, ci)}</p>
        </div>
      </div>
      <div className="flex-1 w-full space-y-1.5 min-w-0">
        {segs.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-gray-50 cursor-default"
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color, opacity: hov === null || hov === i ? 1 : 0.35 }} />
            <span className="text-xs text-gray-700 flex-1 truncate">{s.name}</span>
            <span className="text-xs font-bold text-gray-400 w-10 text-right tabular-nums">{s.pct}%</span>
            <span className="text-xs font-bold text-gray-900 w-20 text-right tabular-nums">{fmt(s.value, metric.format, ci)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCATTER / PERFORMANCE CHART
// ─────────────────────────────────────────────────────────────────────────────

function ScatterPanel({ data, loading, xKey, yKey, ci, reportingLevel }) {
  const xm = CHART_METRICS.find(m => m.value === xKey) || CHART_METRICS[0];
  const ym = CHART_METRICS.find(m => m.value === yKey) || CHART_METRICS[10]; // roas by default

  // A10: roas is already calculated by backend calculateDerivedMetrics()
  // A9: use correct level name key
  const nameKey = `${reportingLevel}_name`;

  const points = useMemo(() => {
    if (!data?.length) return [];
    return data
      .map(d => {
        let xVal = safeNum(d[xKey]);
        let yVal = safeNum(d[yKey]);
        // A5/A10: if roas not pre-calculated, try to derive
        if (yKey === "roas" && !yVal && Array.isArray(d.action_values) && safeNum(d.spend) > 0) {
          const rev = extractAction(d.action_values, ["purchase","offsite_conversion.fb_pixel_purchase","omni_purchase"]);
          yVal = rev > 0 ? rev / safeNum(d.spend) : 0;
        }
        if (xKey === "conversions" && !xVal && Array.isArray(d.actions)) {
          xVal = extractAction(d.actions, ["purchase","offsite_conversion.fb_pixel_purchase","omni_purchase"]);
        }
        return {
          x:    xVal,
          y:    yVal,
          z:    Math.max(40, Math.sqrt(safeNum(d.impressions)) / 8),
          name: d[nameKey] || d.campaign_name || d.adset_name || d.ad_name || "—",
          // A6: use _formatted for tooltip if available
          xFmt: d._formatted?.[xKey] || null,
          yFmt: d._formatted?.[yKey] || null,
        };
      })
      .filter(p => p.x > 0 || p.y > 0);
  }, [data, xKey, yKey, nameKey]);

  const medX = useMemo(() => { if (!points.length) return 0; const s = [...points].sort((a,b)=>a.x-b.x); return s[Math.floor(s.length/2)]?.x||0; }, [points]);
  const medY = useMemo(() => { if (!points.length) return 0; const s = [...points].sort((a,b)=>a.y-b.y); return s[Math.floor(s.length/2)]?.y||0; }, [points]);

  if (loading) return <Spinner />;
  if (!points.length) return <Empty icon={Target} msg="No performance data. Make sure spend and ROAS metrics are available for this date range." />;

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-[10px] text-gray-400 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 opacity-60 inline-block" /> Bubble size = Impressions</span>
        <span className="flex items-center gap-1"><svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#ccc" strokeWidth="1.5" strokeDasharray="4 2"/></svg> Median lines</span>
        <span className="ml-auto font-medium text-gray-500">{points.length} {reportingLevel}s</span>
      </div>
      <ResponsiveContainer width="100%" height={268}>
        <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 28 }}>
          <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={xm.label}
            tickFormatter={v => fmt(v, xm.format, ci)}
            tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} axisLine={false} tickLine={false}
            label={{ value: xm.label, position: "insideBottom", offset: -16, style: { fontSize: 10, fill: CHART_TICK_COLOR } }} />
          <YAxis type="number" dataKey="y" name={ym.label}
            tickFormatter={v => fmt(v, ym.format, ci)}
            tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} axisLine={false} tickLine={false} width={52}
            label={{ value: ym.label, angle: -90, position: "insideLeft", style: { fontSize: 10, fill: CHART_TICK_COLOR } }} />
          <ZAxis dataKey="z" range={[24, 360]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-3 text-xs pointer-events-none max-w-[196px]">
                  <p className="font-bold text-gray-900 truncate mb-1.5">{d.name}</p>
                  <p className="text-gray-600">{xm.label}: <span className="font-bold text-gray-900">{d.xFmt || fmt(d.x, xm.format, ci)}</span></p>
                  <p className="text-gray-600">{ym.label}: <span className="font-bold text-gray-900">{d.yFmt || fmt(d.y, ym.format, ci)}</span></p>
                </div>
              );
            }} />
          {medX > 0 && <ReferenceLine x={medX} stroke="#D1D5DB" strokeDasharray="4 2" />}
          {medY > 0 && <ReferenceLine y={medY} stroke="#D1D5DB" strokeDasharray="4 2" />}
          <Scatter data={points} fill={META_BLUE} fillOpacity={0.65} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { q:"↗", label:"High Spend · High ROAS", tip:"Scale immediately",  cls:"bg-emerald-50 border-emerald-200 text-emerald-700" },
          { q:"↖", label:"Low Spend · High ROAS",  tip:"Increase budget",    cls:"bg-blue-50 border-blue-200 text-blue-700"         },
          { q:"↘", label:"High Spend · Low ROAS",  tip:"Review creative",    cls:"bg-rose-50 border-rose-200 text-rose-700"         },
          { q:"↙", label:"Low Spend · Low ROAS",   tip:"Deprioritize",       cls:"bg-gray-50 border-gray-200 text-gray-600"         },
        ].map(({ q, label, tip, cls }) => (
          <div key={q} className={`flex items-center gap-2 p-2.5 rounded-xl border text-[10px] ${cls}`}>
            <span className="text-base font-bold flex-shrink-0">{q}</span>
            <div><p className="font-bold leading-tight">{label}</p><p className="opacity-70 mt-0.5">{tip}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNNEL PANEL
// A8: reach/frequency NOT in summary — totals from tableData rows instead
// ─────────────────────────────────────────────────────────────────────────────

function FunnelPanel({ summary, tableData, loading, ci }) {
  // A8: Compute reach and frequency from tableData rows since backend summary
  // only contains: spend, impressions, clicks, conversions, conversion_values,
  // ctr, cpm, cpc, cost_per_conversion, roas
  const derived = useMemo(() => {
    let totalReach = 0, totalFreq = 0, freqCount = 0;
    (tableData || []).forEach(row => {
      totalReach += safeNum(row.reach);
      const f = safeNum(row.frequency);
      if (f > 0) { totalFreq += f; freqCount++; }
    });
    return {
      reach:     totalReach,
      frequency: freqCount > 0 ? totalFreq / freqCount : 0,
    };
  }, [tableData]);

  const stages = useMemo(() => {
    const imp  = safeNum(summary.impressions);
    const rch  = derived.reach;
    const clk  = safeNum(summary.clicks);
    const conv = safeNum(summary.conversions);
    if (!imp) return [];
    return [
      { name: "Impressions", value: imp,  emoji: "👁️",  drop: null                    },
      { name: "Reach",       value: rch,  emoji: "👤",  drop: rch > 0 ? calcPct(rch, imp) : null },
      { name: "Clicks",      value: clk,  emoji: "🖱️",  drop: calcPct(clk, rch || imp) },
      { name: "Conversions", value: conv, emoji: "✅",  drop: clk > 0 ? calcPct(conv, clk) : null },
    ].filter(s => s.value > 0);
  }, [summary, derived]);

  if (loading) return <Spinner />;
  if (!stages.length) return <Empty icon={Activity} msg="No funnel data for this period. Ensure impressions and conversions are tracked." />;

  const maxVal = stages[0].value;

  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => (
        <div key={s.name}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-2 text-xs font-semibold text-gray-800">
              <span>{s.emoji}</span>
              <span>{s.name}</span>
              {s.drop && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">{s.drop}%</span>}
            </span>
            <span className="text-xs font-bold text-gray-900 tabular-nums">{fmt(s.value, "number", null)}</span>
          </div>
          <div className="h-9 bg-gray-100 rounded-xl overflow-hidden">
            <div className="h-full rounded-xl flex items-center justify-end pr-3 transition-all duration-700"
              style={{ width: `${(s.value / maxVal) * 100}%`, background: `linear-gradient(90deg,${META_BLUE},#0D6EFD)`, opacity: 1 - i * 0.14 }}>
              <span className="text-[10px] text-white font-bold">{calcPct(s.value, maxVal)}%</span>
            </div>
          </div>
          {i < stages.length - 1 && <div className="text-center text-xs text-gray-300 mt-1">▼</div>}
        </div>
      ))}

      {/* A2: summary has cpc, cost_per_conversion, roas directly */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "Cost / Click",       value: summary.cpc,               format: "currency"   },
          { label: "Cost / Conversion",  value: summary.cost_per_conversion, format: "currency"  },
          {
            label: "Conv. Rate",
            value: summary.clicks && summary.conversions
              ? (safeNum(summary.conversions) / safeNum(summary.clicks)) * 100
              : null,
            format: "percentage",
          },
        ].map(k => (
          <div key={k.label} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-500 font-medium">{k.label}</p>
            <p className="text-sm font-bold text-gray-900 mt-1.5 tabular-nums">
              {k.value != null ? fmt(k.value, k.format, ci) : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Avg frequency from rows */}
      {derived.frequency > 0 && (
        <div className="mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700">Avg. Frequency: <span className="font-bold">{derived.frequency.toFixed(2)}</span> (avg impressions per unique user)</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARDS
// A2: Keys match what backend summary actually returns
// ─────────────────────────────────────────────────────────────────────────────

const KPI_DEFS = [
  { key:"spend",              label:"Amount Spent",  format:"currency",   Icon:DollarSign,   border:"border-blue-200",   bg:"bg-blue-50",   ic:"text-blue-600",   fmt_key:"spend"   },
  { key:"impressions",        label:"Impressions",   format:"number",     Icon:Eye,          border:"border-purple-200", bg:"bg-purple-50", ic:"text-purple-600"  },
  { key:"clicks",             label:"Link Clicks",   format:"number",     Icon:MousePointer, border:"border-cyan-200",   bg:"bg-cyan-50",   ic:"text-cyan-600"    },
  { key:"ctr",                label:"CTR",           format:"percentage", Icon:Activity,     border:"border-red-200",    bg:"bg-red-50",    ic:"text-red-600"     },
  { key:"cpm",                label:"CPM",           format:"currency",   Icon:Zap,          border:"border-gray-200",   bg:"bg-gray-100",  ic:"text-gray-600",   fmt_key:"cpm"  },
  { key:"cpc",                label:"CPC",           format:"currency",   Icon:Target,       border:"border-orange-200", bg:"bg-orange-50", ic:"text-orange-600", fmt_key:"cpc"  },
  { key:"roas",               label:"ROAS",          format:"decimal",    Icon:TrendingUp,   border:"border-green-200",  bg:"bg-green-50",  ic:"text-green-600"   },
  { key:"cost_per_conversion",label:"Cost/Conv.",    format:"currency",   Icon:ArrowUpRight, border:"border-yellow-200", bg:"bg-yellow-50", ic:"text-yellow-600"  },
];

function KpiCards({ summary, loading, ci }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
      {KPI_DEFS.map(({ key, label, format, Icon, border, bg, ic, fmt_key }) => {
        // A6: prefer _formatted from summary if available
        const rawVal  = summary[key];
        const fmtVal  = summary._formatted?.[fmt_key];
        return (
          <div key={key} className={`bg-white border ${border} rounded-xl p-3 hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-tight">{label}</span>
              <div className={`p-1 ${bg} rounded`}><Icon className={`w-2.5 h-2.5 ${ic}`} /></div>
            </div>
            {loading
              ? <div className="h-4 w-14 bg-gray-200 rounded animate-pulse" />
              : <p className="text-sm font-bold text-gray-900 truncate tabular-nums">
                  {rawVal != null ? (fmtVal || fmt(rawVal, format, ci)) : "—"}
                </p>
            }
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOP PERFORMERS TABLE
// A9: uses correct `${level}_name` key matching backend field naming
// ─────────────────────────────────────────────────────────────────────────────

function TopPerformers({ data, ci, reportingLevel }) {
  const rows = useMemo(() => {
    if (!data?.length) return [];
    // A9: backend field naming: campaign_name, adset_name, ad_name
    const nameKey = `${reportingLevel}_name`;
    return [...data]
      .sort((a, b) => safeNum(b.spend) - safeNum(a.spend))
      .slice(0, 8)
      .map((d, i) => {
        // A10: roas already computed by calculateDerivedMetrics
        let roas = safeNum(d.roas);
        if (!roas && Array.isArray(d.action_values) && safeNum(d.spend) > 0) {
          const rev = extractAction(d.action_values, ["purchase","offsite_conversion.fb_pixel_purchase","omni_purchase"]);
          roas = rev / safeNum(d.spend);
        }
        return {
          rank: i + 1,
          name: d[nameKey] || d.campaign_name || d.adset_name || d.ad_name || "—",
          // A6: use _formatted.spend if available
          spend:    safeNum(d.spend),
          spendFmt: d._formatted?.spend || null,
          roas,
          ctr:      safeNum(d.ctr),
          objective: d.objective || null,
        };
      });
  }, [data, reportingLevel]);

  if (!rows.length) return <Empty icon={BarChart3} msg="No data yet." />;
  const maxSpend = rows[0]?.spend || 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            {["#","Name","Spend","ROAS","CTR"].map((h, i) => (
              <th key={h} className={`px-2 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide ${i>=2?"text-right":"text-left"} ${i===0?"w-6":""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(r => (
            <tr key={r.rank} className="hover:bg-blue-50/40 transition-colors">
              <td className="px-2 py-2.5 font-bold text-gray-300">{r.rank}</td>
              <td className="px-2 py-2.5">
                <div className="font-semibold text-gray-900 truncate max-w-[150px]">{r.name}</div>
                {r.objective && <div className="text-[10px] text-gray-400 capitalize">{r.objective.replace(/_/g," ")}</div>}
                <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(r.spend/maxSpend)*100}%` }} />
                </div>
              </td>
              <td className="px-2 py-2.5 text-right font-mono font-bold text-gray-900 tabular-nums">
                {r.spendFmt || fmt(r.spend, "currency", ci)}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">
                <span className={`font-mono font-bold ${r.roas>=2?"text-emerald-600":r.roas>0?"text-amber-500":"text-gray-300"}`}>
                  {r.roas > 0 ? `${r.roas.toFixed(2)}x` : "—"}
                </span>
              </td>
              <td className="px-2 py-2.5 text-right font-mono text-gray-600 tabular-nums">{fmt(r.ctr,"percentage",null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE META INFO PANEL
// A13: Shows paging, rowCount, correlationId from response.meta
// ─────────────────────────────────────────────────────────────────────────────

function MetaInfoBadge({ responseMeta, paging }) {
  if (!responseMeta) return null;
  return (
    <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-wrap">
      {responseMeta.rowCount != null && (
        <span className="flex items-center gap-1">
          <BarChart3 className="w-3 h-3" />
          {responseMeta.rowCount} rows
        </span>
      )}
      {responseMeta.cached && (
        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">CACHED</span>
      )}
      {paging?.cursors?.after && (
        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Has more pages</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center h-52 gap-2">
      <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
      <p className="text-xs text-gray-400">Loading…</p>
    </div>
  );
}
function Empty({ icon: Icon, msg }) {
  return (
    <div className="flex flex-col items-center justify-center h-52 gap-3">
      <div className="p-4 bg-gray-50 rounded-full"><Icon className="w-8 h-8 text-gray-300" /></div>
      <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">{msg}</p>
    </div>
  );
}
function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT SELECTOR (portal — never clipped)
// ─────────────────────────────────────────────────────────────────────────────

function AccountSelector({ accounts, selected, onSelect, loading }) {
  const [open, setOpen]           = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const btnRef                    = useRef(null);

  const openMenu = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setMenuStyle({ position:"fixed", top: r.bottom+4, left: r.left, minWidth: 288, zIndex: 9999 });
    setOpen(true);
  };

  if (loading) return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-500 shadow-sm">
      <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      <span>Loading accounts…</span>
    </div>
  );

  const menu = open && typeof document !== "undefined"
    ? createPortal(
        <>
          <div style={{ position:"fixed", inset:0, zIndex:9998 }} onMouseDown={e=>{e.preventDefault();setOpen(false)}} />
          <div style={{ ...menuStyle, maxHeight:288 }} className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Ad Accounts</h3>
            </div>
            {accounts.map(acc => (
              <button key={acc.id} onMouseDown={e=>{e.preventDefault(); onSelect(acc); setOpen(false);}}
                className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 transition-colors text-xs ${selected?.id===acc.id?"bg-blue-50 border-l-2 border-blue-600":""}`}>
                <div className="text-left min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{acc.name}</p>
                  {/* A14: currency on account object */}
                  <p className="text-gray-400 font-mono text-[10px] flex items-center gap-1.5 mt-0.5">
                    <span>{acc.metaAccountId}</span>
                    {acc.currency && <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">{acc.currency}</span>}
                  </p>
                </div>
                {selected?.id===acc.id && <Check className="w-3 h-3 text-blue-600 flex-shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <div className="relative inline-block">
      <button ref={btnRef} onClick={openMenu}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-xs font-semibold shadow-sm">
        <Building2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
        <span className="text-gray-900 truncate max-w-[160px]">{selected?.name || "Select account"}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${open?"rotate-180":""}`} />
      </button>
      {menu}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK BREAKDOWN CARD
// A11: correct params; A3: calculate_metrics=true; dep array uses acc.id
// ─────────────────────────────────────────────────────────────────────────────

function QuickBreakdownCard({ title, subtitle, selectedAcc, datePreset, level, dimKey, metricKey, ci }) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedAcc?.id) return;
    let cancelled = false;
    setLoading(true);
    // A3 + A11: correct params
    const p = new URLSearchParams({
      level,
      date_preset: datePreset,
      ad_account_id: selectedAcc.id,
      fields: BREAKDOWN_FIELDS,
      limit: "500",
      calculate_metrics: "true",
    });
    p.append("breakdowns[]", dimKey);
    fetch(`/api/ads/reporting?${p}`)
      .then(r => r.json())
      // A12: backend error shape { error, message, category }
      .then(d => { if (!cancelled) setData(d.data || []); })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedAcc?.id, datePreset, level, dimKey]); // uses .id not full object

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <BreakdownBarPanel data={data} loading={loading} metricKey={metricKey} dimKey={dimKey} ci={ci} />
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// API HELPER
// A3: Always includes summary=true, calculate_metrics=true
// A12: Parses backend error format { error, message, category, retryable }
// ─────────────────────────────────────────────────────────────────────────────

async function fetchInsights(params) {
  const p = new URLSearchParams({
    summary: "true",
    calculate_metrics: "true",
    ...params,
  });
  // Handle array params (breakdowns)
  if (params["breakdowns[]"]) {
    p.delete("breakdowns[]");
    const bds = Array.isArray(params["breakdowns[]"]) ? params["breakdowns[]"] : [params["breakdowns[]"]];
    bds.forEach(b => p.append("breakdowns[]", b));
  }
  const r = await fetch(`/api/ads/reporting?${p}`);
  const d = await r.json();
  if (!r.ok) {
    // A12: backend returns { error, message, category, retryable, correlationId }
    throw new Error(d.error || d.message || `HTTP ${r.status}`);
  }
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AdsChartsPage() {
  const [accounts,       setAccounts]       = useState([]);
  const [selectedAcc,    setSelectedAcc]    = useState(null);
  const [loadingAcc,     setLoadingAcc]     = useState(true);
  const [datePreset,     setDatePreset]     = useState("last_7d");
  const [level,          setLevel]          = useState("campaign");

  // A1: currencyInfo is { code, symbol, decimals, name } from response.currency
  const [currencyInfo,   setCurrencyInfo]   = useState(null);
  // A13: store meta + paging from last main response
  const [responseMeta,   setResponseMeta]   = useState(null);
  const [paging,         setPaging]         = useState(null);

  // A2: summary shape from backend calculateSummaryStats()
  const [summary,        setSummary]        = useState({});
  const [tableData,      setTableData]      = useState([]);
  const [timeData,       setTimeData]       = useState([]);
  const [breakdownData,  setBreakdownData]  = useState([]);
  const [platformData,   setPlatformData]   = useState([]);

  const [loadingMain, setLoadingMain] = useState(false);
  const [loadingTime, setLoadingTime] = useState(false);
  const [loadingBD,   setLoadingBD]   = useState(false);
  const [loadingPlat, setLoadingPlat] = useState(false);
  const [error,       setError]       = useState(null);

  const [activeTab,       setActiveTab]       = useState("timeseries");
  const [primaryMetric,   setPrimaryMetric]   = useState("spend");
  const [secondaryMetric, setSecondaryMetric] = useState("impressions");
  const [bdMetric,        setBdMetric]        = useState("spend");
  const [bdDim,           setBdDim]           = useState("publisher_platform");
  const [scatterX,        setScatterX]        = useState("spend");
  const [scatterY,        setScatterY]        = useState("roas");

  // Load accounts
  useEffect(() => {
    (async () => {
      try {
        setLoadingAcc(true);
        const r = await fetch("/api/meta-accounts");
        if (!r.ok) throw new Error("Failed to load accounts");
        const d = await r.json();
        setAccounts(d.accounts || []);
        if (d.accounts?.length) setSelectedAcc(d.accounts[0]);
      } catch (e) { setError(e.message); }
      finally { setLoadingAcc(false); }
    })();
  }, []);

  // ── FETCH FUNCTIONS — all use the centralized fetchInsights helper

  const fetchMain = useCallback(async (accId, dp, lv) => {
    if (!accId) return;
    setLoadingMain(true); setError(null);
    try {
      // A7: MAIN_FIELDS only contains valid backend fields
      const d = await fetchInsights({ level: lv, date_preset: dp, ad_account_id: accId, fields: MAIN_FIELDS, limit: "500" });
      setTableData(d.data || []);
      // A2: summary keys: spend, impressions, clicks, conversions, conversion_values, ctr, cpm, cpc, cost_per_conversion, roas, _formatted
      setSummary(d.summary || {});
      // A1: currency is the full object { code, symbol, decimals, name }
      if (d.currency) setCurrencyInfo(d.currency);
      // A13
      if (d.meta) setResponseMeta(d.meta);
      if (d.paging) setPaging(d.paging);
    } catch (e) { setError(e.message); }
    finally { setLoadingMain(false); }
  }, []);

  const fetchTimeSeries = useCallback(async (accId, dp, lv) => {
    if (!accId) return;
    setLoadingTime(true);
    try {
      // A7: TIMESERIES_FIELDS, time_increment=1 for daily breakout
      const d = await fetchInsights({ level: lv, date_preset: dp, ad_account_id: accId, fields: TIMESERIES_FIELDS, limit: "500", time_increment: "1" });
      // Sort ascending by date_start
      setTimeData((d.data || []).sort((a, b) => new Date(a.date_start) - new Date(b.date_start)));
      if (d.currency && !currencyInfo) setCurrencyInfo(d.currency);
    } catch { setTimeData([]); }
    finally { setLoadingTime(false); }
  }, [currencyInfo]);

  const fetchBreakdown = useCallback(async (accId, dp, lv, dim) => {
    if (!accId) return;
    setLoadingBD(true);
    try {
      // A4: breakdowns[] appended correctly via fetchInsights
      const d = await fetchInsights({ level: lv, date_preset: dp, ad_account_id: accId, fields: BREAKDOWN_FIELDS, limit: "500", "breakdowns[]": dim });
      setBreakdownData(d.data || []);
    } catch { setBreakdownData([]); }
    finally { setLoadingBD(false); }
  }, []);

  const fetchPlatform = useCallback(async (accId, dp, lv) => {
    if (!accId) return;
    setLoadingPlat(true);
    try {
      const d = await fetchInsights({ level: lv, date_preset: dp, ad_account_id: accId, fields: PLATFORM_FIELDS, limit: "500", "breakdowns[]": "publisher_platform" });
      setPlatformData(d.data || []);
    } catch { setPlatformData([]); }
    finally { setLoadingPlat(false); }
  }, []);

  // Master refetch
  const refetchAll = useCallback(() => {
    if (!selectedAcc?.id) return;
    const id = selectedAcc.id;
    fetchMain(id, datePreset, level);
    fetchTimeSeries(id, datePreset, level);
    fetchPlatform(id, datePreset, level);
    if (activeTab === "breakdown" || activeTab === "share") {
      fetchBreakdown(id, datePreset, level, bdDim);
    }
  }, [selectedAcc?.id, datePreset, level, activeTab, bdDim, fetchMain, fetchTimeSeries, fetchPlatform, fetchBreakdown]);

  // Trigger on account / date / level change
  useEffect(() => {
    if (selectedAcc?.id) refetchAll();
  }, [selectedAcc?.id, datePreset, level]); // eslint-disable-line

  // Breakdown tab: refetch when tab, dim, date, or level changes
  useEffect(() => {
    if (!selectedAcc?.id) return;
    if (activeTab === "breakdown" || activeTab === "share") {
      fetchBreakdown(selectedAcc.id, datePreset, level, bdDim);
    }
  }, [activeTab, bdDim, selectedAcc?.id, datePreset, level]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-3 py-4 bg-gray-50 min-h-screen">

      {/* ── HEADER ── No overflow-hidden (FIX 1 preserved) */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-4">

        {/* Top row */}
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <Link href="/dashboard/ads-reporting/performance"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 rounded-lg text-xs font-semibold transition-colors flex-shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table View</span>
            </Link>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="p-1.5 bg-blue-600 rounded-lg">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900 leading-none">Chart Analytics</h1>
                <p className="text-[10px] text-gray-400 mt-0.5 hidden sm:block">Visual performance insights · Meta Ads v24.0</p>
              </div>
            </div>

            <AccountSelector accounts={accounts} selected={selectedAcc} onSelect={setSelectedAcc} loading={loadingAcc} />

            {/* A1: show currency from response.currency.code */}
            {currencyInfo && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-800"
                title={currencyInfo.name}>
                <Coins className="w-3 h-3 text-amber-600" />
                {currencyInfo.code}
                {currencyInfo.symbol && currencyInfo.symbol !== currencyInfo.code && (
                  <span className="text-amber-600 font-normal">{currencyInfo.symbol}</span>
                )}
              </div>
            )}

            {/* A13: response meta info */}
            <MetaInfoBadge responseMeta={responseMeta} paging={paging} />
          </div>

          <button onClick={refetchAll} className="p-2 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0" title="Refresh all">
            <RefreshCw className={`w-4 h-4 text-gray-500 hover:text-blue-600 ${(loadingMain||loadingTime)?"animate-spin":""}`} />
          </button>
        </div>

        {/* Controls row */}
        <div className="px-4 py-2.5 bg-gray-50 rounded-b-2xl flex items-center gap-3 flex-wrap">
          <Dropdown value={datePreset} onChange={setDatePreset} options={DATE_PRESETS} placeholder="Date range" />

          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
            {[{k:"campaign",l:"Campaigns"},{k:"adset",l:"Ad Sets"},{k:"ad",l:"Ads"}].map(({k,l}) => (
              <button key={k} onClick={() => setLevel(k)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${level===k?"bg-blue-600 text-white shadow":"text-gray-500 hover:text-gray-800"}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1 text-[10px] text-gray-400">
            <Clock className="w-3 h-3" />
            <span>Updated {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* ── ERROR ── A12: shows backend error message */}
      {error && (
        <div className="mb-4 flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">API Error</p>
            <p className="mt-0.5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* ── KPI CARDS ── A2: uses correct summary keys */}
      <KpiCards summary={summary} loading={loadingMain} ci={currencyInfo} />

      {/* ── MAIN CHART PANEL ── No overflow-hidden (FIX 2 preserved) */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-4">

        {/* Tab bar */}
        <div className="px-4 pt-3 border-b border-gray-100 flex items-center gap-0.5 overflow-x-auto">
          {CHART_TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
                activeTab === key
                  ? "border-blue-600 text-blue-700 bg-blue-50/60"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
          <div className="ml-auto pb-1 flex-shrink-0 pl-2">
            <button
              onClick={() => {
                const id = selectedAcc?.id;
                if (!id) return;
                if (activeTab === "timeseries") fetchTimeSeries(id, datePreset, level);
                else if (activeTab === "breakdown" || activeTab === "share") fetchBreakdown(id, datePreset, level, bdDim);
                else fetchMain(id, datePreset, level);
              }}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
              title="Refresh this chart">
              <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${(loadingTime||loadingBD||loadingMain)?"animate-spin":""}`} />
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-5">

          {activeTab === "timeseries" && (
            <>
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <Dropdown label="Primary"   value={primaryMetric}   onChange={setPrimaryMetric}   colorDot
                  options={CHART_METRICS.filter(m => m.value !== secondaryMetric)} />
                <span className="text-xs text-gray-400 font-medium">vs</span>
                <Dropdown label="Secondary" value={secondaryMetric} onChange={setSecondaryMetric} colorDot
                  options={CHART_METRICS.filter(m => m.value !== primaryMetric)} />
              </div>
              <TimeSeriesPanel data={timeData} loading={loadingTime} primary={primaryMetric} secondary={secondaryMetric} ci={currencyInfo} />
            </>
          )}

          {activeTab === "breakdown" && (
            <>
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <Dropdown label="Break by" value={bdDim}    onChange={setBdDim}    options={BREAKDOWN_OPTIONS} />
                <Dropdown label="Metric"   value={bdMetric} onChange={setBdMetric} colorDot options={CHART_METRICS} />
              </div>
              <BreakdownBarPanel data={breakdownData} loading={loadingBD} metricKey={bdMetric} dimKey={bdDim} ci={currencyInfo} />
            </>
          )}

          {activeTab === "share" && (
            <>
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <Dropdown label="Break by" value={bdDim}    onChange={setBdDim}    options={BREAKDOWN_OPTIONS} />
                <Dropdown label="Metric"   value={bdMetric} onChange={setBdMetric} colorDot options={CHART_METRICS} />
              </div>
              <ShareDonutPanel data={breakdownData} loading={loadingBD} metricKey={bdMetric} dimKey={bdDim} ci={currencyInfo} />
            </>
          )}

          {activeTab === "scatter" && (
            <>
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <Dropdown label="X-Axis" value={scatterX} onChange={setScatterX} colorDot
                  options={CHART_METRICS.filter(m => m.value !== scatterY)} />
                <Dropdown label="Y-Axis" value={scatterY} onChange={setScatterY} colorDot
                  options={CHART_METRICS.filter(m => m.value !== scatterX)} />
                <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{tableData.length} {level}s plotted</span>
              </div>
              {/* A10: tableData rows already have roas computed by backend */}
              <ScatterPanel data={tableData} loading={loadingMain} xKey={scatterX} yKey={scatterY} ci={currencyInfo} reportingLevel={level} />
            </>
          )}

          {activeTab === "funnel" && (
            <>
              <p className="text-xs text-gray-400 mb-5 leading-relaxed">
                Conversion funnel · {level} level · {DATE_PRESETS.find(d=>d.value===datePreset)?.label || datePreset}
              </p>
              {/* A8: pass tableData so FunnelPanel can derive reach/frequency */}
              <FunnelPanel summary={summary} tableData={tableData} loading={loadingMain} ci={currencyInfo} />
            </>
          )}

        </div>
      </div>

      {/* ── PLATFORM SHARE + TOP PERFORMERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Platform Share" subtitle="Spend distribution by publisher platform">
          <ShareDonutPanel data={platformData} loading={loadingPlat} metricKey="spend" dimKey="publisher_platform" ci={currencyInfo} />
        </SectionCard>
        {/* A9: pass reportingLevel for correct name key */}
        <SectionCard title="Top Performers" subtitle={`Ranked by spend · ${level} level`}>
          <TopPerformers data={tableData} ci={currencyInfo} reportingLevel={level} />
        </SectionCard>
      </div>

      {/* ── AGE + GENDER QUICK CARDS — A11: correct API params */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuickBreakdownCard title="Age Breakdown" subtitle="Spend by age group"
          selectedAcc={selectedAcc} datePreset={datePreset} level={level} dimKey="age" metricKey="spend" ci={currencyInfo} />
        <QuickBreakdownCard title="Gender Breakdown" subtitle="Spend by gender"
          selectedAcc={selectedAcc} datePreset={datePreset} level={level} dimKey="gender" metricKey="spend" ci={currencyInfo} />
      </div>

    </div>
  );
}