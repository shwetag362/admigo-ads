
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy, Loader2, CheckCircle2, AlertCircle, Instagram,
  RefreshCw, Lock, ArrowRight, Layers, Zap,
  Building2, Target, Sparkles, AlertTriangle, XCircle, Clock,
  Wifi, ShieldAlert, ChevronDown, ChevronUp, Bug,
  ImageIcon, Video, Wand2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Header
  headerBg:        "#1a1f2e",
  headerText:      "#ffffff",
  headerMuted:     "rgba(255,255,255,0.5)",
  // Indigo (primary)
  indigo:          "#6366f1",
  indigoDark:      "#4f46e5",
  indigoLight:     "#e0e7ff",
  indigoBorder:    "#a5b4fc",
  indigoFg:        "#3730a3",
  // Green (success)
  green:           "#16a34a",
  greenLight:      "#f0fdf4",
  greenBorder:     "#bbf7d0",
  greenFg:         "#14532d",
  greenMid:        "#4ade80",
  // Purple (Instagram)
  purple:          "#9333ea",
  purpleBg:        "#faf5ff",
  purpleBorder:    "#ddd6fe",
  purpleFg:        "#7c3aed",
  // Amber (warning)
  amberBg:         "#fffbeb",
  amberBorder:     "#fcd34d",
  amberFg:         "#92400e",
  amberMid:        "#d97706",
  // Red (error / danger)
  redBg:           "#fef2f2",
  redBorder:       "#fca5a5",
  redFg:           "#7f1d1d",
  redMid:          "#b91c1c",
  // Violet tonal (auto-transfer)
  violetBg:        "#EEEDFE",
  violetBorder:    "#AFA9EC",
  violetFg:        "#3C3489",
  violetMid:       "#534AB7",
  // Neutral surfaces
  surface:         "var(--adm-bg, #ffffff)",
  surface2:        "var(--adm-bg2, #f9fafb)",
  border:          "var(--adm-border, rgba(0,0,0,0.08))",
  text:            "var(--adm-text, #111827)",
  textMuted:       "var(--adm-muted, #6b7280)",
  textFaint:       "var(--adm-faint, #9ca3af)",
  mono:            "var(--adm-mono, 'JetBrains Mono', monospace)",
};

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
const cn = (...cls) => cls.filter(Boolean).join(" ");
const px = (n) => `${n}px`;

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
function StepIndicator({ steps, currentStep }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0 2px" }}>
      {steps.map((label, i) => {
        const done   = i < currentStep;
        const active = i === currentStep;
        return (
          <React.Fragment key={i}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, padding: "14px 0 12px" }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 500, flexShrink: 0,
                transition: "all 0.25s ease",
                background: done ? "#4ade80" : active ? T.indigo : "rgba(255,255,255,0.1)",
                color: done ? "#052e16" : active ? "#fff" : "rgba(255,255,255,0.35)",
                boxShadow: active ? `0 0 0 3px rgba(99,102,241,0.3)` : "none",
              }}>
                {done
                  ? <CheckCircle2 size={12} />
                  : i + 1
                }
              </div>
              <span style={{
                fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
                transition: "color 0.25s ease",
                color: done ? "#4ade80" : active ? "#fff" : "rgba(255,255,255,0.3)",
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 1, margin: "0 10px", marginBottom: 2,
                transition: "background 0.4s ease",
                background: i < currentStep
                  ? "rgba(74,222,128,0.5)"
                  : "rgba(255,255,255,0.12)",
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADING
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeading({ num, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      fontSize: 12, fontWeight: 500, color: T.textMuted,
      paddingBottom: 8,
      borderBottom: `0.5px solid ${T.border}`,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: T.indigo, color: "#fff",
        fontSize: 10, fontWeight: 500,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {num}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD LABEL
// ─────────────────────────────────────────────────────────────────────────────
function FieldLabel({ children, required, hint }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5, marginBottom: 5,
      fontSize: 11, fontWeight: 500, color: T.textMuted,
    }}>
      {children}
      {required && <span style={{ color: "#ef4444" }}>*</span>}
      {hint && (
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.textFaint, fontWeight: 400 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCKED FIELD
// ─────────────────────────────────────────────────────────────────────────────
function LockedField({ loading, value }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      height: 40, padding: "0 12px", borderRadius: 8,
      background: T.surface2, border: `0.5px solid ${T.border}`,
      cursor: "not-allowed", opacity: 0.8,
    }}>
      {loading
        ? <><Loader2 size={13} style={{ color: T.indigo, animation: "spin 1s linear infinite" }} /><span style={{ fontSize: 12, color: T.textMuted }}>Loading…</span></>
        : <>
            <Building2 size={13} style={{ color: T.textFaint, flexShrink: 0 }} />
            <span style={{
              flex: 1, fontSize: 13, fontWeight: 500, color: T.textMuted,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {value || "—"}
            </span>
            <Lock size={11} style={{ color: T.textFaint, flexShrink: 0 }} />
          </>
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT FLOW VISUAL
// ─────────────────────────────────────────────────────────────────────────────
function AccountFlow({ src, tgt, cross }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 12px", borderRadius: 8,
      background: T.surface2, border: `0.5px solid ${T.border}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 500, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>From</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src?.name || "—"}</div>
        <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src?.metaAccountId}</div>
      </div>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `0.5px solid ${cross ? "#97C459" : T.border}`,
        background: cross ? "#EAF3DE" : T.surface,
        color: cross ? "#3B6D11" : T.textFaint,
        transition: "all 0.25s ease",
      }}>
        <ArrowRight size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
        <div style={{ fontSize: 9, fontWeight: 500, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>To</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tgt?.name || "—"}</div>
        <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tgt?.metaAccountId}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WHAT GETS DUPLICATED INFO BOX
// ─────────────────────────────────────────────────────────────────────────────
function DuplicateInfoBox({ isCross }) {
  const items = [
    "Campaign settings & budget",
    "All ad sets & targeting",
    isCross ? "Creatives (auto-replaced)" : "All ads & creatives",
    "Starts in paused status",
    ...(isCross ? ["Images auto-transferred", "Videos transcoded & sent"] : []),
  ];
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 8,
      background: T.surface2, border: `0.5px solid ${T.border}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 7, marginBottom: 10,
        fontSize: 12, fontWeight: 500, color: T.textMuted,
      }}>
        <Layers size={13} style={{ color: T.textFaint }} />
        What gets duplicated
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px" }}>
        {items.map((item) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.indigo, flexShrink: 0 }} />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO TRANSFER INFO
// ─────────────────────────────────────────────────────────────────────────────
function AutoTransferInfo() {
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 8,
      background: T.violetBg, border: `0.5px solid ${T.violetBorder}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: T.indigo,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Wand2 size={12} color="#fff" />
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color: T.violetFg }}>Automatic asset transfer</span>
        <span style={{
          marginLeft: "auto", fontSize: 9, fontWeight: 500, letterSpacing: "0.04em",
          padding: "2px 7px", borderRadius: 20, background: T.indigo, color: "#fff",
        }}>Auto</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
        {[
          { icon: <ImageIcon size={12} />, label: "Images", desc: "Re-uploaded to target account" },
          { icon: <Video size={12} />,     label: "Videos", desc: "Transcoded & transferred" },
        ].map(({ icon, label, desc }) => (
          <div key={label} style={{
            display: "flex", alignItems: "flex-start", gap: 7,
            padding: "8px 10px", borderRadius: 8,
            background: "rgba(255,255,255,0.55)",
            border: `0.5px solid ${T.violetBorder}`,
          }}>
            <span style={{ color: T.violetMid, flexShrink: 0, marginTop: 1 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: T.violetFg }}>{label}</div>
              <div style={{ fontSize: 10, color: T.violetMid, lineHeight: 1.3, marginTop: 2 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 11, color: T.violetMid, lineHeight: 1.6 }}>
        All media assets from the source campaign are automatically detected,
        transferred, and mapped — no manual selection needed.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ErrorPanel({ error }) {
  const [expanded, setExpanded] = useState(false);
  if (!error) return null;

  const typeMap = {
    validation: { bg: T.amberBg,  border: T.amberBorder, icon: <ShieldAlert size={13} />, titleColor: T.amberFg,  msgColor: "#b45309", iconColor: T.amberMid  },
    network:    { bg: "#fff7ed",   border: "#fdba74",      icon: <Wifi size={13} />,        titleColor: "#9a3412",  msgColor: "#c2410c", iconColor: "#ea580c"   },
    meta:       { bg: T.redBg,    border: T.redBorder,    icon: <AlertCircle size={13} />, titleColor: T.redFg,   msgColor: T.redMid,  iconColor: "#dc2626"   },
    critical:   { bg: T.redBg,    border: T.redBorder,    icon: <XCircle size={13} />,     titleColor: T.redFg,   msgColor: T.redMid,  iconColor: "#dc2626"   },
    generic:    { bg: T.redBg,    border: T.redBorder,    icon: <AlertCircle size={13} />, titleColor: T.redFg,   msgColor: T.redMid,  iconColor: "#dc2626"   },
  };
  const c = typeMap[error.type || "generic"];
  const hasDebug = error.details || error.requestId || error.metaCode || error.fbtrace_id;

  return (
    <div style={{ borderRadius: 8, background: c.bg, border: `0.5px solid ${c.border}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ color: c.iconColor, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: c.titleColor }}>{error.title || "An error occurred"}</div>
            <div style={{ fontSize: 11, color: c.msgColor, marginTop: 3, lineHeight: 1.5 }}>{error.message}</div>
            {error.type === "validation" && error.items?.length > 0 && (
              <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
                {error.items.map((item, i) => (
                  <li key={i} style={{ display: "flex", gap: 5, fontSize: 11, color: c.msgColor, marginBottom: 2 }}>
                    <span style={{ color: c.iconColor }}>•</span>{item}
                  </li>
                ))}
              </ul>
            )}
            {error.hint && (
              <div style={{
                marginTop: 8, padding: "6px 10px",
                background: "rgba(255,255,255,0.6)", borderRadius: 6,
                border: `0.5px solid ${c.border}`,
                fontSize: 11, fontWeight: 500, color: c.titleColor,
              }}>
                💡 {error.hint}
              </div>
            )}
          </div>
          {hasDebug && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 3,
                padding: "3px 7px", borderRadius: 6,
                border: "none", cursor: "pointer",
                background: "rgba(0,0,0,0.06)", color: c.titleColor, fontSize: 10,
                fontFamily: "inherit",
              }}
            >
              <Bug size={10} />
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          )}
        </div>
      </div>
      {expanded && hasDebug && (
        <div style={{
          borderTop: `0.5px solid ${c.border}`,
          padding: "10px 14px",
          background: "rgba(0,0,0,0.04)",
          fontFamily: T.mono, fontSize: 10,
        }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>Debug details</div>
          {error.requestId  && <div style={{ color: "#6b7280", marginBottom: 3 }}>Request ID: <span style={{ color: "#374151" }}>{error.requestId}</span></div>}
          {error.metaCode   && <div style={{ color: "#6b7280", marginBottom: 3 }}>Code: <span style={{ color: "#dc2626", fontWeight: 700 }}>{error.metaCode}</span>{error.metaSubcode && <span style={{ color: T.redMid }}> / {error.metaSubcode}</span>}</div>}
          {error.fbtrace_id && <div style={{ color: "#6b7280", marginBottom: 3 }}>FB Trace: <span style={{ color: "#374151" }}>{error.fbtrace_id}</span></div>}
          {error.details    && (
            <div style={{
              marginTop: 4, padding: "6px 8px",
              background: "rgba(255,255,255,0.5)", borderRadius: 4,
              color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-all",
              maxHeight: 72, overflowY: "auto",
            }}>
              {error.details}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WARNINGS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function WarningsPanel({ warnings }) {
  const [expanded, setExpanded] = useState({});
  if (!warnings) return null;

  const igWarnings  = warnings.instagram || [];
  const failedAds   = warnings.failedAds  || [];
  const total       = igWarnings.length + failedAds.length;
  if (total === 0) return null;

  const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  return (
    <div style={{ borderRadius: 8, border: `0.5px solid ${T.amberBorder}`, background: T.amberBg, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderBottom: `0.5px solid #fde68a`,
      }}>
        <AlertTriangle size={13} color={T.amberMid} />
        <span style={{ fontSize: 12, fontWeight: 500, color: T.amberFg }}>{total} Warning{total !== 1 ? "s" : ""}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#b45309" }}>Succeeded with caveats</span>
      </div>

      {igWarnings.map((w, i) => (
        <div key={i} style={{ padding: "10px 14px", borderBottom: `0.5px solid #fde68a`, display: "flex", gap: 8 }}>
          <Instagram size={12} style={{ color: T.purple, flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: T.amberFg }}>{w.message}</div>
            {w.impact && <div style={{ fontSize: 10, color: "#b45309", marginTop: 2 }}>→ {w.impact}</div>}
          </div>
        </div>
      ))}

      {failedAds.length > 0 && (
        <div style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
          <XCircle size={12} style={{ color: "#dc2626", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: T.amberFg }}>
              {failedAds.length} ad{failedAds.length !== 1 ? "s" : ""} failed to duplicate
            </div>
            <button
              onClick={() => toggle("f")}
              style={{
                marginTop: 4, fontSize: 10, color: "#b45309",
                background: "none", border: "none", cursor: "pointer",
                padding: 0, textDecoration: "underline",
                display: "flex", alignItems: "center", gap: 3,
                fontFamily: "inherit",
              }}
            >
              {expanded["f"] ? "Hide" : "Show"} failed ads
              {expanded["f"] ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            </button>
            {expanded["f"] && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {failedAds.map((ad, i) => (
                  <div key={i} style={{
                    padding: "8px 10px", background: "rgba(255,255,255,0.7)",
                    borderRadius: 8, border: `0.5px solid ${T.redBorder}`,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: T.redMid }}>{ad.name}</div>
                    <div style={{ fontSize: 10, color: "#ef4444", marginTop: 2 }}>{ad.error}</div>
                    {ad.errorCode && (
                      <div style={{ fontSize: 10, color: "#6b7280", fontFamily: T.mono, marginTop: 2 }}>
                        Code: {ad.errorCode}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET TRANSFER RESULT
// ─────────────────────────────────────────────────────────────────────────────
function AssetTransferResult({ at }) {
  if (!at) return null;
  return (
    <div style={{ borderRadius: 8, border: `0.5px solid ${T.border}`, background: T.surface2, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 11, fontWeight: 500, color: T.indigo }}>
        <Wand2 size={11} /> Asset transfer results
      </div>
      {[
        { label: "Images transferred", v: at.imagesTransferred, f: at.imagesFailed, icon: <ImageIcon size={11} /> },
        { label: "Videos transferred", v: at.videosTransferred, f: at.videosFailed, icon: <Video size={11} />     },
      ].map(({ label, v, f, icon }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ color: T.textMuted }}>{icon}</span>
          <span style={{ flex: 1, fontSize: 12, color: T.textMuted }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: T.green }}>{v ?? 0}</span>
          {f > 0 && <span style={{ fontSize: 10, color: "#ef4444" }}>({f} failed)</span>}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSE BACKEND ERROR
// ─────────────────────────────────────────────────────────────────────────────
function parseBackendError(result, status) {
  if (!result) return { type: "network", title: "Network Error", message: "No response received." };
  if (result.details && Array.isArray(result.details)) {
    return { type: "validation", title: "Validation Failed", message: result.error || "Validation failed.", items: result.details };
  }

  const fb         = result.details?.facebookError || result.details?.rawBody?.error;
  const metaCode   = fb?.code || result.details?.code;
  const metaSubcode= fb?.error_subcode;
  const fbtrace_id = fb?.fbtrace_id;

  let hint = null;
  if (metaCode === 100)   hint = "Invalid parameter — check IDs exist in the target account.";
  if (metaCode === 200 || metaCode === 190) hint = "Permission error — check ads_management scope.";
  if (metaCode === 273)   hint = "Ad account disabled or in review. Check Business Manager.";
  if (metaCode === 4 || metaCode === 17 || metaCode === 613) hint = "Meta API rate limit. Wait and retry.";
  if (metaSubcode === 1487202) hint = "Facebook Page not authorized for this ad account.";

  if (fb || metaCode) {
    return {
      type: "meta", title: "Meta API Error",
      message: fb?.message || result.message || "Meta API rejected the request.",
      hint, metaCode, metaSubcode, fbtrace_id,
      requestId: result.requestId,
      details: result.details ? JSON.stringify(result.details, null, 2) : null,
    };
  }

  return {
    type: status >= 500 ? "critical" : "generic",
    title: status >= 500 ? "Server Error" : "Request Failed",
    message: result.message || result.error || "Something went wrong.",
    requestId: result.requestId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECT TRIGGER STYLES (shared)
// ─────────────────────────────────────────────────────────────────────────────
const selectTriggerStyle = {
  height: 40, borderRadius: 8, fontSize: 13, fontWeight: 500,
  borderColor: T.border, background: T.surface, color: T.text,
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function DuplicateCampaignDialog({ open, onOpenChange, campaignData, onSuccess }) {
  const [accounts,    setAccounts]    = useState([]);
  const [srcId,       setSrcId]       = useState("");
  const [tgtId,       setTgtId]       = useState("");
  const [loadingAcc,  setLoadingAcc]  = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error,       setError]       = useState(null);
  const [success,     setSuccess]     = useState(null);
  const [pages,       setPages]       = useState([]);
  const [loadingPg,   setLoadingPg]   = useState(false);
  const [pgStatus,    setPgStatus]    = useState(null);
  const [pageId,      setPageId]      = useState("");

  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const alive    = useRef(true);
  const safe     = useCallback((fn) => { if (alive.current) { try { fn(); } catch {} } }, []);

  const isCross = !!(srcId && tgtId && srcId !== tgtId);
  const srcAcc  = accounts.find(a => a.id === srcId);
  const tgtAcc  = accounts.find(a => a.id === tgtId);
  const selPage = pages.find(p => p.metaPageId === pageId);
  const pageIG  = selPage?.instagramAccount;

  const steps   = isCross ? ["Accounts", "Page & assets", "Done"] : ["Accounts", "Review", "Done"];
  const curStep = success ? 2 : (isCross && pageId ? 1 : 0);
  const canDup  = !!srcId && !!tgtId && !duplicating && !success && !loadingPg && (!isCross || !!pageId);

  // ── Load ad accounts ──
  useEffect(() => {
    if (!open) return;
    let on = true;
    const ctrl = new AbortController();
    safe(() => { setLoadingAcc(true); setError(null); setSuccess(null); });

    fetch("/api/meta-accounts", { credentials: "include", signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(({ accounts: acc }) => {
        if (!on) return;
        safe(() => {
          setAccounts(acc || []);
          const src = acc?.find(a => a.id === campaignData?.adAccountId)?.id || acc?.[0]?.id || "";
          setSrcId(src);
          setTgtId(src);
        });
      })
      .catch(e => {
        if (e.name !== "AbortError" && on) {
          safe(() => setError({ type: "network", title: "Failed to load accounts", message: e.message }));
        }
      })
      .finally(() => { if (on) safe(() => setLoadingAcc(false)); });

    return () => { on = false; ctrl.abort(); };
  }, [open, campaignData, safe]);

  // ── Reset cross state ──
  const resetCross = useCallback(() => {
    safe(() => { setPages([]); setPageId(""); setPgStatus(null); setError(null); });
  }, [safe]);

  // ── Load pages for cross-account ──
  useEffect(() => {
    if (!isCross || !tgtId) { resetCross(); return; }
    abortRef.current?.abort();
    let on = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    safe(() => { setLoadingPg(true); setPgStatus("loading"); setError(null); });

    const metaId = accounts.find(a => a.id === tgtId)?.metaAccountId;
    if (!metaId) { safe(() => { setLoadingPg(false); setPgStatus("error"); }); return; }

    fetch(`/api/meta/facebook-pages?adAccountId=${metaId}`, { credentials: "include", signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => {
        if (!on) return;
        const pg = Array.isArray(d?.pages) ? d.pages : [];
        safe(() => { setPages(pg); setPgStatus("success"); if (pg[0]?.metaPageId) setPageId(pg[0].metaPageId); });
      })
      .catch(e => {
        if (e.name === "AbortError" || !on) return;
        safe(() => {
          setPgStatus("error");
          setError({ type: "network", title: "Failed to load pages", message: e.message });
        });
      })
      .finally(() => { if (on) safe(() => setLoadingPg(false)); });

    return () => { on = false; ctrl.abort(); };
  }, [tgtId, isCross, accounts, resetCross, safe]);

  const retryPages = () => { const cur = tgtId; setTgtId(""); setTimeout(() => setTgtId(cur), 100); };

  // ── Duplicate handler ──
  const handleDuplicate = async () => {
    if (!srcId || !tgtId) {
      return setError({ type: "validation", title: "Missing Selection", message: "Select both source and target accounts.", items: ["Source required", "Target required"] });
    }
    if (!campaignData?.campaignId) {
      return setError({ type: "validation", title: "Invalid Campaign", message: "Campaign data is missing.", items: ["campaignId required"] });
    }
    if (isCross && !pageId) {
      return setError({ type: "validation", title: "Page Required", message: "Select a Facebook Page for cross-account duplication.", items: ["Facebook Page required"] });
    }

    setDuplicating(true); setError(null); setSuccess(null);
    try {
      const body = { sourceAccountId: srcId, targetAccountId: tgtId, campaignId: campaignData.campaignId };
      if (isCross) {
        body.targetPageId = pageId;
        if (pageIG?.id) body.targetInstagramActorId = pageIG.id;
      }

      const res = await fetch("/api/campaign/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      let result;
      try { result = await res.json(); } catch { throw new Error(`Non-JSON (HTTP ${res.status})`); }
      if (!res.ok) { setError(parseBackendError(result, res.status)); return; }

      setSuccess({
        campaignId:      result.data?.duplicatedCampaignId,
        adSetsCreated:   result.data?.adSetsCreated,
        adsCreated:      result.data?.adsCreated,
        adsFailed:       result.data?.adsFailed ?? 0,
        totalAds:        result.data?.totalAds,
        processingTime:  result.data?.processingTime,
        placement:       result.data?.placement,
        objectiveMapping:result.objectiveMapping,
        warnings:        result.warnings,
        assetTransfer:   result.data?.assetTransfer,
      });
      if (onSuccess) try { onSuccess(result); } catch {}
      timerRef.current = setTimeout(() => {
        onOpenChange(false); setSuccess(null); setError(null); resetCross();
      }, 7000);
    } catch (e) {
      if (e.name !== "AbortError") setError({ type: "network", title: "Request Failed", message: e.message });
    } finally {
      setDuplicating(false);
    }
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] sm:w-[520px] max-w-[520px]"
        style={{
          padding: 0, gap: 0, border: "none",
          borderRadius: 16, overflow: "hidden",
          maxHeight: "92dvh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 6px 20px rgba(0,0,0,0.08)",
        }}
      >
        {/* ══════════════════ HEADER ══════════════════ */}
        <div style={{
          background: T.headerBg,
          padding: "20px 20px 0",
          flexShrink: 0,
        }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: "rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Copy size={18} color={T.headerText} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                margin: 0, fontSize: 16, fontWeight: 500,
                color: T.headerText, lineHeight: 1.3,
              }}>
                Duplicate campaign
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: T.headerMuted, lineHeight: 1.4 }}>
                {isCross
                  ? "Copy to another account — assets transferred automatically"
                  : "Create an exact copy in the same account"
                }
              </p>
            </div>
            {isCross && (
              <span style={{
                flexShrink: 0,
                display: "flex", alignItems: "center", gap: 5,
                padding: "3px 8px", borderRadius: 20,
                background: "rgba(99,102,241,0.25)",
                border: "0.5px solid rgba(99,102,241,0.5)",
                color: "#a5b4fc", fontSize: 10, fontWeight: 500, letterSpacing: "0.05em",
                whiteSpace: "nowrap",
              }}>
                <Zap size={9} /> Cross-account
              </span>
            )}
          </div>

          {/* Step indicator */}
          <StepIndicator steps={steps} currentStep={curStep} />
        </div>

        {/* ══════════════════ SCROLLABLE BODY ══════════════════ */}
        <div style={{ overflowY: "auto", flex: 1, background: T.surface }}>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Campaign info card */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 10,
              background: T.surface2, border: `0.5px solid ${T.border}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: "#EAF3DE",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Target size={16} color="#3B6D11" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 500, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Campaign</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {campaignData?.campaign || "N/A"}
                </div>
                <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textMuted }}>
                  ID: {campaignData?.campaignId || "N/A"}
                </div>
              </div>
              <div style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                padding: "3px 9px", borderRadius: 20,
                background: "#E6F1FB", border: "0.5px solid #B5D4F4",
                color: "#185FA5", fontSize: 10, fontWeight: 500,
              }}>
                <Layers size={9} /> All assets
              </div>
            </div>

            {/* ── STEP 1: Account selection ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SectionHeading num="1">Select accounts</SectionHeading>

              {/* Source (locked) */}
              <div>
                <FieldLabel>
                  <Lock size={10} />
                  Source account
                  <span style={{ marginLeft: 3, fontSize: 10, color: T.textFaint, fontWeight: 400 }}>(fixed)</span>
                </FieldLabel>
                <LockedField loading={loadingAcc} value={srcAcc?.name} />
              </div>

              {/* Target */}
              <div>
                <FieldLabel required>Target account</FieldLabel>
                <Select value={tgtId} onValueChange={setTgtId} disabled={loadingPg || loadingAcc}>
                  <SelectTrigger style={selectTriggerStyle}>
                    <SelectValue placeholder="Choose destination account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.length > 0
                      ? accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Building2 size={12} style={{ color: T.textMuted }} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>{acc.name}</div>
                                <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textMuted }}>{acc.metaAccountId}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      : <div style={{ padding: "8px 12px", fontSize: 12, color: T.textMuted }}>No ad accounts found</div>
                    }
                  </SelectContent>
                </Select>
              </div>

              {/* Account flow visual */}
              {srcId && tgtId && <AccountFlow src={srcAcc} tgt={tgtAcc} cross={isCross} />}
            </div>

            {/* ── STEP 2: Page selection (cross-account only) ── */}
            {isCross && (
              <>
                <div style={{ height: "0.5px", background: T.border }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <SectionHeading num="2">
                    Facebook page & identity
                    {loadingPg && (
                      <span style={{ marginLeft: 6, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.indigo }}>
                        <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Loading…
                      </span>
                    )}
                  </SectionHeading>

                  {loadingPg ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 14px", borderRadius: 8,
                      background: T.indigoLight, border: `0.5px solid ${T.indigoBorder}`,
                    }}>
                      <Loader2 size={14} style={{ color: T.indigo, animation: "spin 1s linear infinite" }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: T.indigoFg }}>Fetching pages</div>
                        <div style={{ fontSize: 10, color: T.indigo, marginTop: 2 }}>Loading Facebook Pages for the target account…</div>
                      </div>
                    </div>
                  ) : pgStatus === "error" ? (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                      padding: "10px 14px", borderRadius: 8,
                      background: T.redBg, border: `0.5px solid ${T.redBorder}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.redMid, fontSize: 12, fontWeight: 500 }}>
                        <AlertCircle size={13} /> Failed to load pages
                      </div>
                      <button
                        onClick={retryPages}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 7,
                          border: `0.5px solid ${T.redBorder}`,
                          background: "#fff", color: T.redMid,
                          fontSize: 11, fontWeight: 500, cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <RefreshCw size={10} /> Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Page selector */}
                      <div>
                        <FieldLabel required hint={`${pages.length} available`}>Facebook page</FieldLabel>
                        <Select value={pageId} onValueChange={setPageId}>
                          <SelectTrigger style={selectTriggerStyle}>
                            <SelectValue placeholder="Select a Facebook page…" />
                          </SelectTrigger>
                          <SelectContent>
                            {pages.length > 0
                              ? pages.map(p => (
                                  <SelectItem key={p.metaPageId} value={p.metaPageId}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div style={{
                                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                                        background: T.indigoLight, border: `0.5px solid ${T.indigoBorder}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 11, fontWeight: 500, color: T.indigo,
                                      }}>
                                        {p.name?.charAt(0) || "P"}
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 12, fontWeight: 500 }}>{p.name}</div>
                                        {p.instagramAccount && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: T.purple }}>
                                            <Instagram size={8} />@{p.instagramAccount.username}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))
                              : <div style={{ padding: "8px 12px", fontSize: 12, color: T.textMuted }}>No pages found for this account</div>
                            }
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Instagram — auto from page */}
                      {pageId && (
                        <div>
                          <FieldLabel>
                            <Instagram size={10} style={{ color: T.purple }} />
                            Instagram
                            <span style={{
                              marginLeft: 5, padding: "1px 6px", borderRadius: 20,
                              background: "#f3e8ff", border: `0.5px solid ${T.purpleBorder}`,
                              color: T.purpleFg, fontSize: 9, fontWeight: 500,
                            }}>
                              auto from page
                            </span>
                          </FieldLabel>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px", borderRadius: 8,
                            background: pageIG ? T.purpleBg : T.surface2,
                            border: `0.5px solid ${pageIG ? T.purpleBorder : T.border}`,
                            transition: "all 0.2s ease",
                          }}>
                            {pageIG ? (
                              <>
                                {pageIG.profilePictureUrl
                                  ? <img
                                      src={pageIG.profilePictureUrl}
                                      alt={pageIG.username}
                                      style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
                                      onError={e => { e.target.style.display = "none"; }}
                                    />
                                  : <div style={{
                                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                                      background: "linear-gradient(135deg,#a855f7,#ec4899)",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                      <Instagram size={14} color="#fff" />
                                    </div>
                                }
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>@{pageIG.username}</div>
                                  {pageIG.followersCount != null && (
                                    <div style={{ fontSize: 10, color: T.textMuted }}>
                                      {pageIG.followersCount.toLocaleString()} followers
                                    </div>
                                  )}
                                </div>
                                <CheckCircle2 size={14} style={{ color: T.purple }} />
                              </>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.textMuted, fontSize: 11 }}>
                                <AlertCircle size={12} /> No Instagram connected — Facebook only
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <AutoTransferInfo />
                    </>
                  )}
                </div>
              </>
            )}

            {/* ── What gets duplicated info ── */}
            {!success && <DuplicateInfoBox isCross={isCross} />}

            {/* ── Error panel ── */}
            {error && <ErrorPanel error={error} />}

            {/* ── Success state ── */}
            {success && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Success card */}
                <div style={{
                  borderRadius: 10, overflow: "hidden",
                  border: `0.5px solid ${T.greenBorder}`,
                }}>
                  {/* Top bar */}
                  <div style={{
                    height: 3,
                    background: `linear-gradient(90deg, ${T.green}, ${T.greenMid})`,
                  }} />
                  <div style={{
                    padding: "16px 18px",
                    background: T.greenLight,
                    display: "flex", flexDirection: "column", gap: 14,
                  }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        background: T.green,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <CheckCircle2 size={18} color="#fff" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: T.greenFg }}>
                          Campaign duplicated successfully
                        </div>
                        <div style={{ fontSize: 11, color: T.green, marginTop: 2 }}>
                          Closing automatically in a few seconds…
                        </div>
                        {success.processingTime && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#15803d", marginTop: 3 }}>
                            <Clock size={9} /> {success.processingTime}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                      {[
                        { label: "Campaign ID", v: success.campaignId    },
                        { label: "Ad sets",     v: success.adSetsCreated },
                        { label: "Ads created", v: success.adsCreated    },
                      ].map(({ label, v }) => (
                        <div key={label} style={{
                          background: "#fff", borderRadius: 8, padding: "10px 8px",
                          border: `0.5px solid ${T.greenBorder}`, textAlign: "center",
                        }}>
                          <div style={{
                            fontSize: 15, fontWeight: 500, color: T.green,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {v ?? "—"}
                          </div>
                          <div style={{
                            fontSize: 10, color: "#6b7280", marginTop: 2,
                            fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase",
                          }}>
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Ads-failed notice */}
                    {success.adsFailed > 0 && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 12px", borderRadius: 7,
                        background: T.amberBg, border: `0.5px solid ${T.amberBorder}`,
                        fontSize: 11, color: T.amberFg,
                      }}>
                        <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                        {success.adsFailed} of {success.totalAds} ad{success.totalAds !== 1 ? "s" : ""} failed — check warnings below
                      </div>
                    )}

                    {/* Objective mapping */}
                    {success.objectiveMapping && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                        padding: "8px 12px", borderRadius: 7,
                        background: T.amberBg, border: `0.5px solid ${T.amberBorder}`,
                        fontSize: 11, color: T.amberFg,
                      }}>
                        <AlertCircle size={12} style={{ flexShrink: 0 }} />
                        Objective mapped:{" "}
                        <strong style={{ marginLeft: 3 }}>{success.objectiveMapping.original}</strong>
                        {" → "}
                        <strong>{success.objectiveMapping.mapped}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {success.assetTransfer && <AssetTransferResult at={success.assetTransfer} />}
                {success.warnings      && <WarningsPanel warnings={success.warnings} />}
              </div>
            )}

          </div>
        </div>

        {/* ══════════════════ FOOTER ══════════════════ */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          padding: "13px 20px",
          background: T.surface2,
          borderTop: `0.5px solid ${T.border}`,
          flexShrink: 0,
        }}>
          {/* Cancel */}
          <button
            onClick={() => onOpenChange(false)}
            disabled={duplicating}
            style={{
              height: 38, padding: "0 16px", borderRadius: 8, cursor: "pointer",
              background: "transparent", border: `0.5px solid ${T.border}`,
              color: T.textMuted, fontSize: 13, fontWeight: 500,
              transition: "all 0.15s ease",
              opacity: duplicating ? 0.5 : 1,
              fontFamily: "inherit",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.indigo; e.currentTarget.style.color = T.indigo; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border;  e.currentTarget.style.color = T.textMuted; }}
          >
            Cancel
          </button>

          {/* Primary action */}
          <button
            onClick={handleDuplicate}
            disabled={!canDup}
            style={{
              height: 38, padding: "0 18px", borderRadius: 8,
              cursor: canDup ? "pointer" : "not-allowed",
              background: !canDup && !success
                ? T.surface2
                : success
                ? T.green
                : T.indigo,
              border: "none",
              color: (canDup || success) ? "#fff" : T.textFaint,
              fontSize: 13, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 7,
              minWidth: 180, justifyContent: "center",
              transition: "all 0.15s ease",
              opacity: !canDup && !success ? 0.45 : 1,
              fontFamily: "inherit",
            }}
            onMouseEnter={e => {
              if (canDup && !success) {
                e.currentTarget.style.background = T.indigoDark;
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = success ? T.green : canDup ? T.indigo : T.surface2;
              e.currentTarget.style.transform = "none";
            }}
          >
            {duplicating ? (
              <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Duplicating…</>
            ) : success ? (
              <><CheckCircle2 size={13} /> Done!</>
            ) : (
              <>
                <Sparkles size={13} />
                {isCross ? "Duplicate to target" : "Duplicate campaign"}
              </>
            )}
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}