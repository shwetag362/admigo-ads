/**
 * AdService — Enterprise Production Ready
 * Facebook Marketing API v24.0
 *
 * ✅ Redis Distributed Rate Limiter (memory fallback for dev)
 * ✅ DB-backed Creative Deduplication (unlimited scale, O(1) lookup)
 * ✅ Policy Pre-Check (15+ rules, blocks violations before FB sees them)
 * ✅ Creative Intelligence Scoring (hook strength, CTR risk, grade A–F)
 * ✅ Single Image / Video Ads
 * ✅ Dynamic Creative — asset_feed_spec
 * ✅ Carousel Ads — child_attachments (2–10 cards)
 * ✅ Collection / Catalog Ads — template_data + product_set_id
 * ✅ Placement-Level Creative Customization — asset_customization_rules
 * ✅ Lead Generation / Instant Form Ads (ON_AD destination)
 * ✅ UTM Tracking on all formats
 * ✅ Full Retry Logic with exponential backoff
 * ✅ Raw payload persistence for rejection debugging
 * ✅ Full FB error unwrapping (code, subcode, user_msg, fbtrace_id)
 * ✅ Adset objective guard — reads Campaign node for objective (AdSet node doesn't expose it)
 * ✅ Null metaAdSetId guard — surfaces before wasting an API call
 * ✅ FB error hint engine — maps every common error code to a plain-English fix
 */

import { FacebookAdsApi, AdAccount, AdVideo, AdSet, Campaign } from "facebook-nodejs-business-sdk";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { validateUrl } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — CONSTANTS & ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export const AD_FORMAT = Object.freeze({
  SINGLE:     "single",
  DYNAMIC:    "dynamic",
  CAROUSEL:   "carousel",
  COLLECTION: "collection",
});

export const API_VERSION = "v24.0";

const MAX_REQUESTS_PER_HOUR  = 200;
const RATE_LIMIT_WINDOW_MS   = 3_600_000;
const RATE_LIMIT_KEY_TTL_S   = 7_200;
const RATE_LIMIT_KEY_PREFIX  = "fb_ratelimit";
const VIDEO_TIMEOUT_MS       = 10 * 60 * 1000;
const VIDEO_POLL_INTERVAL_MS = 5_000;
const IMAGE_UPLOAD_RETRIES   = 3;
const VIDEO_UPLOAD_RETRIES   = 3;
const CREATIVE_API_RETRIES   = 3;
const BATCH_SIZE             = 50;

// "review_feedback" is NOT available at creation time — only via GET after review.
// Requesting it at creation causes: "Tried accessing nonexisting field (review_feedback) on node type (AdCreative)"
const CREATIVE_READ_FIELDS = ["id", "status"];

const VALID_CTAS = [
  "LEARN_MORE", "SHOP_NOW", "SIGN_UP", "DOWNLOAD",
  "BOOK_TRAVEL", "CONTACT_US", "WATCH_MORE", "APPLY_NOW",
  "GET_QUOTE", "SUBSCRIBE", "REGISTER", "GET_OFFER",
  "ORDER_NOW", "BUY_NOW", "GET_SHOWTIMES", "LISTEN_NOW",
];

const FACEBOOK_CDN_DOMAINS = ["fbcdn.net", "fbsbx.com", "facebook.com/rsrc"];

// Periodic in-memory store cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of _memStore.entries()) {
    state.timestamps = state.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (state.timestamps.length === 0) _memStore.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — RATE LIMITER (Redis distributed + memory fallback)
// ═══════════════════════════════════════════════════════════════════════════════

const _memStore = new Map();

function _memThrottle(adAccountId) {
  const now   = Date.now();
  const key   = `${RATE_LIMIT_KEY_PREFIX}:${adAccountId}`;
  const state = _memStore.get(key) ?? { timestamps: [] };
  state.timestamps = state.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (state.timestamps.length >= MAX_REQUESTS_PER_HOUR) {
    const oldest = state.timestamps[0];
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
    _memStore.set(key, state);
    return { allowed: false, waitMs: Math.max(waitMs, 0), remaining: 0, source: "memory" };
  }

  state.timestamps.push(now);
  _memStore.set(key, state);
  return { allowed: true, waitMs: 0, remaining: MAX_REQUESTS_PER_HOUR - state.timestamps.length, source: "memory" };
}

const REDIS_RATE_LIMIT_SCRIPT = `
  local key          = KEYS[1]
  local window_start = tonumber(ARGV[1])
  local now          = tonumber(ARGV[2])
  local max_requests = tonumber(ARGV[3])
  local ttl          = tonumber(ARGV[4])
  redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
  local count = redis.call('ZCARD', key)
  if count >= max_requests then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    return {0, tonumber(oldest[2]) or now, count}
  end
  redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
  redis.call('EXPIRE', key, ttl)
  return {1, now, redis.call('ZCARD', key)}
`;

async function _redisThrottle(redis, adAccountId) {
  const now         = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const key         = `${RATE_LIMIT_KEY_PREFIX}:${adAccountId}`;
  const [allowed, oldestScore, count] = await redis.eval(
    REDIS_RATE_LIMIT_SCRIPT, 1, key,
    windowStart, now, MAX_REQUESTS_PER_HOUR, RATE_LIMIT_KEY_TTL_S
  );
  if (!allowed) {
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - Number(oldestScore));
    return { allowed: false, waitMs: Math.max(waitMs, 0), remaining: 0, source: "redis" };
  }
  return { allowed: true, waitMs: 0, remaining: MAX_REQUESTS_PER_HOUR - Number(count), source: "redis" };
}

async function _throttle(adAccountId, redis = null) {
  let result;
  if (redis) {
    try {
      result = await _redisThrottle(redis, adAccountId);
    } catch (err) {
      logger.warn("[RateLimit] Redis error — falling back to memory", { err: err.message });
      result = _memThrottle(adAccountId);
    }
  } else {
    result = _memThrottle(adAccountId);
  }
  if (!result.allowed) {
    const waitSec = Math.ceil(result.waitMs / 1000);
    logger.warn(`[RateLimit] ${adAccountId} (${result.source}) — throttled, waiting ${waitSec}s`);
    await _delay(result.waitMs);
  } else {
    logger.debug(`[RateLimit] OK — ${result.remaining} remaining (${result.source})`);
  }
}

async function _getRateLimitStatus(adAccountId, redis = null) {
  const now = Date.now();
  const key = `${RATE_LIMIT_KEY_PREFIX}:${adAccountId}`;
  if (redis) {
    try {
      await redis.zremrangebyscore(key, "-inf", now - RATE_LIMIT_WINDOW_MS);
      const count = await redis.zcard(key);
      return { used: count, remaining: Math.max(0, MAX_REQUESTS_PER_HOUR - count), limit: MAX_REQUESTS_PER_HOUR, source: "redis" };
    } catch (err) {
      logger.warn("[RateLimit] Redis status check failed", { err: err.message });
    }
  }
  const state  = _memStore.get(key);
  const active = state ? state.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS).length : 0;
  return { used: active, remaining: Math.max(0, MAX_REQUESTS_PER_HOUR - active), limit: MAX_REQUESTS_PER_HOUR, source: "memory" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — CREATIVE DEDUPLICATION (DB-backed, O(1), unlimited scale)
// ═══════════════════════════════════════════════════════════════════════════════

function _buildFingerprint(creativeData, mediaHash, adFormat) {
  let parts;
  switch (adFormat) {
    case AD_FORMAT.DYNAMIC: {
      const f = creativeData.assetFeed ?? {};
      parts = [
        "dynamic",
        (f.bodies  ?? []).slice().sort().join("||").slice(0, 200),
        (f.titles  ?? []).slice().sort().join("||").slice(0, 100),
        (f.images  ?? []).map((i) => i.hash || i.url).sort().join(","),
        (f.videos  ?? []).map((v) => v.videoId || v.url).sort().join(","),
        creativeData.callToAction,
        creativeData.websiteUrl,
      ];
      break;
    }
    case AD_FORMAT.CAROUSEL: {
      const cards = creativeData.cards ?? [];
      parts = [
        "carousel",
        cards.length,
        cards.map((c) => `${c.link ?? ""}:${c.headline ?? ""}:${c.imageHash ?? c.videoId ?? c.imageUrl ?? ""}`).join("|"),
        creativeData.callToAction,
        creativeData.websiteUrl,
      ];
      break;
    }
    case AD_FORMAT.COLLECTION:
      parts = [
        "collection",
        mediaHash ?? "",
        creativeData.productSetId ?? "",
        (creativeData.headline    ?? "").slice(0, 40),
        (creativeData.primaryText ?? "").slice(0, 50),
        creativeData.callToAction,
        creativeData.websiteUrl,
      ];
      break;
    default:
      parts = [
        "single",
        mediaHash ?? "",
        (creativeData.primaryText ?? "").slice(0, 50),
        (creativeData.headline    ?? "").slice(0, 40),
        creativeData.callToAction,
        creativeData.websiteUrl,
        // Include leadFormId in fingerprint so lead gen creatives are distinct
        creativeData.leadFormId ?? "",
      ];
  }
  return parts.join("|");
}

async function _findDuplicate(fingerprint, adAccountId) {
  try {
    const record = await prisma.creativeFingerprint.findFirst({
      where:  { fingerprint, adAccountId, status: "ACTIVE" },
      select: { id: true, metaCreativeId: true, useCount: true },
    });
    if (!record) return null;

    prisma.creativeFingerprint
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date(), useCount: { increment: 1 } } })
      .catch((e) => logger.warn("[Dedup] useCount update failed", { err: e.message }));

    logger.info("[Dedup] Reusing existing creative", {
      metaCreativeId: record.metaCreativeId,
      useCount:       record.useCount + 1,
    });
    return { metaCreativeId: record.metaCreativeId };
  } catch (err) {
    logger.warn("[Dedup] Lookup failed — will create new creative", { err: err.message });
    return null;
  }
}

async function _saveFingerprint({ fingerprint, metaCreativeId, adAccountId, adFormat }) {
  try {
    await prisma.creativeFingerprint.upsert({
      where:  { fingerprint },
      create: { fingerprint, metaCreativeId, adAccountId, adFormat, status: "ACTIVE" },
      update: { metaCreativeId, status: "ACTIVE", lastUsedAt: new Date(), useCount: { increment: 1 } },
    });
  } catch (err) {
    logger.warn("[Dedup] Save fingerprint failed", { err: err.message });
  }
}

async function _invalidateFingerprint(metaCreativeId) {
  try {
    const result = await prisma.creativeFingerprint.updateMany({
      where: { metaCreativeId },
      data:  { status: "INACTIVE" },
    });
    logger.info("[Dedup] Fingerprint invalidated", { metaCreativeId, recordsUpdated: result.count });
  } catch (err) {
    logger.warn("[Dedup] Invalidate failed", { err: err.message });
  }
}

