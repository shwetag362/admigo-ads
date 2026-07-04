// lib/meta/rateLimiter.js
// In-Memory Rate Limiting
// ============================================

class RateLimiter {
  constructor() {
    this.accountUsage = new Map(); // accountId -> { calls: number, resetAt: timestamp }
    this.CALLS_PER_HOUR = 200;
    this.WINDOW = 60 * 60 * 1000; // 1 hour
  }

  async checkLimit(accountId) {
    const now = Date.now();
    const usage = this.accountUsage.get(accountId);

    if (!usage || now > usage.resetAt) {
      // Reset window
      this.accountUsage.set(accountId, {
        calls: 0,
        resetAt: now + this.WINDOW,
      });
      return { allowed: true, remaining: this.CALLS_PER_HOUR };
    }

    if (usage.calls >= this.CALLS_PER_HOUR) {
      const waitTime = usage.resetAt - now;
      return { 
        allowed: false, 
        remaining: 0,
        waitTime,
        resetAt: usage.resetAt 
      };
    }

    return { 
      allowed: true, 
      remaining: this.CALLS_PER_HOUR - usage.calls 
    };
  }

  recordCall(accountId) {
    const usage = this.accountUsage.get(accountId);
    if (usage) {
      usage.calls++;
    }
  }

  // Adaptive delay based on usage
  getAdaptiveDelay(accountId) {
    const usage = this.accountUsage.get(accountId);
    if (!usage) return 0;

    const usagePercent = (usage.calls / this.CALLS_PER_HOUR) * 100;
    
    if (usagePercent > 90) return 5000; // 5s delay
    if (usagePercent > 75) return 2000; // 2s delay
    if (usagePercent > 50) return 1000; // 1s delay
    return 500; // 500ms delay
  }
}

export const rateLimiter = new RateLimiter();
