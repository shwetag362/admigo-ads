import { describe, it, expect } from "vitest";
import { readMetaThrottle } from "./throttle";

describe("readMetaThrottle", () => {
  it("reports no back-off when utilization is low", () => {
    const r = readMetaThrottle({
      insightsThrottle: JSON.stringify({ app_id_util_pct: 10, acc_id_util_pct: 5 }),
    });
    expect(r.utilizationPct).toBe(10);
    expect(r.shouldBackOff).toBe(false);
    expect(r.retryAfterSec).toBe(0);
  });

  it("backs off when insights utilization crosses the threshold", () => {
    const r = readMetaThrottle({
      insightsThrottle: JSON.stringify({ app_id_util_pct: 95, acc_id_util_pct: 40 }),
    });
    expect(r.utilizationPct).toBe(95);
    expect(r.shouldBackOff).toBe(true);
  });

  it("uses ad-account reset duration as retryAfter when near limit", () => {
    const r = readMetaThrottle({
      adAccountUsage: JSON.stringify({ acc_id_util_pct: 99, reset_time_duration: 120 }),
    });
    expect(r.shouldBackOff).toBe(true);
    expect(r.retryAfterSec).toBe(120);
  });

  it("converts BUC estimated_time_to_regain_access (minutes) to seconds", () => {
    const r = readMetaThrottle({
      businessUseCase: JSON.stringify({
        "123": [{ call_count: 100, estimated_time_to_regain_access: 5 }],
      }),
    });
    expect(r.shouldBackOff).toBe(true);
    expect(r.retryAfterSec).toBe(300);
  });

  it("is safe on missing / malformed headers", () => {
    const r = readMetaThrottle({ insightsThrottle: "not-json", adAccountUsage: null });
    expect(r.utilizationPct).toBe(0);
    expect(r.shouldBackOff).toBe(false);
  });
});
