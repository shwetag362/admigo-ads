"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  FileText,
  CreditCard,
  Users,
  Globe,
  Building2,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Check icon helper ────────────────────────────────────────────────────────
function StatusIcon({ passed, skipped, size = 16 }) {
  if (passed)  return <CheckCircle2  size={size} className="text-emerald-500 shrink-0" />;
  if (skipped) return <AlertTriangle size={size} className="text-amber-500   shrink-0" />;
  return               <XCircle      size={size} className="text-destructive  shrink-0" />;
}

// ─── Map check keys to icons ──────────────────────────────────────────────────
const CHECK_ICONS = {
  accountDetails:    CreditCard,
  leadAdsTos:        ShieldCheck,
  pageLeadTos:       FileText,
  customAudienceTos: Users,
  offsitePixelTos:   Globe,
  businessManager:   Building2,
  sdkHealth:         Wifi,
};

const CHECK_LABELS = {
  accountDetails:    "Account Status & Billing",
  leadAdsTos:        "Lead Ads TOS (Account)",
  pageLeadTos:       "Lead Ads TOS (Pages)",
  customAudienceTos: "Custom Audience TOS",
  offsitePixelTos:   "Meta Pixel TOS",
  businessManager:   "Business Manager",
  sdkHealth:         "API Token & Permissions",
};