async function _getDedupStats(adAccountId) {
  try {
    const [total, active, agg] = await Promise.all([
      prisma.creativeFingerprint.count({ where: { adAccountId } }),
      prisma.creativeFingerprint.count({ where: { adAccountId, status: "ACTIVE" } }),
      prisma.creativeFingerprint.aggregate({ where: { adAccountId }, _sum: { useCount: true } }),
    ]);
    const served = agg._sum.useCount ?? 0;
    return {
      totalCreatives:  total,
      activeCreatives: active,
      totalServed:     served,
      savedApiCalls:   Math.max(0, served - total),
    };
  } catch (err) {
    logger.warn("[Dedup] Stats query failed", { err: err.message });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — POLICY PRE-CHECK
// ═══════════════════════════════════════════════════════════════════════════════

const POLICY_RULES = [
  { id: "before_after",          severity: "block", category: "Prohibited Content",  pattern: /\b(before\s+and\s+after|before\s*\/\s*after|transformation\s+results?)\b/i,                                 message: "Before/after transformation claims are prohibited.",              suggestion: "Focus on product benefit without comparison framing." },
  { id: "guaranteed_results",    severity: "block", category: "Misleading Claims",   pattern: /\b(guaranteed?\s+(results?|income|earnings?|weight\s+loss|cure|fix)|100%\s+guaranteed?)\b/i,                 message: "Guaranteed result claims are not allowed.",                        suggestion: "Use 'proven approach' or 'results may vary'." },
  { id: "miracle_claims",        severity: "block", category: "Health Claims",       pattern: /\b(miracle\s+(cure|pill|solution|treatment)|magic\s+(pill|solution)|instant\s+(cure|heal))\b/i,              message: "Miracle/magic health claims violate Facebook policies.",            suggestion: "Describe what the product does without superlative claims." },
  { id: "personal_attributes",   severity: "block", category: "Personal Attributes", pattern: /\b(you\s+(are|were|look)\s+(fat|overweight|ugly|old|depressed|anxious|broke|poor|single|lonely))\b/i,        message: "Ad copy cannot imply negative personal attributes of the viewer.", suggestion: "Reframe to product benefit: 'Achieve your fitness goals'." },
  { id: "get_rich_quick",        severity: "block", category: "Financial Claims",    pattern: /\b(make\s+\$[\d,]+\s+(a\s+day|per\s+day|daily|weekly)|get\s+rich\s+quick|passive\s+income\s+of\s+\$|earn\s+\$[\d,]+\s+from\s+home)\b/i, message: "Specific earning claims are prohibited.",                   suggestion: "Remove dollar amounts. Use 'earn more' or 'grow your income'." },
  { id: "weight_loss_numbers",   severity: "block", category: "Health Claims",       pattern: /\b(lose\s+\d+\s*(lbs?|pounds?|kg)\s+(in\s+\d+\s*(days?|weeks?|months?))?)\b/i,                              message: "Specific weight loss number/timeframe claims are prohibited.",     suggestion: "Use 'support your weight loss journey' without numbers." },
  { id: "crypto_restricted",     severity: "warn",  category: "Restricted Vertical", pattern: /\b(buy\s+(bitcoin|crypto|ethereum|nft)|crypto\s+trading|defi\s+(profits?|gains?|earnings?))\b/i,            message: "Cryptocurrency ads require Facebook written permission.",           suggestion: "Ensure your account has crypto advertising authorization." },
  { id: "adult_content",         severity: "block", category: "Adult Content",       pattern: /\b(sexy|seductive|hot\s+(singles?|girls?|guys?|women|men)|hookup|dating\s+(hot|sexy))\b/i,                   message: "Sexually suggestive language is not allowed.",                     suggestion: "Use neutral, professional language." },
  { id: "weapons",               severity: "block", category: "Prohibited Products", pattern: /\b(buy\s+(guns?|firearms?|ammo|ammunition)|weapon\s+sale|gun\s+shop|silencers?)\b/i,                         message: "Weapon and ammunition sales are not allowed on Facebook.",         suggestion: "This product category cannot be advertised on Facebook." },
  { id: "tobacco",               severity: "block", category: "Prohibited Products", pattern: /\b(buy\s+(cigarettes?|cigars?|vapes?|vaping|e-cigs?|tobacco)|best\s+vape)\b/i,                               message: "Tobacco and vaping products are prohibited.",                      suggestion: "This product category cannot be advertised on Facebook." },
  { id: "trademark_competitor",  severity: "warn",  category: "Trademark",           pattern: /\b(better\s+than\s+google|google\s+killer|replace\s+google)\b/i,                                             message: "References to competitor trademarks can trigger rejection.",       suggestion: "Remove competitor brand names from ad copy." },
  { id: "sensationalism",        severity: "block", category: "Sensationalism",      pattern: /\b(doctors?\s+(hate|don'?t\s+want\s+you)|this\s+(one\s+weird\s+trick|secret)|(shocking|insane|unbelievable)\s+(results?|trick|method))\b/i, message: "Clickbait/sensationalist copy is prohibited.",               suggestion: "Use clear, factual benefit statements." },
  { id: "excessive_caps",        severity: "warn",  category: "Format Quality",      pattern: /[A-Z]{6,}/,                                                                                                   message: "Excessive ALL CAPS may reduce quality score.",                     suggestion: "Limit caps to brand names or 1–2 emphasis words." },
  { id: "excessive_exclamation", severity: "warn",  category: "Format Quality",      pattern: /!{2,}/,                                                                                                       message: "Multiple exclamation marks reduce credibility.",                   suggestion: "Use a maximum of one exclamation mark per copy piece." },
  { id: "deceptive_free",        severity: "block", category: "Deceptive Practices", pattern: /\b(completely\s+free|100%\s+free|absolutely\s+free)\s+(iphone|macbook|gift\s+card|cash)\b/i,                  message: "Deceptive 'free' product offers are prohibited.",                  suggestion: "If offering a genuine free item, include clear terms." },
];

function _policyPreCheck(creativeData, adFormat) {
  const textFields = [];

  if (creativeData.primaryText) textFields.push({ field: "primaryText", text: creativeData.primaryText });
  if (creativeData.headline)    textFields.push({ field: "headline",    text: creativeData.headline });
  if (creativeData.description) textFields.push({ field: "description", text: creativeData.description });

  if (adFormat === AD_FORMAT.DYNAMIC && creativeData.assetFeed) {
    (creativeData.assetFeed.bodies       ?? []).forEach((t, i) => textFields.push({ field: `assetFeed.bodies[${i}]`,       text: t }));
    (creativeData.assetFeed.titles       ?? []).forEach((t, i) => textFields.push({ field: `assetFeed.titles[${i}]`,       text: t }));
    (creativeData.assetFeed.descriptions ?? []).forEach((t, i) => textFields.push({ field: `assetFeed.descriptions[${i}]`, text: t }));
  }
  if (adFormat === AD_FORMAT.CAROUSEL && creativeData.cards) {
    creativeData.cards.forEach((c, i) => {
      if (c.headline)    textFields.push({ field: `cards[${i}].headline`,    text: c.headline });
      if (c.description) textFields.push({ field: `cards[${i}].description`, text: c.description });
    });
  }

  const blocks = [], warnings = [];
  for (const { field, text } of textFields) {
    for (const rule of POLICY_RULES) {
      if (rule.pattern.test(text)) {
        const hit = { ruleId: rule.id, field, category: rule.category, message: rule.message, suggestion: rule.suggestion, matchedText: text.slice(0, 100) };
        rule.severity === "block" ? blocks.push(hit) : warnings.push(hit);
      }
    }
  }

  const passed = blocks.length === 0;
  if (!passed)              logger.warn("[Policy] BLOCKED",  { blockCount: blocks.length, categories: [...new Set(blocks.map((b) => b.category))] });
  else if (warnings.length) logger.warn("[Policy] WARNINGS", { warnCount: warnings.length });
  else                      logger.info("[Policy] PASSED");

  return { passed, blocks, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — CREATIVE INTELLIGENCE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

const HOOK_POWER_WORDS = ["new","free","now","proven","easy","fast","save","exclusive","limited","discover","secret","revealed","instant","boost","transform","unlock","results","trusted","join"];
const WEAK_WORDS       = ["maybe","perhaps","might","could","possibly","sometimes","generally","basically","kind of","sort of"];
const EMOJI_REGEX      = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

function _scoreHook(text) {
  if (!text) return { score: 0, signals: [] };
  const lower = text.toLowerCase();
  const signals = [];
  let score = 50;
  const power = HOOK_POWER_WORDS.filter((w) => lower.includes(w));
  if (power.length) { score += Math.min(power.length * 5, 25); signals.push(`Power words: ${power.slice(0, 3).join(", ")}`); }
  const weak = WEAK_WORDS.filter((w) => lower.includes(w));
  if (weak.length)  { score -= weak.length * 8; signals.push(`Weak language: ${weak.join(", ")}`); }
  if (/\?/.test(text))        { score += 8; signals.push("Question hook (good for engagement)"); }
  if (/\d+/.test(text))       { score += 6; signals.push("Contains number (builds specificity)"); }
  if (EMOJI_REGEX.test(text)) { score += 5; signals.push("Emoji present (boosts mobile CTR)"); }
  const words = text.split(/\s+/).length;
  if (words < 5)  { score -= 10; signals.push("Very short — may lack context for cold audiences"); }
  if (words > 50) { score -= 8;  signals.push("Long copy — better for warm audiences"); }
  return { score: Math.min(100, Math.max(0, score)), signals };
}

function _jaccard(a, b) {
  const sa = new Set(a.split(/\s+/)), sb = new Set(b.split(/\s+/));
  const intersection = [...sa].filter((x) => sb.has(x)).length;
  return intersection / (sa.size + sb.size - intersection);
}

function _scoreTextValue(primaryText, headline) {
  const issues = [];
  let score = 100;
  if (headline) {
    if (!/\b(get|save|find|discover|start|join|try|learn|build|grow|make|use|buy|see|watch)\b/i.test(headline)) {
      score -= 15;
      issues.push("Headline lacks an action verb");
    }
    if (headline.length < 10) { score -= 10; issues.push("Headline too short"); }
  }
  if (primaryText && headline && _jaccard(primaryText.toLowerCase(), headline.toLowerCase()) > 0.6) {
    score -= 20;
    issues.push("Primary text and headline too similar — each should communicate different value");
  }
  return { score: Math.max(0, score), issues };
}

function _detectFatigue(creativeData) {
  const warnings = [];
  if (creativeData.callToAction === "LEARN_MORE") warnings.push({ type: "generic_cta",         message: "LEARN_MORE is the most overused CTA — consider SHOP_NOW, SIGN_UP, or GET_OFFER" });
  if (!creativeData.description)                  warnings.push({ type: "missing_description", message: "No description — adds context and expands ad real estate" });
  if (!creativeData.placementAssets)              warnings.push({ type: "no_placement_assets", message: "No placement-specific assets — story/reels will use cropped feed images" });
  return warnings;
}

function _dynamicDiversityTips(assetFeed) {
  if (!assetFeed) return [];
  const tips = [];
  if ((assetFeed.bodies  ?? []).length < 3) tips.push("Add 3–5 primary texts for better Meta auto-optimization");
  if ((assetFeed.titles  ?? []).length < 3) tips.push("Add 3–5 headlines — more combinations = more data");
  if ((assetFeed.images  ?? []).length + (assetFeed.videos ?? []).length < 3) tips.push("Add 3+ media assets — Meta needs variety to find the winner");
  if ((assetFeed.descriptions ?? []).length < 2) tips.push("Add 2+ descriptions for maximum combination coverage");
  return tips;
}

function _scoreCreative(creativeData, adFormat) {
  const hook    = _scoreHook(_scoreFirstBody(creativeData, adFormat));
  const tv      = _scoreTextValue(creativeData.primaryText, creativeData.headline);
  const fatigue = _detectFatigue(creativeData);
  const dynTips = adFormat === AD_FORMAT.DYNAMIC ? _dynamicDiversityTips(creativeData.assetFeed) : [];

  const highIntent = ["SHOP_NOW","BUY_NOW","GET_OFFER","ORDER_NOW","GET_QUOTE"];
  const midIntent  = ["SIGN_UP","SUBSCRIBE","REGISTER","APPLY_NOW","DOWNLOAD"];
  const ctaIntent  = highIntent.includes(creativeData.callToAction) ? "high" : midIntent.includes(creativeData.callToAction) ? "medium" : "low";

  const fatiguePenalty = Math.min(fatigue.length * 5, 20);
  const dynBonus       = adFormat === AD_FORMAT.DYNAMIC ? (3 - Math.min(dynTips.length, 3)) * 3 : 0;
  const overallScore   = Math.round(hook.score * 0.4 + tv.score * 0.3 + (100 - fatiguePenalty) * 0.3 + dynBonus);
  const grade          = overallScore >= 80 ? "A" : overallScore >= 65 ? "B" : overallScore >= 50 ? "C" : overallScore >= 35 ? "D" : "F";

  const suggestions = [
    ...hook.signals.filter((s) => /weak|short|lacks/i.test(s)),
    ...tv.issues,
    ...fatigue.map((w) => w.message),
    ...dynTips,
  ].slice(0, 5);

  logger.info("[Score] Creative graded", { grade, score: overallScore });
  return { overallScore, grade, hookStrength: hook, textToValueRatio: tv, fatigueWarnings: fatigue, dynamicDiversityTips: dynTips, ctaIntelligence: { intent: ctaIntent }, suggestions };
}

function _scoreFirstBody(creativeData, adFormat) {
  if (adFormat === AD_FORMAT.DYNAMIC) return creativeData.assetFeed?.bodies?.[0] ?? "";
  return creativeData.primaryText ?? "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — GENERAL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function _delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function _mkError(message, statusCode = 500, details = null) {
  const e = new Error(message);
  e.statusCode = statusCode;
  if (details) e.details = details;
  return e;
}

function _isRetryable(error) {
  const code = error?.code ?? error?.error?.code;
  return [1, 2, 4, 17, 32, 80, 190, 341, 368].includes(code);
}

function _isFbCDN(url) {
  if (!url) return false;
  try { return FACEBOOK_CDN_DOMAINS.some((d) => new URL(url).hostname.endsWith(d)); }
  catch { return false; }
}

function _buildUTM(adName, campaignName = "") {
  return [
    "utm_source=facebook",
    "utm_medium=paid_social",
    `utm_campaign=${encodeURIComponent(campaignName || "{{campaign.name}}")}`,
    `utm_content=${encodeURIComponent(adName || "{{ad.name}}")}`,
    "utm_term={{adset.name}}",
  ].join("&");
}

function _appendUTM(url, adName, campaignName) {
  try {
    const u   = new URL(url);
    const utm = _buildUTM(adName, campaignName);
    return `${url}${u.search ? "&" : "?"}${utm}`;
  } catch { return url; }
}

function _detectMediaType(creativeData) {
  const videoUrl = creativeData.videoUrl || creativeData.mediaUrl;
  return (
    creativeData.videoId ||
    creativeData.videoUrl ||
    (videoUrl && /\.(mp4|mov|avi|mkv|webm)/i.test(videoUrl)) ||
    (videoUrl && videoUrl.toLowerCase().includes("video"))
  ) ? "video" : "image";
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — FACEBOOK ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Deeply unwraps a Facebook SDK error into a structured object.
 * The facebook-nodejs-business-sdk nests errors in err.response.data.error
 * or err.error depending on the method called.
 */
function _unwrapFbError(err) {
  // Try every known nesting pattern the SDK uses
  const body = err?.response?.data ?? err?.response ?? err?.error ?? null;

  const code       = body?.error?.code       ?? body?.code       ?? err?.code       ?? null;
  const type       = body?.error?.type       ?? body?.type       ?? err?.type       ?? null;
  const message    = body?.error?.message    ?? body?.message    ?? err?.message    ?? "Unknown Facebook error";
  const subcode    = body?.error?.error_subcode ?? body?.error_subcode ?? null;
  const userMsg    = body?.error?.error_user_msg  ?? body?.error_user_msg  ?? null;
  const userTitle  = body?.error?.error_user_title ?? body?.error_user_title ?? null;
  const traceId    = body?.error?.fbtrace_id  ?? body?.fbtrace_id  ?? null;
  const isTransient = body?.error?.is_transient ?? body?.is_transient ?? false;

  return { code, type, message, subcode, userMsg, userTitle, traceId, isTransient, raw: body };
}

/**
 * Maps common FB error codes / messages → plain-English fix hints.
 * Displayed in logs and surfaced in error.details.hint.
 */
function _fbErrorHint(code, message = "", context = "", subcode = null) {
  const msg  = (message ?? "").toLowerCase();
  const ctx  = (context ?? "").toLowerCase();
  const num  = Number(code);
  const sub  = Number(subcode);

  // ── Subcode 3390001 — Missing lead form (most precise match) ────────────────
  // This is the exact subcode Facebook returns when you try to attach a
  // link_data creative (website destination) to a LEADS objective adset.
  if (sub === 3390001) {
    return "FB subcode 3390001 — Missing lead form. " +
           "The adset uses LEAD_GENERATION objective (ON_AD destination) but the creative has no Instant Form. " +
           "Add creativeData.leadFormId = '<facebook_instant_form_id>' to your request. " +
           "Find your form IDs at: https://www.facebook.com/ads/manage/leads/";
  }

  // ── Code 100 — Invalid parameter (most common, sub-match on message) ────────
  if (num === 100) {
    if (msg.includes("lead") || msg.includes("lead_gen_form") || msg.includes("instant form"))
      return "This adset uses LEAD_GENERATION / ON_AD destination. " +
             "The creative must include a leadFormId (Facebook Instant Form ID). " +
             "Pass creativeData.leadFormId = '<your_form_id>'. " +
             "Find form IDs at: https://www.facebook.com/ads/manage/leads/";
    if (msg.includes("adset") || ctx === "createad")
      return "adset_id is invalid, not yet published to Facebook, or belongs to a different ad account. " +
             "Confirm metaAdSetId is non-null and was published before creating ads.";
    if (msg.includes("creative"))
      return "creative_id is invalid, belongs to a different ad account, or was rejected. " +
             "Try invalidating the fingerprint and creating a fresh creative.";
    if (msg.includes("page"))
      return "The page_id in the creative does not match the page connected to this ad account. " +
             "Confirm creativeData.pageId or adAccount.metaPageId is correct.";
    if (msg.includes("destination"))
      return "The adset destination_type is incompatible with the creative format. " +
             "LEAD_GENERATION adsets require ON_AD destination + lead_gen_form_id.";
    if (msg.includes("status") || msg.includes("deleted"))
      return "Cannot create an ad under a paused, archived, or deleted campaign/adset. " +
             "Verify the adset status in Facebook Ads Manager.";
    if (msg.includes("image") || msg.includes("hash"))
      return "The image_hash is invalid or does not belong to this ad account. " +
             "Re-upload the image via createAdImage and use the returned hash.";
    if (msg.includes("video"))
      return "The video_id is invalid or not yet processed. " +
             "Wait for video status=ready before using it in a creative.";
    if (msg.includes("url") || msg.includes("link"))
      return "The URL is malformed, uses a redirect chain FB can't follow, or is on a restricted domain.";
    return "Generic 'Invalid parameter' (code 100). Check adset_id, creative_id, page_id, image_hash, " +
           "and that all belong to the same ad account. Enable full FB error logging to see the raw response.";
  }

  // ── Code 1487742 / 1487390 — Lead form issues ──────────────────────────────
  if (num === 1487742) return "The lead_gen_form_id does not exist or is not connected to this page.";
  if (num === 1487390) return "LEAD_GENERATION destination requires the creative CTA value to reference a Facebook Lead Form, not a URL.";

  // ── Auth / Permission ───────────────────────────────────────────────────────
  if (num === 200) return "Permission denied — the access token lacks ads_management or ads_read scope, or is for the wrong ad account.";
  if (num === 190) return "Access token expired or invalid. Re-authenticate via Facebook OAuth and persist the new token.";
  if (num === 102) return "Session key invalid or no longer valid. Force a re-login.";

  // ── Rate limiting ───────────────────────────────────────────────────────────
  if (num === 17 || num === 4)   return "User or app-level rate limit hit. Back off and retry with exponential delay.";
  if (num === 32)                return "Page-level rate limit hit on this ad account. Wait before retrying.";
  if (num === 80)                return "Ad account spending limit reached. Check account billing in Ads Manager.";

  // ── Transient / server errors ───────────────────────────────────────────────
  if (num === 1 || num === 2)    return "Temporary Facebook service error. Safe to retry with exponential backoff.";
  if (num === 341)               return "Ad creation temporary block — too many ads created in a short window. Wait 5–10 min.";
  if (num === 368)               return "Temporarily blocked from posting content — usually triggers after policy violations. Review account health.";

  // ── Creative / policy ──────────────────────────────────────────────────────
  if (num === 1815527)           return "The creative was rejected during pre-submission policy checks. Review ad copy for policy violations.";
  if (num === 1885057)           return "Image ratio is not supported for the selected placement. Use 1:1, 4:5, or 16:9.";
  if (num === 1487470)           return "Lead ad form is archived or inactive. Reactivate the form in Facebook Lead Ads Forms library.";

  return `Unknown FB error code ${code}. Check https://developers.facebook.com/docs/graph-api/guides/error-handling/ for details.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — ADSET OBJECTIVE GUARD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetches live objective + destination_type for the adset.
 *
 * IMPORTANT FB API QUIRK (confirmed v24.0):
 *   "objective" lives on the CAMPAIGN node, NOT the AdSet node.
 *   Requesting it on AdSet throws: "(#100) Tried accessing nonexisting field (objective)"
 *   "destination_type" DOES live on the AdSet node.
 *
 * Strategy:
 *   1. Read AdSet fields: destination_type, status, effective_status, name, campaign_id
 *   2. Use campaign_id to read Campaign fields: objective
 *
 * Non-blocking — if either read fails we log and skip the guard gracefully.
 */
async function _fetchAdSetMeta(adSetId, adAccountId, redis) {
  if (!adSetId) return null;

  let adsetData = null;
  let objective = null;

  // ── Step A: Read AdSet (destination_type IS available here) ─────────────────
  try {
    await _throttle(adAccountId, redis);
    adsetData = await new AdSet(adSetId).read([
      "destination_type",
      "status",
      "effective_status",
      "name",
      "campaign_id",          // needed to look up objective on Campaign
    ]);
    logger.debug("[AdSet] AdSet fields fetched", {
      adSetId,
      name:            adsetData.name,
      destinationType: adsetData.destination_type,
      status:          adsetData.effective_status ?? adsetData.status,
      campaignId:      adsetData.campaign_id,
    });
  } catch (err) {
    const fb = _unwrapFbError(err);
    logger.warn("[AdSet] Could not read AdSet fields — skipping objective guard", {
      adSetId,
      fb_code: fb.code,
      fb_msg:  fb.message,
      hint:    "Ensure the access token has ads_read scope for this ad account.",
    });
    return null;
  }

  // ── Step B: Read Campaign objective via campaign_id ──────────────────────────
  if (adsetData?.campaign_id) {
    try {
      await _throttle(adAccountId, redis);
      const campaign = await new Campaign(adsetData.campaign_id).read(["objective"]);
      objective = campaign.objective ?? null;
      logger.debug("[AdSet] Campaign objective fetched", {
        campaignId: adsetData.campaign_id,
        objective,
      });
    } catch (err) {
      const fb = _unwrapFbError(err);
      // Non-fatal — we still have destination_type from the adset
      logger.warn("[AdSet] Could not read Campaign objective — guard will use destination_type only", {
        campaignId: adsetData.campaign_id,
        fb_code:    fb.code,
        fb_msg:     fb.message,
      });
    }
  }

  const meta = {
    objective:       objective,
    destinationType: adsetData.destination_type ?? null,
    status:          adsetData.effective_status ?? adsetData.status ?? null,
    name:            adsetData.name ?? null,
    campaignId:      adsetData.campaign_id ?? null,
  };

  logger.info("[AdSet] Live meta resolved", {
    adSetId,
    name:            meta.name,
    objective:       meta.objective,
    destinationType: meta.destinationType,
    status:          meta.status,
  });

  return meta;
}

/**
 * Validates the creative data matches what the adset expects.
 * Throws 400 with a clear, actionable message on mismatch.
 */
function _guardObjectiveCreativeMismatch(adSetMeta, creativeData) {
  if (!adSetMeta) return; // couldn't fetch — skip guard gracefully

  const { objective, destinationType, status } = adSetMeta;

  // Adset must be live / eligible
  if (status === "DELETED") {
    throw _mkError(
      "The adset is DELETED on Facebook. Create a new adset before adding ads.",
      400,
      { adSetMeta, fix: "Create a new adset and store its metaAdSetId before calling create()." }
    );
  }
  if (status === "ARCHIVED") {
    throw _mkError(
      "The adset is ARCHIVED on Facebook and cannot receive new ads.",
      400,
      { adSetMeta, fix: "Unarchive the adset in Ads Manager or create a new one." }
    );
  }

  // Lead Gen objective requires leadFormId.
  // Facebook uses "LEAD_GENERATION" in v24.0 API responses.
  // destination_type "ON_AD" alone is also sufficient to require a lead form.
  const isLeadObjective = objective === "LEAD_GENERATION" || objective === "LEADS";
  const isOnAdDest      = destinationType === "ON_AD";

  if ((isLeadObjective || isOnAdDest) && !creativeData.leadFormId) {
    throw _mkError(
      `Objective/creative mismatch detected before hitting Facebook. ` +
      `Adset objective="${objective}", destination_type="${destinationType}" — ` +
      `this is a LEAD_GENERATION campaign and requires an Instant Form. ` +
      `Add creativeData.leadFormId = '<facebook_instant_form_id>' to your request. ` +
      `Find your form IDs at: https://www.facebook.com/ads/manage/leads/`,
      400,
      {
        adSetMeta,
        isLeadObjective,
        isOnAdDest,
        fix:         "Add creativeData.leadFormId = '<facebook_instant_form_id>' to the request body.",
        docsUrl:     "https://developers.facebook.com/docs/marketing-api/guides/lead-ads",
        formLibrary: "https://www.facebook.com/ads/manage/leads/",
      }
    );
  }

  // Website destination with leadFormId doesn't make sense — warn, don't block
  if (destinationType === "WEBSITE" && creativeData.leadFormId) {
    logger.warn(
      "[Guard] creativeData.leadFormId is set but adset destination_type is WEBSITE. " +
      "leadFormId will be ignored — creative will use link_data with websiteUrl.",
      { adSetMeta, leadFormId: creativeData.leadFormId }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — INPUT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

function _validateInput(data) {
  const { adSetDraftId, creativeData, adFormat = AD_FORMAT.SINGLE } = data ?? {};

  if (!adSetDraftId) throw _mkError("adSetDraftId is required", 400);
  if (!creativeData || typeof creativeData !== "object") throw _mkError("creativeData is required", 400);

  ["name", "websiteUrl", "callToAction"].forEach((f) => {
    if (!creativeData[f]) throw _mkError(`${f} is required`, 400);
  });
  if (!validateUrl(creativeData.websiteUrl))           throw _mkError("Invalid website URL", 400);
  if (!VALID_CTAS.includes(creativeData.callToAction)) throw _mkError(`Invalid CTA. Valid: ${VALID_CTAS.join(", ")}`, 400);

  switch (adFormat) {
    case AD_FORMAT.SINGLE: {
      if (!creativeData.primaryText) throw _mkError("primaryText is required", 400);
      if (!creativeData.headline)    throw _mkError("headline is required", 400);
      const hasMedia = creativeData.imageUrl || creativeData.imageHash || creativeData.videoUrl || creativeData.mediaUrl || creativeData.videoId;
      if (!hasMedia) throw _mkError("Image or video media is required", 400);
      if (creativeData.imageUrl && !validateUrl(creativeData.imageUrl)) throw _mkError("Invalid imageUrl", 400);
      const vUrl = creativeData.videoUrl || creativeData.mediaUrl;
      if (vUrl && !validateUrl(vUrl)) throw _mkError("Invalid video URL", 400);
      if (creativeData.primaryText.length > 500) throw _mkError("primaryText max 500 chars", 400);
      if (creativeData.headline.length    > 100) throw _mkError("headline max 100 chars", 400);
      // Lead Gen validation
      if (creativeData.leadFormId && typeof creativeData.leadFormId !== "string")
        throw _mkError("leadFormId must be a string (Facebook Lead Form ID)", 400);
      break;
    }
    case AD_FORMAT.DYNAMIC: {
      const f = creativeData.assetFeed;
      if (!f) throw _mkError("assetFeed is required", 400);
      if (!Array.isArray(f.bodies) || !f.bodies.length) throw _mkError("assetFeed.bodies: min 1 item", 400);
      if (!Array.isArray(f.titles) || !f.titles.length) throw _mkError("assetFeed.titles: min 1 item", 400);
      if (!f.images?.length && !f.videos?.length) throw _mkError("assetFeed: at least 1 image or video required", 400);
      if (f.bodies.length > 5) throw _mkError("assetFeed.bodies: max 5", 400);
      if (f.titles.length > 5) throw _mkError("assetFeed.titles: max 5", 400);
      if ((f.images?.length ?? 0) + (f.videos?.length ?? 0) > 10) throw _mkError("assetFeed: max 10 total media assets", 400);
      break;
    }
    case AD_FORMAT.CAROUSEL: {
      const cards = creativeData.cards;
      if (!Array.isArray(cards) || cards.length < 2) throw _mkError("Carousel requires at least 2 cards", 400);
      if (cards.length > 10) throw _mkError("Carousel max 10 cards", 400);
      cards.forEach((c, i) => {
        if (!c.imageUrl && !c.imageHash && !c.videoId && !c.videoUrl) throw _mkError(`cards[${i}]: media required`, 400);
        if (!c.link && !creativeData.websiteUrl) throw _mkError(`cards[${i}]: link required`, 400);
      });
      break;
    }
    case AD_FORMAT.COLLECTION: {
      if (!creativeData.productSetId) throw _mkError("productSetId is required", 400);
      if (!creativeData.primaryText)  throw _mkError("primaryText is required", 400);
      if (!creativeData.headline)     throw _mkError("headline is required", 400);
      const hasMedia = creativeData.imageUrl || creativeData.imageHash || creativeData.videoUrl || creativeData.videoId;
      if (!hasMedia) throw _mkError("Cover image or video required", 400);
      break;
    }
    default: throw _mkError(`Unknown adFormat: ${adFormat}`, 400);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — MEDIA UPLOAD & RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function _uploadImage(fbAccount, imageUrl, adAccountId, redis, retries = IMAGE_UPLOAD_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    await _throttle(adAccountId, redis);
    try {
      logger.debug(`[Media] Uploading image (attempt ${attempt}/${retries})`, { imageUrl: imageUrl.slice(0, 80) });
      const res    = await fbAccount.createAdImage([], { url: imageUrl });
      const images = res?.images;
      if (!images) throw _mkError("Unexpected image upload response — no 'images' key", 500, { raw: res });
      const hash   = images[Object.keys(images)[0]]?.hash;
      if (!hash)   throw _mkError("No hash in image upload response", 500, { raw: images });
      logger.info("[Media] Image uploaded successfully", { hash });
      return hash;
    } catch (err) {
      const fb = _unwrapFbError(err);
      logger.warn(`[Media] Image upload attempt ${attempt} failed`, {
        err:      err.message,
        fb_code:  fb.code,
        fb_msg:   fb.message,
        fb_trace: fb.traceId,
        hint:     _fbErrorHint(fb.code, fb.message, "uploadImage"),
      });
      if (attempt === retries || !_isRetryable(err)) {
        throw _mkError(`Image upload failed: ${fb.message || err.message}`, err.status || fb.code || 500, {
          fbError: fb,
          hint:    _fbErrorHint(fb.code, fb.message, "uploadImage"),
        });
      }
      await _delay(1000 * attempt);
    }
  }
}

async function _uploadVideo(fbAccount, videoUrl, adAccountId, redis, retries = VIDEO_UPLOAD_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    await _throttle(adAccountId, redis);
    try {
      logger.debug(`[Media] Uploading video (attempt ${attempt}/${retries})`, { videoUrl: videoUrl.slice(0, 80) });
      const res     = await fbAccount.createAdVideo([], { file_url: videoUrl });
      const videoId = res?.id;
      if (!videoId) throw _mkError("No video ID in upload response", 500, { raw: res });
      logger.info("[Media] Video uploaded, waiting for processing", { videoId });
      await _waitForVideo(videoId, adAccountId, redis);
      return videoId;
    } catch (err) {
      const fb = _unwrapFbError(err);
      logger.warn(`[Media] Video upload attempt ${attempt} failed`, {
        err:      err.message,
        fb_code:  fb.code,
        fb_msg:   fb.message,
        fb_trace: fb.traceId,
        hint:     _fbErrorHint(fb.code, fb.message, "uploadVideo"),
      });
      if (attempt === retries || !_isRetryable(err)) {
        throw _mkError(`Video upload failed: ${fb.message || err.message}`, err.status || fb.code || 500, {
          fbError: fb,
          hint:    _fbErrorHint(fb.code, fb.message, "uploadVideo"),
        });
      }
      await _delay(2000 * attempt);
    }
  }
}

async function _waitForVideo(videoId, adAccountId, redis, maxWait = VIDEO_TIMEOUT_MS) {
  const start = Date.now();
  let polls   = 0;
  while (Date.now() - start < maxWait) {
    await _throttle(adAccountId, redis);
    try {
      polls++;
      const data   = await new AdVideo(videoId).read(["status"]);
      const status = data?.status?.video_status;
      logger.debug(`[Media] Video poll #${polls}`, { videoId, status });
      if (status === "ready") {
        logger.info("[Media] Video ready", { videoId, polls, elapsedMs: Date.now() - start });
        return;
      }
      if (status === "error" || status === "processing_failed") {
        throw _mkError(`Video processing failed with status: ${status}`, 500, { videoId, status });
      }
    } catch (err) {
      if (err.statusCode) throw err;
      logger.warn("[Media] Transient error polling video status", { videoId, err: err.message });
    }
    await _delay(VIDEO_POLL_INTERVAL_MS);
  }
  logger.warn("[Media] Video processing timeout — proceeding anyway", {
    videoId,
    polls,
    elapsedMs: Date.now() - start,
    hint: "The video may still process asynchronously. Check FB Video Library if the creative is rejected.",
  });
}

async function _resolveImageHash(fbAccount, imageUrl, imageHash, adAccountId, redis) {
  if (imageHash) {
    logger.debug("[Media] Using provided imageHash", { imageHash });
    return imageHash;
  }
  if (_isFbCDN(imageUrl)) {
    logger.debug("[Media] Resolving FB CDN image hash via getAdImages", { imageUrl: imageUrl.slice(0, 80) });
    await _throttle(adAccountId, redis);
    const images = await fbAccount.getAdImages(["hash", "url"], { filter_url: imageUrl });
    if (images?.length) {
      logger.info("[Media] Resolved CDN image hash", { hash: images[0].hash });
      return images[0].hash;
    }
    throw _mkError(
      "Cannot resolve CDN image hash — the image URL was not found in this ad account's image library. " +
      "Provide imageHash directly instead of imageUrl.",
      404,
      { imageUrl, hint: "Use imageHash from a previous upload, or re-upload via createAdImage." }
    );
  }
  return _uploadImage(fbAccount, imageUrl, adAccountId, redis);
}

async function _resolveMedia(fbAccount, creativeData, mediaType, adAccountId, redis) {
  if (mediaType === "video") {
    if (creativeData.videoId) {
      logger.debug("[Media] Using provided videoId", { videoId: creativeData.videoId });
      return creativeData.videoId;
    }
    return _uploadVideo(fbAccount, creativeData.videoUrl || creativeData.mediaUrl, adAccountId, redis);
  }
  return _resolveImageHash(fbAccount, creativeData.imageUrl, creativeData.imageHash, adAccountId, redis);
}

async function _resolveDynamicAssets(fbAccount, creativeData, adAccountId, redis) {
  const { assetFeed } = creativeData;
  const imageHashes = [], videoIds = [], thumbnails = [];
  for (const img of assetFeed.images ?? []) {
    imageHashes.push(await _resolveImageHash(fbAccount, img.url, img.hash, adAccountId, redis));
  }
  for (const vid of assetFeed.videos ?? []) {
    const id = vid.videoId ?? await _uploadVideo(fbAccount, vid.url, adAccountId, redis);
    videoIds.push(id);
    thumbnails.push(vid.thumbnailUrl ?? null);
  }
  logger.debug("[Media] Dynamic assets resolved", { imageCount: imageHashes.length, videoCount: videoIds.length });
  return { imageHashes, videoIds, thumbnails };
}

async function _resolveCarouselCards(fbAccount, cards, adAccountId, redis) {
  const resolved = await Promise.all(cards.map(async (card) => {
    const r = { ...card };
    if (card.videoId)       r.resolvedVideoId   = card.videoId;
    else if (card.videoUrl) r.resolvedVideoId   = await _uploadVideo(fbAccount, card.videoUrl, adAccountId, redis);
    else                    r.resolvedImageHash = await _resolveImageHash(fbAccount, card.imageUrl, card.imageHash, adAccountId, redis);
    return r;
  }));
  logger.debug("[Media] Carousel cards resolved", { count: resolved.length });
  return resolved;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — CREATIVE PAYLOAD BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determines if this is a Lead Generation (Instant Form / ON_AD destination) creative.
 * When true, CTA value uses lead_gen_form_id instead of a URL.
 */
function _isLeadGenCreative(creativeData) {
  return Boolean(creativeData.leadFormId);
}

/**
 * Builds the object_story_spec for Lead Gen (ON_AD) ads.
 * The CTA value MUST use { lead_gen_form_id } — NOT a URL.
 * The link in link_data MUST be the Facebook Page URL.
 */
function _buildLeadGenStorySpec({ creativeData, pageId, mediaHash, mediaType, instagramActorId }) {
  const cta = {
    type:  creativeData.callToAction,
    value: { lead_gen_form_id: creativeData.leadFormId },
  };

  logger.debug("[Creative] Building Lead Gen story spec", {
    leadFormId:  creativeData.leadFormId,
    pageId,
    callToAction: creativeData.callToAction,
    mediaType,
  });

  let storySpec;
  if (mediaType === "video") {
    storySpec = {
      page_id: pageId,
      video_data: {
        video_id:        mediaHash,
        message:         creativeData.primaryText,
        title:           creativeData.headline,
        call_to_action:  cta,
        ...(creativeData.thumbnailUrl ? { image_url:        creativeData.thumbnailUrl } : {}),
        ...(creativeData.description  ? { link_description: creativeData.description  } : {}),
      },
    };
  } else {
    // For ON_AD destination the link must point to the Page, not an external URL
    storySpec = {
      page_id: pageId,
      link_data: {
        link:           `https://www.facebook.com/${pageId}`,
        message:        creativeData.primaryText,
        name:           creativeData.headline,
        image_hash:     mediaHash,
        call_to_action: cta,
        ...(creativeData.description ? { description: creativeData.description } : {}),
      },
    };
  }

  if (instagramActorId) storySpec.instagram_actor_id = instagramActorId;
  return storySpec;
}

function _buildSinglePayload({ creativeData, pageId, mediaHash, mediaType, instagramActorId, campaignName, fingerprint }) {
  const finalUrl = _appendUTM(creativeData.websiteUrl, creativeData.name, campaignName);
  let storySpec;

  // ── Lead Generation (ON_AD destination) path ─────────────────────────────
  if (_isLeadGenCreative(creativeData)) {
    storySpec = _buildLeadGenStorySpec({ creativeData, pageId, mediaHash, mediaType, instagramActorId });

  // ── Standard video path ───────────────────────────────────────────────────
  } else if (mediaType === "video") {
    const videoData = {
      video_id:       mediaHash,
      message:        creativeData.primaryText,
      title:          creativeData.headline,
      call_to_action: { type: creativeData.callToAction, value: { link: finalUrl } },
    };
    if (creativeData.thumbnailUrl) videoData.image_url        = creativeData.thumbnailUrl;
    if (creativeData.description)  videoData.link_description = creativeData.description;
    storySpec = { page_id: pageId, video_data: videoData };

  // ── Standard image path ───────────────────────────────────────────────────
  } else {
    storySpec = {
      page_id: pageId,
      link_data: {
        link:           finalUrl,
        message:        creativeData.primaryText,
        name:           creativeData.headline,
        image_hash:     mediaHash,
        call_to_action: { type: creativeData.callToAction, value: { link: finalUrl } },
        ...(creativeData.description ? { description: creativeData.description } : {}),
      },
    };
  }

  if (instagramActorId) storySpec.instagram_actor_id = instagramActorId;
  return { name: fingerprint, object_story_spec: storySpec, url_tags: _buildUTM(creativeData.name, campaignName) };
}

function _buildDynamicPayload({ creativeData, pageId, resolvedAssets, instagramActorId, campaignName, fingerprint }) {
  const { assetFeed } = creativeData;
  const finalUrl      = _appendUTM(creativeData.websiteUrl, creativeData.name, campaignName);

  // Derive ad_formats from actual assets — never hardcode
  const adFormats = [];
  if (resolvedAssets.imageHashes?.length) adFormats.push("SINGLE_IMAGE");
  if (resolvedAssets.videoIds?.length)    adFormats.push("SINGLE_VIDEO");
  if (!adFormats.length)                  adFormats.push("SINGLE_IMAGE");

  const assetFeedSpec = {
    bodies:            assetFeed.bodies.map((text) => ({ text })),
    titles:            assetFeed.titles.map((text) => ({ text })),
    call_to_actions:   [{ type: creativeData.callToAction, value: { link: finalUrl } }],
    link_urls:         [{ website_url: finalUrl }],
    ad_formats:        adFormats,
    optimization_type: "REGULAR",
  };

  if (assetFeed.descriptions?.length) {
    assetFeedSpec.descriptions = assetFeed.descriptions.map((text) => ({ text }));
  }
  if (resolvedAssets.imageHashes?.length) {
    assetFeedSpec.images = resolvedAssets.imageHashes.map((hash) => ({
      hash, url: finalUrl, url_tags: _buildUTM(creativeData.name, campaignName),
    }));
  }
  if (resolvedAssets.videoIds?.length) {
    assetFeedSpec.videos = resolvedAssets.videoIds.map((video_id, i) => ({
      video_id, url: finalUrl,
      ...(resolvedAssets.thumbnails?.[i] ? { thumbnail_url: resolvedAssets.thumbnails[i] } : {}),
      url_tags: _buildUTM(creativeData.name, campaignName),
    }));
  }

  const payload = { name: fingerprint, asset_feed_spec: assetFeedSpec, object_story_spec: { page_id: pageId } };
  if (instagramActorId) payload.object_story_spec.instagram_actor_id = instagramActorId;
  return payload;
}

function _buildCarouselPayload({ creativeData, pageId, resolvedCards, instagramActorId, campaignName, fingerprint }) {
  const finalUrl         = _appendUTM(creativeData.websiteUrl, creativeData.name, campaignName);
  const childAttachments = resolvedCards.map((card, i) => {
    const cardUrl    = _appendUTM(card.link || creativeData.websiteUrl, creativeData.name, campaignName);
    const attachment = {
      link:           cardUrl,
      name:           card.headline || creativeData.headline || `Card ${i + 1}`,
      description:    card.description || "",
      call_to_action: { type: card.callToAction || creativeData.callToAction, value: { link: cardUrl } },
    };
    if (card.resolvedVideoId) {
      attachment.video_id = card.resolvedVideoId;
      if (card.thumbnailUrl) attachment.picture = card.thumbnailUrl;
    } else {
      attachment.image_hash = card.resolvedImageHash;
    }
    return attachment;
  });

  const storySpec = {
    page_id: pageId,
    link_data: {
      link:                  finalUrl,
      message:               creativeData.primaryText || "",
      child_attachments:     childAttachments,
      multi_share_optimized: creativeData.optimizeCardOrder !== false,
      multi_share_end_card:  creativeData.showEndCard !== false,
      call_to_action:        { type: creativeData.callToAction, value: { link: finalUrl } },
    },
  };
  if (instagramActorId) storySpec.instagram_actor_id = instagramActorId;
  return { name: fingerprint, object_story_spec: storySpec, url_tags: _buildUTM(creativeData.name, campaignName) };
}

function _buildCollectionPayload({ creativeData, pageId, mediaHash, mediaType, instagramActorId, campaignName, fingerprint }) {
  const finalUrl     = _appendUTM(creativeData.websiteUrl, creativeData.name, campaignName);
  const templateData = {
    name:           creativeData.headline,
    link:           finalUrl,
    primary_text:   creativeData.primaryText,
    description:    creativeData.description || "",
    call_to_action: { type: creativeData.callToAction, value: { link: finalUrl } },
    format:         "COLLECTION",
  };
  if (mediaType === "video") {
    templateData.video_id = mediaHash;
    if (creativeData.thumbnailUrl) templateData.image_url = creativeData.thumbnailUrl;
  } else {
    templateData.image_hash = mediaHash;
  }

  const payload = {
    name:              fingerprint,
    object_story_spec: { page_id: pageId, template_data: templateData },
    product_set_id:    creativeData.productSetId,
    url_tags:          _buildUTM(creativeData.name, campaignName),
  };
  if (creativeData.advantagePlusCatalog !== false) {
    payload.degrees_of_freedom_spec = { creative_features_spec: { standard_enhancements: { enroll_status: "OPT_IN" } } };
  }
  if (instagramActorId) payload.object_story_spec.instagram_actor_id = instagramActorId;
  return payload;
}

function _applyPlacementCustomization(payload, creativeData) {
  const pa = creativeData.placementAssets;
  if (!pa || typeof pa !== "object") return payload;

  const rules = [];
  const add   = (spec, asset) => {
    if (!asset) return;
    const rule = { customization_spec: spec };
    if (asset.imageHash) rule.image_hash = asset.imageHash;
    if (asset.videoId)   rule.video_id   = asset.videoId;
    rules.push(rule);
  };

  add({ publisher_platforms: ["facebook", "instagram"], facebook_positions: ["story"],          instagram_positions: ["story"]  }, pa.story);
  add({ publisher_platforms: ["facebook", "instagram"], facebook_positions: ["facebook_reels"], instagram_positions: ["reels"]  }, pa.reels);
  add({ publisher_platforms: ["facebook"],              facebook_positions: ["feed"]                                             }, pa.feed);
  add({ publisher_platforms: ["instagram"],             instagram_positions: ["stream"]                                          }, pa.instagramFeed);

  if (rules.length) payload.asset_customization_rules = rules;
  return payload;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — CREATIVE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

async function _createCreative(fbAccount, adAccountId, creativeData, options, redis) {
  const { pageId, mediaHash, mediaType, instagramActorId, campaignName, adFormat, resolvedCards, resolvedAssets } = options;

  // DB dedup — O(1) lookup, skips FB API call for duplicate creatives
  const fingerprint = _buildFingerprint(creativeData, mediaHash ?? "", adFormat);
  const existing    = await _findDuplicate(fingerprint, adAccountId);
  if (existing) {
    logger.info("[Creative] Dedup hit — skipping FB creative creation", {
      metaCreativeId: existing.metaCreativeId,
      fingerprint:    fingerprint.slice(0, 60) + "...",
    });
    return { id: existing.metaCreativeId, _deduped: true, _payload: null };
  }

  // Build format-specific payload
  let payload;
  switch (adFormat) {
    case AD_FORMAT.DYNAMIC:    payload = _buildDynamicPayload   ({ creativeData, pageId, resolvedAssets,  instagramActorId, campaignName, fingerprint }); break;
    case AD_FORMAT.CAROUSEL:   payload = _buildCarouselPayload  ({ creativeData, pageId, resolvedCards,   instagramActorId, campaignName, fingerprint }); break;
    case AD_FORMAT.COLLECTION: payload = _buildCollectionPayload({ creativeData, pageId, mediaHash, mediaType, instagramActorId, campaignName, fingerprint }); break;
    default:                   payload = _buildSinglePayload    ({ creativeData, pageId, mediaHash, mediaType, instagramActorId, campaignName, fingerprint });
  }
  payload = _applyPlacementCustomization(payload, creativeData);

  logger.debug("[Creative] Submitting to Facebook", {
    adFormat,
    pageId,
    hasLeadFormId:  Boolean(creativeData.leadFormId),
    hasPlacement:   Boolean(creativeData.placementAssets),
    payloadKeys:    Object.keys(payload),
  });

  // Submit to Facebook with retry + exponential backoff
  for (let attempt = 1; attempt <= CREATIVE_API_RETRIES; attempt++) {
    await _throttle(adAccountId, redis);
    try {
      // NOTE: "review_feedback" is NOT available at creation time — only via GET after review.
      // Requesting it causes: "Tried accessing nonexisting field (review_feedback) on node type (AdCreative)"
      const creative = await fbAccount.createAdCreative(CREATIVE_READ_FIELDS, payload);

      if (creative?.status === "WITH_ISSUES") {
        logger.warn("[Creative] status=WITH_ISSUES — Meta flagged this creative", {
          creativeId: creative.id,
          status:     creative.status,
          action:     "Fetch review_feedback via GET /{creative-id}?fields=review_feedback after review completes.",
          docsUrl:    "https://developers.facebook.com/docs/marketing-api/reference/ad-creative",
        });
      } else {
        logger.info("[Creative] Created successfully", { creativeId: creative.id, status: creative.status });
      }

      await _saveFingerprint({ fingerprint, metaCreativeId: creative.id, adAccountId, adFormat });
      return { ...creative, _payload: payload, _deduped: false };
    } catch (err) {
      const fb = _unwrapFbError(err);
      logger.warn(`[Creative] Attempt ${attempt}/${CREATIVE_API_RETRIES} failed`, {
        fb_code:       fb.code,
        fb_type:       fb.type,
        fb_message:    fb.message,
        fb_subcode:    fb.subcode,
        fb_user_msg:   fb.userMsg,
        fb_trace_id:   fb.traceId,
        fb_transient:  fb.isTransient,
        hint:          _fbErrorHint(fb.code, fb.message, "createCreative", fb.subcode),
        payload_name:  payload.name?.slice(0, 60),
      });
      if (attempt === CREATIVE_API_RETRIES || !_isRetryable(err)) {
        throw _mkError(
          `Creative creation failed: ${fb.message || err.message}`,
          err.status ?? fb.code ?? 500,
          {
            payload,
            fbError: fb,
            hint:    _fbErrorHint(fb.code, fb.message, "createCreative", fb.subcode),
          }
        );
      }
      await _delay(1000 * attempt);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — AD CREATION
// ═══════════════════════════════════════════════════════════════════════════════

async function _createAd(fbAccount, { name, adSetId, creativeId }, adAccountId, redis) {
  // Hard guard: catch null/undefined adSetId before wasting a rate-limit slot
  if (!adSetId) {
    throw _mkError(
      "adSetId is null or undefined — metaAdSetId was never saved on this adSetDraft. " +
      "The Ad Set must be successfully published to Facebook before you can create ads under it. " +
      "Complete the adset publish step first.",
      400,
      {
        adSetId,
        creativeId,
        hint: "Ensure step='adset' completes successfully and persists metaAdSetId to your DB before calling step='ad'.",
      }
    );
  }
  if (!creativeId) {
    throw _mkError("creativeId is null or undefined — creative was not created or returned correctly.", 400, { adSetId, creativeId });
  }

  await _throttle(adAccountId, redis);

  const payload = {
    name,
    adset_id:  adSetId,
    creative:  { creative_id: creativeId },
    status:    "PAUSED",
  };

  logger.debug("[Ad] Submitting createAd to Facebook", {
    adName:     name,
    adSetId,
    creativeId,
  });

  try {
    const ad = await fbAccount.createAd(["id", "status", "effective_status"], payload);
    logger.info("[Ad] Created successfully", {
      adId:            ad.id,
      status:          ad.status,
      effectiveStatus: ad.effective_status,
    });
    return ad;
  } catch (err) {
    const fb = _unwrapFbError(err);
    const hint = _fbErrorHint(fb.code, fb.message, "createAd", fb.subcode);

    logger.error("[Ad] Facebook rejected createAd — FULL ERROR DETAILS", {
      // ── Facebook error fields ──
      fb_error_code:        fb.code,
      fb_error_type:        fb.type,
      fb_error_message:     fb.message,
      fb_error_subcode:     fb.subcode,
      fb_user_message:      fb.userMsg,
      fb_user_title:        fb.userTitle,
      fb_trace_id:          fb.traceId,
      fb_is_transient:      fb.isTransient,
      // ── Payload context ──
      payload_adSetId:      adSetId,
      payload_creativeId:   creativeId,
      payload_adName:       name,
      // ── Actionable hint ──
      hint,
    });

    throw _mkError(
      `Ad creation failed: ${fb.message || err.message}`,
      err.status ?? fb.code ?? 500,
      {
        payload,
        fbError: fb,
        hint,
      }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// async function _getAdSetDraft(adSetDraftId) {
//   const draft = await prisma.adSetDraft.findUnique({
//     where:   { id: adSetDraftId },
//     include: { campaignDraft: { include: { adAccount: true } } },
//   });

//   if (!draft)                          throw _mkError("Ad Set draft not found", 404, { adSetDraftId });
//   if (!draft.campaignDraft?.adAccount) throw _mkError("Ad Account not found for this Ad Set draft", 404, { adSetDraftId });

//   // Surface missing metaAdSetId early — before wasting an API call
//   if (!draft.metaAdSetId) {
//     throw _mkError(
//       `Ad Set draft "${adSetDraftId}" has no metaAdSetId. ` +
//       "The Ad Set must be published to Facebook before you can create ads under it. " +
//       "Call the adset publish step first.",
//       400,
//       {
//         adSetDraftId,
//         adSetName: draft.name ?? "(unnamed)",
//         hint:      "Run step='adset' successfully to publish to Facebook and persist metaAdSetId before calling step='ad'.",
//       }
//     );
//   }

//   logger.debug("[DB] AdSetDraft loaded", {
//     adSetDraftId,
//     metaAdSetId:   draft.metaAdSetId,
//     adAccountId:   draft.campaignDraft.adAccount.metaAccountId,
//     campaignName:  draft.campaignDraft.name,
//   });

//   return draft;
// }

async function _getAdSetDraft(adSetDraftId, adAccountAccess = null) {
  // KEY CHANGE: if adAccountAccess is resolved (via withAuth middleware),
  // drop the userId filter — access is already proven via canAccess().
  // Members can fetch drafts on accounts they don't own but have access to.
  const draft = await prisma.adSetDraft.findUnique({
    where:   { id: adSetDraftId },
    include: { campaignDraft: { include: { adAccount: true } } },
  });

  if (!draft)                          throw _mkError("Ad Set draft not found", 404, { adSetDraftId });
  if (!draft.campaignDraft?.adAccount) throw _mkError("Ad Account not found for this Ad Set draft", 404, { adSetDraftId });

  if (!draft.metaAdSetId) {
    throw _mkError(
      `Ad Set draft "${adSetDraftId}" has no metaAdSetId. ` +
      "The Ad Set must be published to Facebook before you can create ads under it. " +
      "Call the adset publish step first.",
      400,
      {
        adSetDraftId,
        adSetName: draft.name ?? "(unnamed)",
        hint:      "Run step='adset' successfully to publish to Facebook and persist metaAdSetId before calling step='ad'.",
      }
    );
  }

  // Extra safety: if access context available, confirm user can access this account
  if (adAccountAccess) {
    const adAccountId = draft.campaignDraft.adAccount.id; // internal DB id
    if (!adAccountAccess.canAccess(adAccountId)) {
      throw _mkError(
        "Access denied to the ad account associated with this Ad Set draft",
        403,
        {
          adSetDraftId,
          adAccountId,
          hint: "The ad account on this draft is not in your resolved access set.",
        }
      );
    }
  }

  logger.debug("[DB] AdSetDraft loaded", {
    adSetDraftId,
    metaAdSetId:  draft.metaAdSetId,
    adAccountId:  draft.campaignDraft.adAccount.metaAccountId,
    campaignName: draft.campaignDraft.name,
  });

  return draft;
}

async function _saveAdToDB({ data, adId, creativeId, pageId, mediaType, rawFbPayload, intelligenceReport, deduped }) {
  const { creativeData, adFormat = AD_FORMAT.SINGLE } = data;
  try {
    const record = await prisma.adDraft.create({
      data: {
        metaAdId:           adId,
        metaCreativeId:     creativeId,
        adSetDraftId:       data.adSetDraftId,
        name:               creativeData.name,
        primaryText:        creativeData.primaryText  ?? null,
        headline:           creativeData.headline     ?? null,
        websiteUrl:         creativeData.websiteUrl,
        callToAction:       creativeData.callToAction,
        adFormat,
        creativeSpec:       { ...creativeData, mediaType, pageId },
        rawFbPayload:       JSON.stringify(rawFbPayload),
        intelligenceReport: JSON.stringify(intelligenceReport),
        creativeReused:     deduped,
        status:             "PAUSED",
      },
    });
    logger.info("[DB] AdDraft saved", { adDraftId: record.id, metaAdId: adId });
    return record;
  } catch (err) {
    // DB save failure should not mask a successful FB ad creation — log and continue
    logger.error("[DB] Failed to save adDraft — FB ad was created successfully but is NOT persisted locally", {
      err:       err.message,
      metaAdId:  adId,
      creativeId,
      action:    "Manually record this adId in your DB to avoid orphaned FB ads.",
    });
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15 — AD SERVICE CLASS (Public API)
// ═══════════════════════════════════════════════════════════════════════════════

export class AdService {
  /**
   * @param {string} userId
   * @param {object} [options]
   * @param {object|null} [options.redis]
   *   ioredis / @upstash/redis client for distributed rate limiting.
   *   Pass null (default) to use in-memory fallback (dev / single-server).
   *
   * @example
   *   // Production (multi-server / serverless)
   *   import Redis from "ioredis";
   *   const adService = new AdService(userId, { redis: new Redis(process.env.REDIS_URL) });
   *
   *   // Development
   *   const adService = new AdService(userId);
   */
  // constructor(userId, { redis = null } = {}) {
  //   this.userId = userId;
  //   this.redis  = redis;
  //   logger.debug("AdService initialized", { userId, apiVersion: API_VERSION, rateLimiter: redis ? "redis" : "memory" });
  // }
  constructor(userId, { redis = null } = {}, adAccountAccess = null) {
  this.userId          = userId;
  this.redis           = redis;
  this.adAccountAccess = adAccountAccess; // ← new
  logger.debug("AdService initialized", { userId, apiVersion: API_VERSION, rateLimiter: redis ? "redis" : "memory" });
}

  /**
   * Create a single ad in any supported format.
   *
   * @param {Object} data
   * @param {string} data.adSetDraftId
   * @param {string} [data.adFormat]         AD_FORMAT constant — default: "single"
   * @param {boolean} [data.skipPolicyCheck] Skip pre-check (not recommended)
   * @param {boolean} [data.skipScoring]     Skip creative intelligence scoring
   * @param {boolean} [data.skipAdSetGuard]  Skip live adset objective fetch (saves 1 API call, reduces safety)
   * @param {Object} data.creativeData
   *
   * ─── SINGLE / WEBSITE destination ─────────────────────────────────────
   * creativeData: {
   *   name, primaryText, headline, websiteUrl, callToAction,
   *   imageUrl | imageHash | videoUrl | videoId,
   *   thumbnailUrl?,
   *   description?,
   *   instagramActorId?,
   *   pageId?,
   *   placementAssets?: { feed?, story?, reels?, instagramFeed? }
   * }
   *
   * ─── SINGLE / LEAD_GENERATION (ON_AD destination) ──────────────────────
   * creativeData: {
   *   name, primaryText, headline, websiteUrl, callToAction,
   *   imageUrl | imageHash | videoUrl | videoId,
   *   leadFormId: string,   ← Facebook Instant Form ID (required for LEADS objective)
   *   thumbnailUrl?,
   *   description?,
   *   instagramActorId?,
   *   pageId?,
   * }
   *
   * ─── DYNAMIC ────────────────────────────────────────────────────────────
   * creativeData: {
   *   name, websiteUrl, callToAction,
   *   assetFeed: {
   *     bodies:        string[],   // 1–5
   *     titles:        string[],   // 1–5
   *     descriptions?: string[],
   *     images?:       [{ url?, hash? }],
   *     videos?:       [{ url?, videoId?, thumbnailUrl? }]
   *   }
   * }
   *
   * ─── CAROUSEL ───────────────────────────────────────────────────────────
   * creativeData: {
   *   name, primaryText?, websiteUrl, callToAction,
   *   cards: [{ imageUrl?, imageHash?, videoId?, videoUrl?, headline?, description?, link?, callToAction?, thumbnailUrl? }],
   *   optimizeCardOrder?: boolean,
   *   showEndCard?:        boolean
   * }
   *
   * ─── COLLECTION ─────────────────────────────────────────────────────────
   * creativeData: {
   *   name, primaryText, headline, websiteUrl, callToAction,
   *   productSetId,
   *   catalogId?,
   *   imageUrl | imageHash | videoUrl | videoId,
   *   thumbnailUrl?,
   *   advantagePlusCatalog?: boolean
   * }
   */
  async create(data) {
    const adFormat = data.adFormat ?? AD_FORMAT.SINGLE;
    logger.start(`AD CREATION [${adFormat.toUpperCase()}]`);

    try {

          // ── Permission guard ──────────────────────────────────────────────────
    // Route already validated create_campaigns before reaching here.
    // This guard is defense-in-depth for direct service calls (tests/scripts).
    // Owners and admins have ['*'] so hasPermission() passes automatically.
    // Members need explicit 'create_campaigns' in their permissions array.
    if (this.adAccountAccess && data.adAccountId) {
      if (!this.adAccountAccess.canAccess(data.adAccountId)) {
        throw _mkError("Ad account not found or access denied", 403, {
          adAccountId: data.adAccountId,
        });
      }
      if (!this.adAccountAccess.hasPermission(data.adAccountId, "create_campaigns")) {
        throw _mkError(
          "You do not have permission to create ads on this ad account. Required permission: create_campaigns",
          403,
          {
            adAccountId:    data.adAccountId,
            requiredPerm:   "create_campaigns",
            accessType:     this.adAccountAccess.getAccount(data.adAccountId)?.accessType,
            userPermissions: this.adAccountAccess.getAccount(data.adAccountId)?.permissions,
            actionRequired: "Contact the account owner to grant create_campaigns permission",
          }
        );
      }
      logger.success("Permission verified — create_campaigns confirmed", {
        userId:      this.userId,
        adAccountId: data.adAccountId,
        accessType:  this.adAccountAccess.getAccount(data.adAccountId)?.accessType,
      });
    }
      // ── Step 1 — Validate inputs ────────────────────────────────────────────
      _validateInput({ ...data, adFormat });

      const { creativeData } = data;

      // ── Step 2 — Policy pre-check ───────────────────────────────────────────
      if (!data.skipPolicyCheck) {
        const policy = _policyPreCheck(creativeData, adFormat);
        if (!policy.passed) {
          throw _mkError(
            `Policy pre-check failed: ${policy.blocks[0].message}`,
            422,
            { blocks: policy.blocks, warnings: policy.warnings }
          );
        }
        if (policy.warnings.length) {
          logger.warn("[Policy] Warnings present — submission may trigger manual review", {
            warnings: policy.warnings.map((w) => w.message),
          });
        }
      }

      // ── Step 3 — Creative intelligence score (non-blocking) ─────────────────
      const intelligenceReport = data.skipScoring ? null : _scoreCreative(creativeData, adFormat);
      if (intelligenceReport) {
        logger.info("[Score]", {
          grade:         intelligenceReport.grade,
          score:         intelligenceReport.overallScore,
          topSuggestion: intelligenceReport.suggestions[0] ?? "None",
        });
      }

      // ── Step 4 — Load ad set + account from DB ──────────────────────────────
      // const adSetDraft  = await _getAdSetDraft(data.adSetDraftId);
      const adSetDraft  = await _getAdSetDraft(data.adSetDraftId, this.adAccountAccess);
      const adAccount   = adSetDraft.campaignDraft.adAccount;
      const adAccountId = adAccount.metaAccountId;

      if (!adAccount.accessToken) throw _mkError("Access token missing for ad account — re-authenticate with Facebook.", 401, { adAccountId });

      const pageId = creativeData.pageId ?? adAccount.metaPageId;
      if (!pageId) throw _mkError("pageId required — set creativeData.pageId or adAccount.metaPageId.", 400, { adAccountId });

      // ── Step 5 — Init Facebook SDK (per-request, concurrent-safe) ───────────
      FacebookAdsApi.init(adAccount.accessToken);
      const fbAccount       = new AdAccount(adAccountId);
      const campaignName    = adSetDraft.campaignDraft?.name ?? "";
      const instagramActorId = creativeData.instagramActorId ?? null;

      logger.info("[SDK] Facebook SDK initialized", {
        adAccountId,
        pageId,
        campaignName,
        adSetId: adSetDraft.metaAdSetId,
      });

      // ── Step 6 — Fetch live adset meta + guard objective/creative mismatch ───
      if (!data.skipAdSetGuard) {
        const adSetMeta = await _fetchAdSetMeta(adSetDraft.metaAdSetId, adAccountId, this.redis);
        _guardObjectiveCreativeMismatch(adSetMeta, creativeData);
      }

      // ── Step 7 — Resolve media ───────────────────────────────────────────────
      let mediaHash = null, mediaType = null, resolvedCards = null, resolvedAssets = null;

      if (adFormat === AD_FORMAT.DYNAMIC) {
        resolvedAssets = await _resolveDynamicAssets(fbAccount, creativeData, adAccountId, this.redis);
      } else if (adFormat === AD_FORMAT.CAROUSEL) {
        resolvedCards  = await _resolveCarouselCards(fbAccount, creativeData.cards, adAccountId, this.redis);
      } else {
        mediaType = _detectMediaType(creativeData);
        mediaHash = await _resolveMedia(fbAccount, creativeData, mediaType, adAccountId, this.redis);
        logger.info("[Media] Media resolved", { mediaType, mediaHash: String(mediaHash).slice(0, 20) });
      }

      // ── Step 8 — Create creative (with DB dedup) ─────────────────────────────
      const creative = await _createCreative(
        fbAccount, adAccountId, creativeData,
        { pageId, mediaHash, mediaType, instagramActorId, campaignName, adFormat, resolvedCards, resolvedAssets },
        this.redis
      );

      // ── Step 9 — Create ad ───────────────────────────────────────────────────
      const ad = await _createAd(
        fbAccount,
        { name: creativeData.name, adSetId: adSetDraft.metaAdSetId, creativeId: creative.id },
        adAccountId, this.redis
      );

      // ── Step 10 — Persist to DB ──────────────────────────────────────────────
      await _saveAdToDB({
        data:              { ...data, adFormat },
        adId:              ad.id,
        creativeId:        creative.id,
        pageId,
        mediaType:         mediaType ?? adFormat,
        rawFbPayload:      creative._payload,
        intelligenceReport,
        deduped:           creative._deduped,
      });

      logger.section("AD CREATION COMPLETE");
      logger.metrics("Result", {
        "Ad ID":       ad.id,
        "Creative ID": creative.id,
        "Format":      adFormat,
        "Lead Gen":    _isLeadGenCreative(creativeData),
        "Reused":      creative._deduped,
        "Score":       intelligenceReport ? `${intelligenceReport.grade} (${intelligenceReport.overallScore})` : "skipped",
      });

      return {
        success:           true,
        adId:              ad.id,
        creativeId:        creative.id,
        adFormat,
        mediaType,
        isLeadGen:         _isLeadGenCreative(creativeData),
        creativeReused:    creative._deduped,
        intelligenceReport,
        message:           `Ad created successfully (${adFormat})`,
      };
    } catch (err) {
      // If Facebook rejected the creative, invalidate fingerprint so next run creates a fresh one
      if (err?.details?.fbError?.code === 100 || err.statusCode === 422) {
        const creativeId = err?.details?.creativeId;
        if (creativeId) await _invalidateFingerprint(creativeId);
      }

      logger.error("Ad creation failed", {
        userId:       this.userId,
        adSetDraftId: data?.adSetDraftId,
        adFormat,
        message:      err.message,
        statusCode:   err.statusCode,
        hint:         err.details?.hint ?? null,
        fbError:      err.details?.fbError ?? null,
      });
      throw err;
    }
  }

  /**
   * Batch create. Each item follows the same shape as create(data).
   * Processes in groups of 50 with 1s pause between batches.
   */
  async createMultipleAds(adsDataArray) {
    if (!Array.isArray(adsDataArray) || !adsDataArray.length)
      throw _mkError("adsDataArray must be a non-empty array", 400);

    logger.start(`BATCH: ${adsDataArray.length} ads`);
    const results = [], errors = [];

    for (let i = 0; i < adsDataArray.length; i += BATCH_SIZE) {
      const batch      = adsDataArray.slice(i, i + BATCH_SIZE);
      const batchNum   = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatch = Math.ceil(adsDataArray.length / BATCH_SIZE);
      logger.info(`[Batch] ${batchNum}/${totalBatch} — processing ${batch.length} ads`);

      const settled = await Promise.allSettled(batch.map((d) => this.create(d)));
      settled.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          results.push({ index: i + idx, ...res.value });
        } else {
          const reason = res.reason;
          errors.push({
            index:      i + idx,
            message:    reason?.message,
            statusCode: reason?.statusCode,
            hint:       reason?.details?.hint ?? null,
            fbError:    reason?.details?.fbError ?? null,
          });
        }
      });

      if (i + BATCH_SIZE < adsDataArray.length) await _delay(1000);
    }

    const rate = ((results.length / adsDataArray.length) * 100).toFixed(2);
    logger.metrics("Batch complete", {
      Total:          adsDataArray.length,
      Succeeded:      results.length,
      Failed:         errors.length,
      "Success Rate": `${rate}%`,
    });

    return {
      success:   results.length > 0,
      total:     adsDataArray.length,
      succeeded: results.length,
      failed:    errors.length,
      results,
      errors,
    };
  }

  /** Check remaining Facebook API calls for an ad account before a batch run. */
  getRateLimitStatus(adAccountId) {
    return _getRateLimitStatus(adAccountId, this.redis);
  }

  /** View deduplication savings for an ad account. */
  getDedupStats(adAccountId) {
    return _getDedupStats(adAccountId);
  }

  /** Manually invalidate a creative fingerprint (e.g. after a manual Facebook rejection). */
  invalidateCreative(metaCreativeId) {
    return _invalidateFingerprint(metaCreativeId);
  }

  /**
   * Fetch live review feedback for a creative after Facebook review completes.
   * This is the ONLY correct time to request review_feedback — NOT at creation.
   *
   * @param {string} metaCreativeId
   * @param {string} adAccountId
   * @returns {{ id, status, review_feedback } | null}
   */
  async getCreativeReviewFeedback(metaCreativeId, adAccountId) {
    try {
      FacebookAdsApi.init(
        (await prisma.adAccount.findFirst({ where: { metaAccountId: adAccountId } }))?.accessToken ?? ""
      );
      await _throttle(adAccountId, this.redis);
      const { AdCreative } = await import("facebook-nodejs-business-sdk");
      const creative = await new AdCreative(metaCreativeId).read(["id", "status", "review_feedback"]);
      logger.info("[Creative] Review feedback fetched", {
        metaCreativeId,
        status:          creative.status,
        reviewFeedback:  creative.review_feedback,
      });
      return creative;
    } catch (err) {
      const fb = _unwrapFbError(err);
      logger.error("[Creative] Failed to fetch review feedback", {
        metaCreativeId,
        fb_code: fb.code,
        fb_msg:  fb.message,
        hint:    _fbErrorHint(fb.code, fb.message, "getReviewFeedback"),
      });
      return null;
    }
  }
}

export default AdService;

// ═══════════════════════════════════════════════════════════════════════════════
// PRISMA SCHEMA ADDITIONS (add to schema.prisma if not already present)
// ═══════════════════════════════════════════════════════════════════════════════
/*
model CreativeFingerprint {
  id              String    @id @default(cuid())
  fingerprint     String    @unique
  metaCreativeId  String
  adAccountId     String
  adFormat        String
  status          String    @default("ACTIVE")   // ACTIVE | INACTIVE
  useCount        Int       @default(1)
  lastUsedAt      DateTime  @default(now())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([fingerprint, adAccountId, status])
  @@index([metaCreativeId])
  @@index([adAccountId, status])
}

model AdDraft {
  id                 String    @id @default(cuid())
  metaAdId           String?
  metaCreativeId     String?
  adSetDraftId       String
  name               String
  primaryText        String?
  headline           String?
  websiteUrl         String
  callToAction       String
  adFormat           String    @default("single")
  creativeSpec       Json
  rawFbPayload       String?   @db.Text
  intelligenceReport String?   @db.Text
  creativeReused     Boolean   @default(false)
  status             String    @default("PAUSED")
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  adSetDraft AdSetDraft @relation(fields: [adSetDraftId], references: [id])

  @@index([adSetDraftId])
  @@index([metaAdId])
  @@index([metaCreativeId])
}
*/