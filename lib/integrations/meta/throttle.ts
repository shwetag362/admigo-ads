// lib/integrations/meta/throttle.ts
// Self-throttling for the Meta Marketing API — the pattern big ads platforms use.
// Read rate-limit headers on every response and back off before hitting 100%.
// Docs: x-fb-ads-insights-throttle, X-Business-Use-Case-Usage, X-Ad-Account-Usage.

export interface ThrottleState {
  /** Highest utilization % across all rate-limit signals (0–100+). */
  utilizationPct: number;
  /** True when we're near the limit and should pause/pace requests. */
  shouldBackOff: boolean;
  /** Suggested seconds to wait before the next call (0 if fine). */
  retryAfterSec: number;
}

// Back off once any signal crosses this utilization.
const BACKOFF_THRESHOLD = 90;

function safeParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Derive a throttle decision from Meta's rate-limit response headers.
 * Pass the raw header values (case-insensitive lookup done by the caller).
 */
export function readMetaThrottle(headers: {
  insightsThrottle?: string | null; // x-fb-ads-insights-throttle
  businessUseCase?: string | null; // X-Business-Use-Case-Usage
  adAccountUsage?: string | null; // X-Ad-Account-Usage
}): ThrottleState {
  let utilizationPct = 0;
  let retryAfterSec = 0;

  // x-fb-ads-insights-throttle: { app_id_util_pct, acc_id_util_pct }
  const insights = safeParse<{ app_id_util_pct?: number; acc_id_util_pct?: number }>(
    headers.insightsThrottle,
  );
  if (insights) {
    utilizationPct = Math.max(
      utilizationPct,
      insights.app_id_util_pct ?? 0,
      insights.acc_id_util_pct ?? 0,
    );
  }

  // X-Ad-Account-Usage: { acc_id_util_pct, reset_time_duration, ads_api_access_tier }
  const acct = safeParse<{ acc_id_util_pct?: number; reset_time_duration?: number }>(
    headers.adAccountUsage,
  );
  if (acct) {
    utilizationPct = Math.max(utilizationPct, acct.acc_id_util_pct ?? 0);
    if ((acct.acc_id_util_pct ?? 0) >= BACKOFF_THRESHOLD) {
      retryAfterSec = Math.max(retryAfterSec, acct.reset_time_duration ?? 60);
    }
  }

  // X-Business-Use-Case-Usage: { <bizId>: [{ call_count, total_cputime, total_time,
  //   estimated_time_to_regain_access }] }
  const buc = safeParse<Record<string, Array<Record<string, number>>>>(
    headers.businessUseCase,
  );
  if (buc) {
    for (const entries of Object.values(buc)) {
      for (const e of entries ?? []) {
        utilizationPct = Math.max(
          utilizationPct,
          e.call_count ?? 0,
          e.total_cputime ?? 0,
          e.total_time ?? 0,
        );
        if (e.estimated_time_to_regain_access) {
          retryAfterSec = Math.max(retryAfterSec, e.estimated_time_to_regain_access * 60);
        }
      }
    }
  }

  const shouldBackOff = utilizationPct >= BACKOFF_THRESHOLD || retryAfterSec > 0;
  return { utilizationPct, shouldBackOff, retryAfterSec };
}