// ─── Single check row with optional expandable children ───────────────────────
function CheckRow({ checkKey, check }) {
  const [open, setOpen] = useState(!check?.passed);
  const Icon     = CHECK_ICONS[checkKey] ?? ShieldCheck;
  const label    = CHECK_LABELS[checkKey] ?? checkKey;
  const passed   = check?.passed;
  const skipped  = check?.skipped;

  // Only pageLeadTos and leadAdsTos have expandable details
  const hasDetail =
    (checkKey === "pageLeadTos"   && check?.pages?.length  > 0) ||
    (checkKey === "leadAdsTos"    && check?.detectedVia)        ||
    (checkKey === "accountDetails");

  return (
    <Collapsible open={hasDetail ? open : false} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
          "hover:bg-muted/50",
          passed  ? "border-emerald-500/20 bg-emerald-500/5"  :
          skipped ? "border-amber-500/20   bg-amber-500/5"    :
                    "border-destructive/20 bg-destructive/5"
        )}
        disabled={!hasDetail}
        style={{ cursor: hasDetail ? "pointer" : "default" }}
      >
        <StatusIcon passed={passed} skipped={skipped} />
        <Icon size={14} className="text-muted-foreground shrink-0" />
        <span className={cn(
          "flex-1 text-left font-medium",
          passed  ? "text-emerald-700 dark:text-emerald-400" :
          skipped ? "text-amber-700   dark:text-amber-400"   :
                    "text-destructive"
        )}>
          {label}
        </span>
        {hasDetail && (
          <ChevronRight
            size={14}
            className={cn(
              "text-muted-foreground transition-transform duration-200 shrink-0",
              open && "rotate-90"
            )}
          />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pt-1 pb-2">
        {/* Page TOS detail */}
        {checkKey === "pageLeadTos" && check?.pages?.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {check.pages.map((page) => (
              <div
                key={page.pageId}
                className={cn(
                  "flex items-center justify-between rounded-md border px-3 py-2 text-xs",
                  page.tosAccepted
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-destructive/20 bg-destructive/5"
                )}
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <StatusIcon passed={page.tosAccepted} size={12} />
                  {page.pageName}
                </span>
                {!page.tosAccepted && page.fixUrl && (
                  <a
                    href={page.fixUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-destructive hover:underline font-semibold shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Accept <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Lead TOS detected via */}
        {checkKey === "leadAdsTos" && check?.detectedVia && (
          <p className="mt-1 text-xs text-muted-foreground">
            Detected via:{" "}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {check.detectedVia}
            </Badge>
          </p>
        )}

        {/* Billing detail */}
        {checkKey === "accountDetails" && (
          <div className="mt-2 grid grid-cols-3 gap-3">
            {[
              ["Payment",   check?.fundingSourceName ?? "None"],
              ["Balance",   check?.balance ? `₹${check.balance}` : "—"],
              ["Spend Cap", check?.spendCap && check.spendCap !== "0" ? `₹${check.spendCap}` : "None"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
                <p className="mt-0.5 text-xs font-medium text-foreground truncate">{v}</p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Issue / Warning card ─────────────────────────────────────────────────────
function IssueCard({ issue, isWarning }) {
  const [pagesOpen, setPagesOpen] = useState(false);

  return (
    <Alert
      variant={isWarning ? "default" : "destructive"}
      className={cn(
        "py-3",
        isWarning && "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-300"
      )}
    >
      {isWarning
        ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        : <XCircle className="h-4 w-4 shrink-0" />
      }
      <AlertDescription className="flex flex-col gap-2">
        <p className="text-sm leading-snug">{issue.message}</p>

        {/* Fix button */}
        {issue.fixUrl && (
          <a
            href={issue.fixUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              isWarning
                ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
                : "bg-destructive/10 text-destructive hover:bg-destructive/20"
            )}
          >
            Fix this <ExternalLink size={11} />
          </a>
        )}

        {/* Required scopes */}
        {issue.requiredScopes && (
          <p className="text-xs text-muted-foreground">
            Required scopes:{" "}
            {issue.requiredScopes.map((s) => (
              <Badge key={s} variant="outline" className="mr-1 text-[10px] px-1.5 py-0">{s}</Badge>
            ))}
          </p>
        )}

        {/* Page-level TOS failures collapsible */}
        {issue.pages?.length > 0 && (
          <Collapsible open={pagesOpen} onOpenChange={setPagesOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline">
              <ChevronRight
                size={12}
                className={cn("transition-transform duration-200", pagesOpen && "rotate-90")}
              />
              {issue.pages.length} page{issue.pages.length !== 1 ? "s" : ""} need TOS acceptance
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 flex flex-col gap-1.5">
                {issue.pages.map((page) => (
                  <div
                    key={page.pageId}
                    className="flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText size={11} />
                      {page.pageName}
                    </span>
                    <a
                      href={page.fixUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1 text-xs font-semibold text-destructive hover:underline"
                    >
                      Accept <ExternalLink size={10} />
                    </a>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </AlertDescription>
    </Alert>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function ComplianceSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="h-4 w-32" />
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
      <Skeleton className="h-4 w-24 mt-2" />
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────
export default function ComplianceDialog({
  open,
  onOpenChange,
  adAccountId,
  adAccountName,
  onReady,
}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetchCompliance = useCallback(async (refresh = false) => {
    if (!adAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/meta/lead-terms?adAccountId=${adAccountId}${refresh ? "&refresh=true" : ""}`;
      const res  = await fetch(url);
console.log("Fetching compliance data from", url, "got status", res.status);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server error (${res.status}) — check your API route.`);
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to check compliance");
      setData(json);
      if (json.isReadyToCreateAds && onReady) onReady();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adAccountId, onReady]);

  // Fetch when dialog opens
  useEffect(() => {
    if (open) fetchCompliance();
    else { setData(null); setError(null); }
  }, [open, fetchCompliance]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const checks   = data?.checks   ?? {};
  const issues   = data?.issues   ?? [];
  const warnings = data?.warnings ?? [];
  const isReady  = data?.isReadyToCreateAds ?? false;
  const name     = adAccountName ?? data?.adAccount?.name ?? "Ad Account";

  const checkItems = Object.keys(CHECK_LABELS).filter((k) => checks[k] !== undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              isReady
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                : loading
                ? "border-border bg-muted text-muted-foreground"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}>
              {isReady
                ? <ShieldCheck size={20} />
                : <ShieldAlert size={20} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base leading-tight">
                Ad Account Compliance
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{name}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Status banner */}
        {!loading && data && (
          <div className={cn(
            "flex items-center justify-between px-5 py-2.5 border-b text-xs font-semibold",
            isReady
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          )}>
            <span className="flex items-center gap-2">
              {isReady
                ? <><CheckCircle2 size={13} /> Ready to create ads</>
                : <><XCircle size={13} /> {data.summary.blockingIssues} blocking issue{data.summary.blockingIssues !== 1 ? "s" : ""}</>
              }
            </span>
            {data.summary.warnings > 0 && (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={11} />
                {data.summary.warnings} warning{data.summary.warnings !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Scrollable body */}
        <ScrollArea className="max-h-[420px]">
          {loading && <ComplianceSkeleton />}

          {!loading && error && (
            <div className="p-5">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription className="flex flex-col gap-3">
                  <span>{error}</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-fit"
                    onClick={() => fetchCompliance()}
                  >
                    Try Again
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {!loading && data && (
            <div className="flex flex-col gap-5 p-5">

              {/* Blocking Issues */}
              {issues.length > 0 && (
                <section className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-destructive">
                    Blocking Issues
                  </p>
                  {issues.map((issue) => (
                    <IssueCard key={issue.code} issue={issue} isWarning={false} />
                  ))}
                </section>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <section className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    Warnings
                  </p>
                  {warnings.map((w) => (
                    <IssueCard key={w.code} issue={w} isWarning={true} />
                  ))}
                </section>
              )}

              {/* Separator */}
              {(issues.length > 0 || warnings.length > 0) && checkItems.length > 0 && (
                <Separator />
              )}
    
              {/* All checks */}
              {checkItems.length > 0 && (
                <section className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    All Checks
                  </p>
                  {checkItems.map((key) => (
                    <CheckRow key={key} checkKey={key} check={checks[key]} />
                  ))}
                </section>
              )}

              {/* Timestamp */}
              {data.checkedAt && (
                <p className="text-[10px] text-muted-foreground text-right">
                  Checked at {new Date(data.checkedAt).toLocaleTimeString()}
                  {data.cached && " · cached"}
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t flex-row gap-2 sm:justify-between">
          {!loading && data && !isReady && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCompliance(true)}
              className="gap-2"
            >
              <RefreshCw size={13} />
              Recheck
            </Button>
          )}

          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {isReady ? "Cancel" : "Close"}
            </Button>

            {isReady && (
              <Button
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => { onOpenChange(false); onReady?.(); }}
              >
                <CheckCircle2 size={14} />
                Continue to Create Ad
              </Button>
            )}
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}