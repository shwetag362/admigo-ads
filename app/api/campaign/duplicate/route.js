// // app/api/campaign/duplicate/route.js
// // ─────────────────────────────────────────────────────────────────────────────
// // Campaign Duplication Route — v7.0
// //
// // KEY FIXES vs v6.0:
// //
// //   FIX-17  (CORRECT IMAGE HASH RESOLUTION):
// //     v6.0 tried GET /{hash}?fields=url which always returns 400 because an
// //     image hash is NOT a Graph API node ID. Fixed to use the correct endpoint:
// //       GET /act_{sourceMetaAccountId}/adimages?hashes=[hash1,hash2,...]&fields=hash,url
// //     Hashes are batched in chunks of 50 to stay within URL length limits.
// //     The fallback _resolveImageViaAdimagesEdge was also broken (wrong URL
// //     shape) — replaced with a proper single-hash /adimages?hashes=[hash] call.
// //
// //   FIX-18  (sourceMetaAccountId PASSED INTO InlineAssetResolver):
// //     InlineAssetResolver constructor now accepts sourceMetaAccountId so it
// //     can build the correct /adimages endpoint. Main handler passes
// //     sourceAccount.metaAccountId when constructing the resolver.
// //
// //   FIX-19  (DON'T DELETE image_hash ON MISS IN CreativeProcessor):
// //     Previously _replaceAssets() deleted spec.photo_data.image_hash /
// //     spec.link_data.image_hash when the hash wasn't in imageHashMap, leaving
// //     Meta with a broken photo_data that had only a caption and a stale URL.
// //     Now the original hash is kept on miss so Meta can still attempt to use
// //     the source hash (which may work if both accounts share the same Business
// //     Manager image library), and a warning is logged instead.
// //
// //   FIX-20  (ADD Meta subcode 2446603 TO KNOWN ERRORS):
// //     Subcode 2446603 ("Invalid image in ad") added to META_KNOWN_ERRORS so
// //     it is recognised and surfaces a clear user-facing message instead of a
// //     raw 500 throw.
// //
// // ─────────────────────────────────────────────────────────────────────────────

// import {
//   FacebookAdsApi,
//   AdAccount,
//   Campaign,
//   AdCreative,
//   Page,
// } from "facebook-nodejs-business-sdk";
// import { prisma } from "@/lib/prisma";
// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// // ─────────────────────────────────────────────────────────────────────────────
// // CONSOLE HELPERS
// // ─────────────────────────────────────────────────────────────────────────────

// const C = {
//   reset:    "\x1b[0m",
//   bold:     "\x1b[1m",
//   dim:      "\x1b[2m",
//   green:    "\x1b[32m",
//   yellow:   "\x1b[33m",
//   red:      "\x1b[31m",
//   cyan:     "\x1b[36m",
//   blue:     "\x1b[34m",
//   magenta:  "\x1b[35m",
//   gray:     "\x1b[90m",
//   white:    "\x1b[37m",
//   bgGreen:  "\x1b[42m",
//   bgRed:    "\x1b[41m",
//   bgYellow: "\x1b[43m",
//   bgBlue:   "\x1b[44m",
// };

// function box(lines, color = C.cyan) {
//   const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
//   const maxLen = Math.max(...lines.map((l) => stripAnsi(l).length));
//   const hr     = "─".repeat(maxLen + 4);
//   console.error(`${color}┌${hr}┐${C.reset}`);
//   for (const line of lines) {
//     const pad = " ".repeat(maxLen - stripAnsi(line).length);
//     console.error(`${color}│${C.reset}  ${line}${pad}  ${color}│${C.reset}`);
//   }
//   console.error(`${color}└${hr}┘${C.reset}`);
// }

// function checkRow(label, ok, detail = "") {
//   const icon  = ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
//   const color = ok ? C.green : C.red;
//   const d     = detail ? `  ${C.gray}${detail}${C.reset}` : "";
//   console.log(`   ${icon} ${color}${label}${C.reset}${d}`);
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // LOGGER
// // ─────────────────────────────────────────────────────────────────────────────

// class Logger {
//   constructor(requestId) {
//     this.requestId    = requestId;
//     this.startTime    = Date.now();
//     this._stepCounter = 0;

//     this.outcomes = {
//       auth:            null,
//       dbAccounts:      null,
//       campaignFetch:   null,
//       adSetsFetch:     null,
//       creativesFetch:  null,
//       assetResolution: null,
//       assetTransfer:   null,
//       igValidation:    null,
//       campaignCreate:  null,
//       campaignDB:      null,
//       adSetsCreate:    [],
//       adsCreate:       [],
//     };
//   }

//   _elapsed() { return `${((Date.now() - this.startTime) / 1000).toFixed(2)}s`; }

//   _extractFbError(err) {
//     if (!err) return null;
//     const direct = err?.response;
//     if (direct && (direct.fbtrace_id || direct.error_subcode != null || direct.code != null)) return direct;
//     return err?.response?.error || err?.response?.body?.error || err?.body?.error || err?._error || err?.error || null;
//   }

//   _formatError(err) {
//     if (!err) return null;
//     const fbErr = this._extractFbError(err);
//     const out   = { message: fbErr?.error_user_msg || fbErr?.message || err?.message || String(err) };
//     if (fbErr?.code)             out.meta_error_code    = fbErr.code;
//     if (fbErr?.error_subcode)    out.meta_error_subcode = fbErr.error_subcode;
//     if (fbErr?.type)             out.meta_error_type    = fbErr.type;
//     if (fbErr?.error_user_title) out.meta_user_title    = fbErr.error_user_title;
//     if (fbErr?.error_user_msg)   out.meta_user_message  = fbErr.error_user_msg;
//     if (fbErr?.fbtrace_id)       out.meta_trace_id      = fbErr.fbtrace_id;
//     if (fbErr?.error_data)       out.meta_error_data    = fbErr.error_data;
//     if (err?.status)             out.http_status        = err.status;
//     if (fbErr)                   out._raw_meta_error    = fbErr;
//     out.stack = err?.stack?.split("\n").slice(0, 4).join(" | ");
//     return out;
//   }

//   _printMetaErrorBlock(fbErr) {
//     if (!fbErr) return;
//     box([
//       `${C.bold}${C.red}OFFICIAL META API ERROR${C.reset}`,
//       `${C.gray}Code     :${C.reset} ${fbErr.code || "—"}   ${C.gray}Subcode:${C.reset} ${fbErr.error_subcode || "—"}`,
//       `${C.gray}Type     :${C.reset} ${fbErr.type || "—"}`,
//       ...(fbErr.error_user_title ? [`${C.gray}Title    :${C.reset} ${fbErr.error_user_title}`] : []),
//       ...(fbErr.error_user_msg   ? [`${C.gray}Message  :${C.reset} ${fbErr.error_user_msg}`]   : []),
//       ...(fbErr.message          ? [`${C.gray}Dev msg  :${C.reset} ${fbErr.message}`]           : []),
//       ...(fbErr.fbtrace_id       ? [`${C.gray}Trace ID :${C.reset} ${fbErr.fbtrace_id}`]        : []),
//     ], C.red);
//     if (fbErr.error_data) console.error(`${C.gray}  📋 Error data:${C.reset}`, fbErr.error_data);
//   }

//   _print(level, emoji, msg, data, err) {
//     const lc = { SUCCESS: C.green, ERROR: C.red, WARN: C.yellow, DEBUG: C.gray, INFO: C.cyan }[level] || C.white;
//     const prefix = `${lc}${emoji} [${level}]${C.reset} ${C.gray}[${this._elapsed()}]${C.reset}`;
//     const parts  = [prefix, msg];
//     if (data) parts.push(`\n${C.gray}${JSON.stringify(data, null, 2)}${C.reset}`);

//     if (level === "ERROR") {
//       console.error(...parts);
//       const fbErr = err ? this._extractFbError(err) : null;
//       if (fbErr) this._printMetaErrorBlock(fbErr);
//       if (err) console.error(`${C.red}❌ Error details:${C.reset}\n${C.gray}${JSON.stringify(this._formatError(err), null, 2)}${C.reset}`);
//     } else if (level === "WARN") {
//       console.warn(...parts);
//     } else {
//       console.log(...parts);
//     }
//   }

//   step(name) {
//     this._stepCounter++;
//     const label = `STEP ${this._stepCounter}: ${name}`;
//     console.log(`\n${C.blue}${"─".repeat(64)}${C.reset}`);
//     console.log(`${C.blue}${C.bold}🔷 ${label}${C.reset}  ${C.gray}[${this._elapsed()}]${C.reset}`);
//     console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);
//     return label;
//   }

//   start(msg) {
//     console.log(`\n${C.bgBlue}${C.bold}${"═".repeat(70)}${C.reset}`);
//     console.log(`${C.blue}${C.bold}🚀 ${msg}${C.reset}`);
//     console.log(`${C.bgBlue}${C.bold}${"═".repeat(70)}${C.reset}\n`);
//   }

//   info(msg, data = null)              { this._print("INFO",    "ℹ️ ", msg, data); }
//   success(msg, data = null)           { this._print("SUCCESS", "✅", msg, data); }
//   warn(msg, data = null)              { this._print("WARN",    "⚠️ ", msg, data); }
//   error(msg, err = null, data = null) { this._print("ERROR",   "❌", msg, data, err); }
//   meta(msg, data = null)              { this._print("INFO",    "🌐", `Meta API → ${msg}`, data); }
//   instagram(msg, data = null)         { this._print("INFO",    "📸", `Instagram → ${msg}`, data); }
//   asset(msg, data = null)             { this._print("INFO",    "🖼️ ", `Asset → ${msg}`, data); }
//   video(msg, data = null)             { this._print("INFO",    "🎬", `Video → ${msg}`, data); }
//   db(msg, data = null)                { this._print("INFO",    "💾", `DB → ${msg}`, data); }
//   debug(msg, data = null)             { this._print("DEBUG",   "🔍", msg, data); }
//   perf(msg, startMs)                  { this._print("INFO",    "⏱️ ", `${msg} — took ${Date.now() - startMs}ms`); }

//   metaError(context, params, err) {
//     const fbErr = this._extractFbError(err);
//     console.error(`\n${C.bgRed}${C.bold}${"═".repeat(60)}${C.reset}`);
//     console.error(`${C.red}${C.bold}🔴 META API CALL FAILED — ${context}${C.reset}`);
//     console.error(`${C.bgRed}${C.bold}${"═".repeat(60)}${C.reset}`);
//     console.error(`${C.yellow}📤 Params sent:${C.reset}\n${C.gray}${JSON.stringify(params, null, 2)}${C.reset}`);
//     if (fbErr) this._printMetaErrorBlock(fbErr);
//     console.error(`${C.red}🔎 Formatted:${C.reset}\n${C.gray}${JSON.stringify(this._formatError(err), null, 2)}${C.reset}`);
//     console.error(`${C.bgRed}${C.bold}${"═".repeat(60)}${C.reset}\n`);
//   }

//   divider(label = "") {
//     console.log(`\n${C.gray}${"· ".repeat(32)}${C.reset}`);
//     if (label) console.log(`${C.bold}   ${label}${C.reset}`);
//   }

//   printFinalSummary(totalMs) {
//     const o = this.outcomes;
//     console.log(`\n${C.bgBlue}${C.bold}${"═".repeat(70)}${C.reset}`);
//     console.log(`${C.blue}${C.bold}  📊 DUPLICATION RUN SUMMARY  ${C.gray}(${(totalMs / 1000).toFixed(2)}s total)${C.reset}`);
//     console.log(`${C.bgBlue}${C.bold}${"═".repeat(70)}${C.reset}\n`);

//     console.log(`${C.bold}  Pipeline:${C.reset}`);
//     checkRow("Auth",                 o.auth            === true);
//     checkRow("DB Accounts",          o.dbAccounts      === true);
//     checkRow("Campaign Fetch",       o.campaignFetch   === true);
//     checkRow("Ad Sets Fetch",        o.adSetsFetch     === true);
//     checkRow("Creatives Fetch",      o.creativesFetch  === true);
//     checkRow("Inline Asset Resolve", o.assetResolution === true || o.assetResolution === "skipped",
//       o.assetResolution === false     ? "some URLs could not be resolved" :
//       o.assetResolution === "skipped" ? "same-account — skipped" : "");
//     checkRow("Asset Transfer",       o.assetTransfer   === true || o.assetTransfer === "skipped",
//       o.assetTransfer === false     ? "transfer failed — creative will be missing image" :
//       o.assetTransfer === "skipped" ? "same-account — skipped" : "");
//     checkRow("Instagram Validation", o.igValidation    === true || o.igValidation === "skipped");
//     checkRow("Campaign → Meta",      o.campaignCreate  === true);
//     checkRow("Campaign → DB",        o.campaignDB      === true);

//     if (o.adSetsCreate.length > 0) {
//       console.log(`\n${C.bold}  Ad Sets:${C.reset}`);
//       for (const as of o.adSetsCreate) {
//         checkRow(`"${as.name}" → Meta`, as.metaOk, as.metaId ? `id: ${as.metaId}` : as.error || "");
//         checkRow(`"${as.name}" → DB`,   as.dbOk,   as.dbOk  === false ? "non-fatal" : "");
//       }
//     }

//     if (o.adsCreate.length > 0) {
//       console.log(`\n${C.bold}  Ads:${C.reset}`);
//       for (const ad of o.adsCreate) {
//         checkRow(`"${ad.name}" → Meta`, ad.metaOk, ad.metaId ? `id: ${ad.metaId}` : ad.error || "");
//         checkRow(`"${ad.name}" → DB`,   ad.dbOk,   ad.dbOk  === false ? "non-fatal" : "");
//       }
//     }

//     const metaFullOk = o.campaignCreate && o.adSetsCreate.every((a) => a.metaOk) && o.adsCreate.every((a) => a.metaOk);
//     const dbAnyFail  = !o.campaignDB    || o.adSetsCreate.some((a) => !a.dbOk)   || o.adsCreate.some((a) => !a.dbOk);

//     console.log(`\n${C.bold}  Verdict:${C.reset}`);
//     if (metaFullOk && !dbAnyFail) {
//       console.log(`  ${C.bgGreen}${C.bold}  ✅ FULLY SUCCESSFUL  ${C.reset}`);
//     } else if (metaFullOk && dbAnyFail) {
//       console.log(`  ${C.bgYellow}${C.bold}  ⚠️  META OK — DB SYNC PARTIAL  ${C.reset}`);
//     } else {
//       console.log(`  ${C.bgRed}${C.bold}  ❌ PARTIAL / FULL FAILURE  ${C.reset}`);
//       console.log(`  ${C.red}  Check errors above. Orphaned Meta objects may need manual deletion.${C.reset}`);
//     }
//     console.log(`\n${C.bgBlue}${C.bold}${"═".repeat(70)}${C.reset}\n`);
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // RATE LIMIT HANDLER
// // ─────────────────────────────────────────────────────────────────────────────

// class RateLimitHandler {
//   constructor(logger) { this.logger = logger; this.maxRetries = 3; }

//   async executeWithRetry(fn, context = "API call") {
//     for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
//       try { return await fn(); } catch (err) {
//         const isRate = this._isRateLimit(err);
//         const isLast = attempt === this.maxRetries;
//         if (!isRate || isLast) throw err;
//         const wait = Math.min(1000 * Math.pow(2, attempt + 1), 12000);
//         this.logger.warn(`Rate limit on "${context}" — retrying in ${wait}ms (attempt ${attempt + 1}/${this.maxRetries})`);
//         await this._sleep(wait);
//       }
//     }
//   }

//   _isRateLimit(err) {
//     const code = err?.code || err?.body?.error?.code;
//     return [4, 17, 32, 613, 80004].includes(code);
//   }

//   _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // HELPERS
// // ─────────────────────────────────────────────────────────────────────────────

// const META_API_VERSION = process.env.META_API_VERSION || "v24.0";

// function _previewUrl(url, len = 110) {
//   if (!url) return "(none)";
//   return url.length > len ? url.substring(0, len) + "…" : url;
// }

// function isFacebookCdnUrl(url) {
//   if (!url) return false;
//   try {
//     const host = new URL(url).hostname;
//     return host.endsWith("fbcdn.net") || host.endsWith("cdninstagram.com") || host.includes("fbcdn");
//   } catch { return false; }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // Magic-byte image validation
// // ─────────────────────────────────────────────────────────────────────────────
// function validateImageBuffer(buffer, logger) {
//   if (!buffer || buffer.length < 12) {
//     throw new Error(`Downloaded buffer too small (${buffer?.length || 0} bytes)`);
//   }
//   if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "jpeg";
//   if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "png";
//   if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return "gif";
//   if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
//       buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "webp";

//   const hexPreview = Array.from(buffer.slice(0, 32)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
//   logger.warn(`  Image buffer magic bytes unrecognized — first 32 bytes: ${hexPreview}`);

//   if (buffer[0] === 0x3C) {
//     const textPreview = buffer.slice(0, 200).toString("utf8");
//     throw new Error(
//       `Downloaded content is HTML (not an image). CDN URL may be geo-blocked or expired. ` +
//       `Preview: ${textPreview.substring(0, 120)}`
//     );
//   }
//   throw new Error(`Buffer (${buffer.length} bytes) is not a valid image. Hex: ${hexPreview}`);
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // INLINE ASSET RESOLVER  (v7.0 — FIX-17, FIX-18)
// //
// // FIX-17: Image hashes are resolved via:
// //   GET /act_{sourceMetaAccountId}/adimages?hashes=[hash1,hash2,...]&fields=hash,url
// //   NOT via GET /{hash}?fields=url (which always 400s — hash ≠ node ID).
// //
// // FIX-18: Constructor now requires sourceMetaAccountId to build the correct
// //   /adimages endpoint.
// // ─────────────────────────────────────────────────────────────────────────────

// class InlineAssetResolver {
//   // ── FIX-18: added sourceMetaAccountId parameter ───────────────────────────
//   constructor(logger, rateLimiter, sourceAccessToken, sourceMetaAccountId) {
//     this.logger               = logger;
//     this.rateLimiter          = rateLimiter;
//     this.sourceAccessToken    = sourceAccessToken;

//     // Normalise to "act_XXXX" format
//     const raw = String(sourceMetaAccountId || "");
//     this.sourceMetaAccountId  = raw.startsWith("act_") ? raw : `act_${raw}`;

//     this.hashToUrl    = {};
//     this.videoIdToUrl = {};

//     this._stats = {
//       imagesResolved: 0,
//       imagesFailed:   0,
//       videosResolved: 0,
//       videosFailed:   0,
//     };
//   }

//   // ──────────────────────────────────────────────────────────────────────────
//   async resolveAll(adsWithCreatives) {
//     const t0 = Date.now();

//     console.log(`\n${C.magenta}${"─".repeat(64)}${C.reset}`);
//     console.log(`${C.magenta}${C.bold}  🔎 INLINE ASSET RESOLUTION (v7.0)${C.reset}`);
//     console.log(`${C.magenta}  Resolving image hashes via /adimages edge (FIX-17)${C.reset}`);
//     console.log(`${C.magenta}  sourceAccount: ${this.sourceMetaAccountId}${C.reset}`);
//     console.log(`${C.magenta}${"─".repeat(64)}${C.reset}`);

//     const { uniqueHashes, uniqueVideoIds } = this._discoverFromCreatives(adsWithCreatives);

//     this.logger.asset("Discovered unique assets to resolve", {
//       uniqueImageHashes: uniqueHashes.size,
//       uniqueVideoIds:    uniqueVideoIds.size,
//     });

//     if (uniqueHashes.size > 0) {
//       console.log(`\n${C.magenta}  ┌─ IMAGE URL RESOLUTION (${uniqueHashes.size} unique hashes)${C.reset}`);
//       await this._resolveImages(uniqueHashes);
//       console.log(`${C.magenta}  └─────${C.reset}`);
//     } else {
//       this.logger.asset("No image hashes found in creatives — skipping image resolution");
//     }

//     if (uniqueVideoIds.size > 0) {
//       console.log(`\n${C.magenta}  ┌─ VIDEO URL RESOLUTION (${uniqueVideoIds.size} unique video IDs)${C.reset}`);
//       await this._resolveVideos(uniqueVideoIds);
//       console.log(`${C.magenta}  └─────${C.reset}`);
//     } else {
//       this.logger.video("No video IDs found in creatives — skipping video resolution");
//     }

//     this._printResolutionManifest(uniqueHashes, uniqueVideoIds);

//     const allOk = this._stats.imagesFailed === 0 && this._stats.videosFailed === 0;

//     this.logger.asset(`✅ Inline resolution complete — ${Date.now() - t0}ms`, {
//       allOk,
//       stats:          this._stats,
//       resolvedImages: Object.keys(this.hashToUrl).length,
//       resolvedVideos: Object.keys(this.videoIdToUrl).length,
//     });

//     console.log(`${C.magenta}${"─".repeat(64)}${C.reset}\n`);

//     return {
//       hashToUrl:    this.hashToUrl,
//       videoIdToUrl: this.videoIdToUrl,
//       stats:        this._stats,
//       allOk,
//     };
//   }

//   // ──────────────────────────────────────────────────────────────────────────
//   _discoverFromCreatives(adsWithCreatives) {
//     const uniqueHashes   = new Set();
//     const uniqueVideoIds = new Set();

//     for (const item of adsWithCreatives) {
//       const spec = item.creative?.object_story_spec;
//       if (!spec) continue;

//       if (spec.photo_data?.image_hash)  uniqueHashes.add(spec.photo_data.image_hash);
//       if (spec.link_data?.image_hash)   uniqueHashes.add(spec.link_data.image_hash);

//       for (const child of (spec.link_data?.child_attachments || [])) {
//         if (child.image_hash) uniqueHashes.add(child.image_hash);
//       }

//       if (spec.video_data?.video_id) {
//         uniqueVideoIds.add(String(spec.video_data.video_id));
//         if (spec.video_data.image_hash) uniqueHashes.add(spec.video_data.image_hash);
//       }

//       this.logger.debug(`  Scanned creative for "${item.adName}"`, {
//         creativeId:    item.creativeId,
//         foundHashes:   [
//           spec.photo_data?.image_hash,
//           spec.link_data?.image_hash,
//           spec.video_data?.image_hash,
//           ...(spec.link_data?.child_attachments || []).map((c) => c.image_hash),
//         ].filter(Boolean).map((h) => h.substring(0, 12) + "…"),
//         foundVideoIds: spec.video_data?.video_id ? [spec.video_data.video_id] : [],
//       });
//     }

//     this.logger.asset("Asset discovery from creatives complete", {
//       uniqueHashes:   uniqueHashes.size,
//       uniqueVideoIds: uniqueVideoIds.size,
//     });

//     return { uniqueHashes, uniqueVideoIds };
//   }

//   // ──────────────────────────────────────────────────────────────────────────
//   // FIX-17: Resolve image hashes → CDN URLs via /adimages?hashes=[...] edge.
//   //
//   // The WRONG approach (v6.0):
//   //   GET /{hash}?fields=url  →  400 "Object does not exist"
//   //   (image hash is NOT a Graph API node ID)
//   //
//   // The CORRECT approach (v7.0):
//   //   GET /act_{id}/adimages?hashes=["hash1","hash2"]&fields=hash,url
//   //   Response: { data: [ { hash, url, width, height }, ... ] }
//   //
//   // Batched in chunks of 50 to stay within URL length limits.
//   // ──────────────────────────────────────────────────────────────────────────
//   async _resolveImages(uniqueHashes) {
//     const CHUNK_SIZE  = 50;
//     const hashArray   = [...uniqueHashes];
//     const totalChunks = Math.ceil(hashArray.length / CHUNK_SIZE);

//     console.log(`\n${C.magenta}  │  Fetching ${hashArray.length} hash(es) via /adimages edge` +
//       ` (${totalChunks} batch(es) of up to ${CHUNK_SIZE})${C.reset}`);
//     console.log(`${C.magenta}  │  endpoint: GET /${this.sourceMetaAccountId}/adimages?hashes=[...]&fields=hash,url${C.reset}`);

//     for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
//       const chunk    = hashArray.slice(chunkIdx * CHUNK_SIZE, (chunkIdx + 1) * CHUNK_SIZE);
//       const t0Chunk  = Date.now();

//       console.log(`\n${C.magenta}  │  ── Batch ${chunkIdx + 1}/${totalChunks}  (${chunk.length} hashes) ──${C.reset}`);

//       // Build the hashes[] query param — Meta expects a JSON-encoded array
//       const hashesParam = encodeURIComponent(JSON.stringify(chunk));
//       const endpoint    =
//         `https://graph.facebook.com/${META_API_VERSION}/${this.sourceMetaAccountId}/adimages` +
//         `?hashes=${hashesParam}&fields=hash,url,width,height` +
//         `&access_token=${this.sourceAccessToken}`;

//       try {
//         const ctrl  = new AbortController();
//         const timer = setTimeout(() => ctrl.abort(), 20_000);
//         let res, data;
//         try {
//           res  = await fetch(endpoint, { signal: ctrl.signal });
//           data = await res.json();
//         } finally { clearTimeout(timer); }

//         console.log(`  ${C.gray}│  → HTTP ${res.status}  hasData=${!!data?.data}  hasError=${!!data?.error}  ms=${Date.now() - t0Chunk}${C.reset}`);

//         if (data?.error) {
//           const errMsg = data.error.message || JSON.stringify(data.error);
//           console.error(`  ${C.red}│  → Meta error on batch ${chunkIdx + 1}: ${errMsg}${C.reset}`);
//           // Mark all hashes in this chunk as failed
//           for (const hash of chunk) {
//             if (!this.hashToUrl[hash]) this._stats.imagesFailed++;
//           }
//           continue;
//         }

//         // Response shape: { data: [ { hash, url, width, height }, ... ] }
//         const entries     = data?.data || [];
//         const returnedSet = new Set(entries.map((e) => e.hash));

//         for (const entry of entries) {
//           if (!entry.hash || !entry.url) continue;

//           const isCdn  = isFacebookCdnUrl(entry.url);
//           const host   = (() => { try { return new URL(entry.url).hostname; } catch { return "?"; } })();
//           const hDisp  = entry.hash.substring(0, 14) + "…";

//           this.hashToUrl[entry.hash] = entry.url;
//           this._stats.imagesResolved++;

//           if (isCdn) {
//             console.log(`  ${C.green}│  → ✅ ${hDisp}  host=${host}${entry.width ? `  ${entry.width}×${entry.height}` : ""}${C.reset}`);
//           } else {
//             console.log(`  ${C.yellow}│  → ⚠️  ${hDisp}  NON-CDN url — may fail download  host=${host}${C.reset}`);
//           }
//           console.log(`  ${C.gray}│     url=${_previewUrl(entry.url, 90)}${C.reset}`);
//         }

//         // Any hash in the chunk that wasn't returned by Meta → failed
//         for (const hash of chunk) {
//           if (!returnedSet.has(hash)) {
//             const hDisp = hash.substring(0, 14) + "…";
//             console.error(`  ${C.red}│  → ❌ ${hDisp}  not returned by /adimages (may not exist in source account)${C.reset}`);
//             this._stats.imagesFailed++;
//           }
//         }

//       } catch (err) {
//         console.error(`  ${C.red}│  → ❌ EXCEPTION on batch ${chunkIdx + 1}: ${err?.message}${C.reset}`);
//         for (const hash of chunk) {
//           if (!this.hashToUrl[hash]) this._stats.imagesFailed++;
//         }
//         this.logger.error(`/adimages batch ${chunkIdx + 1} exception`, err);
//       }
//     }
//   }

//   // ──────────────────────────────────────────────────────────────────────────
//   // Resolve video IDs → playable URLs (unchanged from v6.0)
//   // ──────────────────────────────────────────────────────────────────────────
//   async _resolveVideos(uniqueVideoIds) {
//     let idx = 0;
//     for (const videoId of uniqueVideoIds) {
//       idx++;
//       const t0 = Date.now();

//       console.log(`\n${C.magenta}  │  VID ${idx}/${uniqueVideoIds.size}  id=${C.cyan}${videoId}${C.reset}`);

//       if (this.videoIdToUrl[videoId]) {
//         console.log(`  ${C.gray}│  → cache HIT — url already resolved${C.reset}`);
//         continue;
//       }

//       try {
//         const endpoint =
//           `https://graph.facebook.com/${META_API_VERSION}/${videoId}` +
//           `?fields=source,playable_url,status,title,length&access_token=${this.sourceAccessToken}`;

//         console.log(`  ${C.gray}│  → GET /{videoId}?fields=source,playable_url,status,title,length${C.reset}`);

//         const ctrl  = new AbortController();
//         const timer = setTimeout(() => ctrl.abort(), 15_000);
//         let res, data;
//         try {
//           res  = await fetch(endpoint, { signal: ctrl.signal });
//           data = await res.json();
//         } finally { clearTimeout(timer); }

//         console.log(`  ${C.gray}│  → HTTP ${res.status}  hasSource=${!!data?.source}  hasPlayable=${!!data?.playable_url}  hasError=${!!data?.error}${C.reset}`);

//         if (data?.error) {
//           console.error(`  ${C.red}│  → Meta error: ${data.error.message || JSON.stringify(data.error)}${C.reset}`);
//           this._stats.videosFailed++;
//           continue;
//         }

//         if (data?.title)  console.log(`  ${C.gray}│  → title=${data.title}${C.reset}`);
//         if (data?.length) console.log(`  ${C.gray}│  → duration=${data.length}s${C.reset}`);

//         const videoStatus = data?.status?.video_status || "unknown";
//         console.log(`  ${C.gray}│  → videoStatus=${videoStatus}${C.reset}`);

//         if (data?.source) {
//           this.videoIdToUrl[videoId] = data.source;
//           this._stats.videosResolved++;
//           const host = (() => { try { return new URL(data.source).hostname; } catch { return "?"; } })();
//           console.log(`  ${C.green}│  → ✅ RESOLVED via source (direct mp4)  host=${host}  ms=${Date.now() - t0}${C.reset}`);
//           console.log(`  ${C.gray}│  → url=${_previewUrl(data.source, 90)}${C.reset}`);
//         } else if (data?.playable_url) {
//           this.videoIdToUrl[videoId] = data.playable_url;
//           this._stats.videosResolved++;
//           const host = (() => { try { return new URL(data.playable_url).hostname; } catch { return "?"; } })();
//           console.log(`  ${C.green}│  → ✅ RESOLVED via playable_url  host=${host}  ms=${Date.now() - t0}${C.reset}`);
//           console.log(`  ${C.gray}│  → url=${_previewUrl(data.playable_url, 90)}${C.reset}`);
//         } else {
//           console.error(
//             `  ${C.red}│  → ❌ FAILED — neither source nor playable_url returned${C.reset}\n` +
//             `  ${C.red}│     videoStatus="${videoStatus}"  response: ${JSON.stringify(data).substring(0, 200)}${C.reset}`
//           );
//           this._stats.videosFailed++;
//         }
//       } catch (err) {
//         console.error(`  ${C.red}│  → ❌ EXCEPTION  ms=${Date.now() - t0}  error=${err?.message}${C.reset}`);
//         this._stats.videosFailed++;
//         this.logger.error(`Video URL resolution failed for id ${videoId}`, err);
//       }
//     }
//   }

//   // ──────────────────────────────────────────────────────────────────────────
//   _printResolutionManifest(uniqueHashes, uniqueVideoIds) {
//     console.log(`\n${C.blue}${"─".repeat(64)}${C.reset}`);
//     console.log(`${C.blue}${C.bold}  📦 RESOLVED ASSET MANIFEST (pre-transfer)${C.reset}`);
//     console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);

//     let n = 0;
//     for (const hash of uniqueHashes) {
//       n++;
//       const url      = this.hashToUrl[hash];
//       const hashDisp = hash.substring(0, 14) + "…";
//       if (url) {
//         const isCdn = isFacebookCdnUrl(url);
//         const host  = (() => { try { return new URL(url).hostname; } catch { return "?"; } })();
//         console.log(
//           `  ${C.gray}IMG ${n}${C.reset}  hash=${C.cyan}${hashDisp}${C.reset}` +
//           `  ${C.green}✓ RESOLVED${C.reset}` +
//           `  isCdn=${isCdn}  host=${C.gray}${host}${C.reset}` +
//           `  url=${C.gray}${_previewUrl(url, 60)}${C.reset}`
//         );
//       } else {
//         console.log(
//           `  ${C.gray}IMG ${n}${C.reset}  hash=${C.cyan}${hashDisp}${C.reset}` +
//           `  ${C.red}✗ NO URL — image will be missing from duplicated creative${C.reset}`
//         );
//       }
//     }

//     n = 0;
//     for (const videoId of uniqueVideoIds) {
//       n++;
//       const url = this.videoIdToUrl[videoId];
//       if (url) {
//         const host = (() => { try { return new URL(url).hostname; } catch { return "?"; } })();
//         console.log(
//           `  ${C.gray}VID ${n}${C.reset}  id=${C.cyan}${videoId}${C.reset}` +
//           `  ${C.green}✓ RESOLVED${C.reset}` +
//           `  host=${C.gray}${host}${C.reset}` +
//           `  url=${C.gray}${_previewUrl(url, 60)}${C.reset}`
//         );
//       } else {
//         console.log(
//           `  ${C.gray}VID ${n}${C.reset}  id=${C.cyan}${videoId}${C.reset}` +
//           `  ${C.red}✗ NO URL — video will be missing from duplicated creative${C.reset}`
//         );
//       }
//     }

//     console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);
//     console.log(
//       `  Images : ${C.green}${this._stats.imagesResolved} resolved${C.reset}` +
//       `  ${this._stats.imagesFailed > 0 ? C.red : C.gray}${this._stats.imagesFailed} failed${C.reset}`
//     );
//     console.log(
//       `  Videos : ${C.green}${this._stats.videosResolved} resolved${C.reset}` +
//       `  ${this._stats.videosFailed > 0 ? C.red : C.gray}${this._stats.videosFailed} failed${C.reset}`
//     );
//     console.log(`${C.blue}${"─".repeat(64)}${C.reset}\n`);
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // ASSET TRANSFER MANAGER  (v7.0 — unchanged internals)
// // ─────────────────────────────────────────────────────────────────────────────

// class AssetTransferManager {
//   constructor(logger, rateLimiter, sourceAccount, targetAccount) {
//     this.logger        = logger;
//     this.rateLimiter   = rateLimiter;
//     this.sourceAccount = sourceAccount;
//     this.targetAccount = targetAccount;

//     this.imageHashMap = {};
//     this.videoIdMap   = {};

//     this._stats = {
//       imagesTransferred: 0,
//       imagesFailed:      0,
//       videosTransferred: 0,
//       videosFailed:      0,
//     };

//     this._hashToUrl    = {};
//     this._videoIdToUrl = {};
//   }

//   loadResolvedMaps(hashToUrl, videoIdToUrl) {
//     console.log(`\n${C.cyan}${"─".repeat(64)}${C.reset}`);
//     console.log(`${C.cyan}${C.bold}  📥 LOADING INLINE-RESOLVED ASSET MAPS${C.reset}`);
//     console.log(`${C.cyan}${"─".repeat(64)}${C.reset}`);

//     this._hashToUrl    = hashToUrl    || {};
//     this._videoIdToUrl = videoIdToUrl || {};

//     let imgLoaded = 0, imgMissing = 0;
//     for (const [hash, url] of Object.entries(this._hashToUrl)) {
//       if (url) {
//         imgLoaded++;
//         this.logger.debug("  Image map entry", {
//           hash:       hash.substring(0, 16) + "…",
//           isCdn:      isFacebookCdnUrl(url),
//           urlPreview: _previewUrl(url, 80),
//         });
//       } else {
//         imgMissing++;
//         this.logger.warn("  Image map entry has null URL", { hash: hash.substring(0, 12) + "…" });
//       }
//     }

//     let vidLoaded = 0, vidMissing = 0;
//     for (const [id, url] of Object.entries(this._videoIdToUrl)) {
//       if (url) { vidLoaded++; this.logger.debug("  Video map entry", { id, urlPreview: _previewUrl(url, 80) }); }
//       else      { vidMissing++; this.logger.warn("  Video map entry has null URL", { id }); }
//     }

//     this.logger.asset("✅ Resolved maps loaded into transfer manager", {
//       images: { loaded: imgLoaded, missing: imgMissing },
//       videos: { loaded: vidLoaded, missing: vidMissing },
//     });
//     console.log(`${C.cyan}${"─".repeat(64)}${C.reset}\n`);
//   }

//   async transferAllAssets(adsWithCreatives) {
//     const t0 = Date.now();
//     this.logger.asset("🚦 Starting asset transfer pipeline…", {
//       totalAds:            adsWithCreatives.length,
//       libraryImagesLoaded: Object.keys(this._hashToUrl).length,
//       libraryVideosLoaded: Object.keys(this._videoIdToUrl).length,
//     });

//     const { uniqueImages, uniqueVideos } = this._discoverAssets(adsWithCreatives);
//     this._logPreTransferManifest(uniqueImages, uniqueVideos);

//     if (uniqueImages.size > 0) {
//       this.logger.divider(`IMAGE TRANSFERS  (${uniqueImages.size} unique)`);
//       await this._transferImages(uniqueImages);
//     } else {
//       this.logger.asset("ℹ️  No images discovered in creatives — skipping image transfer");
//     }

//     if (uniqueVideos.size > 0) {
//       this.logger.divider(`VIDEO TRANSFERS  (${uniqueVideos.size} unique)`);
//       await this._transferVideos(uniqueVideos);
//     } else {
//       this.logger.video("ℹ️  No videos discovered in creatives — skipping video transfer");
//     }

//     this._logPostTransferResults(uniqueImages, uniqueVideos);

//     const noAssets = uniqueImages.size === 0 && uniqueVideos.size === 0;
//     const allOk    = noAssets || (this._stats.imagesFailed === 0 && this._stats.videosFailed === 0);

//     this.logger.asset(`🏁 Asset transfer pipeline complete — ${Date.now() - t0}ms`, {
//       allOk, stats: this._stats,
//       imageHashMapSize: Object.keys(this.imageHashMap).length,
//       videoIdMapSize:   Object.keys(this.videoIdMap).length,
//     });

//     return { imageHashMap: this.imageHashMap, videoIdMap: this.videoIdMap, stats: this._stats, allOk };
//   }

//   _discoverAssets(adsWithCreatives) {
//     const uniqueImages = new Map();
//     const uniqueVideos = new Map();
//     let adsWithSpec = 0, adsWithoutSpec = 0;

//     for (const item of adsWithCreatives) {
//       const spec = item.creative?.object_story_spec;
//       if (!spec) { adsWithoutSpec++; continue; }
//       adsWithSpec++;
//       this._extractFromPhotoData(spec.photo_data, uniqueImages);
//       this._extractFromLinkData(spec.link_data, uniqueImages);
//       this._extractFromVideoData(spec.video_data, uniqueImages, uniqueVideos);
//       for (const child of (spec.link_data?.child_attachments || [])) {
//         this._extractFromLinkData(child, uniqueImages);
//       }
//     }

//     this.logger.asset("🔍 Asset discovery complete", {
//       adsScanned: adsWithCreatives.length, adsWithSpec, adsWithoutSpec,
//       uniqueImages: uniqueImages.size, uniqueVideos: uniqueVideos.size,
//     });

//     return { uniqueImages, uniqueVideos };
//   }

//   _extractFromPhotoData(data, uniqueImages) {
//     if (!data?.image_hash) return;
//     uniqueImages.set(data.image_hash, data.url || null);
//   }

//   _extractFromLinkData(data, uniqueImages) {
//     if (!data) return;
//     if (data.image_hash) uniqueImages.set(data.image_hash, data.image_url || null);
//   }

//   _extractFromVideoData(data, uniqueImages, uniqueVideos) {
//     if (!data?.video_id) return;
//     uniqueVideos.set(data.video_id, { thumbnailHash: data.image_hash || null, thumbnailUrl: data.image_url || null });
//     if (data.image_hash) uniqueImages.set(data.image_hash, data.image_url || null);
//   }

//   _logPreTransferManifest(uniqueImages, uniqueVideos) {
//     console.log(`\n${C.blue}${"─".repeat(64)}${C.reset}`);
//     console.log(`${C.blue}${C.bold}  📦 PRE-TRANSFER ASSET MANIFEST${C.reset}`);
//     console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);

//     if (uniqueImages.size === 0 && uniqueVideos.size === 0) {
//       console.log(`  ${C.gray}(no assets to transfer)${C.reset}`);
//     }

//     let n = 0;
//     for (const [hash] of uniqueImages) {
//       n++;
//       const url      = this._hashToUrl[hash];
//       const hashDisp = hash.substring(0, 14) + "…";
//       if (url) {
//         const host = (() => { try { return new URL(url).hostname; } catch { return "?"; } })();
//         console.log(
//           `  ${C.gray}IMG ${n}${C.reset}  hash=${C.cyan}${hashDisp}${C.reset}` +
//           `  source=${C.green}[inline-resolved]${C.reset}  method=${C.yellow}binary-download${C.reset}` +
//           `  host=${C.gray}${host}${C.reset}  url=${C.gray}${_previewUrl(url, 60)}${C.reset}`
//         );
//       } else {
//         console.log(
//           `  ${C.gray}IMG ${n}${C.reset}  hash=${C.cyan}${hashDisp}${C.reset}` +
//           `  ${C.red}✗ NO URL — inline resolution failed for this hash${C.reset}`
//         );
//       }
//     }

//     n = 0;
//     for (const [videoId] of uniqueVideos) {
//       n++;
//       const url = this._videoIdToUrl[String(videoId)];
//       if (url) {
//         const host = (() => { try { return new URL(url).hostname; } catch { return "?"; } })();
//         console.log(
//           `  ${C.gray}VID ${n}${C.reset}  id=${C.cyan}${videoId}${C.reset}` +
//           `  source=${C.green}[inline-resolved]${C.reset}  method=${C.yellow}binary-download${C.reset}` +
//           `  host=${C.gray}${host}${C.reset}  url=${C.gray}${_previewUrl(url, 60)}${C.reset}`
//         );
//       } else {
//         console.log(
//           `  ${C.gray}VID ${n}${C.reset}  id=${C.cyan}${videoId}${C.reset}` +
//           `  ${C.red}✗ NO URL — inline resolution failed for this video${C.reset}`
//         );
//       }
//     }

//     console.log(`${C.blue}${"─".repeat(64)}${C.reset}\n`);
//   }

//   async _transferImages(uniqueImages) {
//     let idx = 0;
//     for (const [sourceHash] of uniqueImages) {
//       idx++;
//       const t0       = Date.now();
//       const hashDisp = sourceHash.substring(0, 16) + "…";
//       const label    = `Image ${idx}/${uniqueImages.size}  hash: ${hashDisp}`;

//       console.log(`\n${C.cyan}  ┌─ ${label}${C.reset}`);

//       const libraryUrl = this._hashToUrl[sourceHash];

//       if (!libraryUrl) {
//         this._stats.imagesFailed++;
//         console.error(
//           `  ${C.red}│ ❌ SKIPPED — no URL for this hash (inline resolution failed)${C.reset}\n` +
//           `  ${C.red}│    hash=${sourceHash.substring(0, 16)}…${C.reset}`
//         );
//         console.log(`  ${C.cyan}└─────${C.reset}`);
//         continue;
//       }

//       const isCdn   = isFacebookCdnUrl(libraryUrl);
//       const urlHost = (() => { try { return new URL(libraryUrl).hostname; } catch { return "?"; } })();

//       console.log(`  ${C.gray}│ URL source   : inline-resolved (GET /adimages?hashes=[...])${C.reset}`);
//       console.log(`  ${C.gray}│ isFbCdn      : ${isCdn}${C.reset}`);
//       console.log(`  ${C.gray}│ urlHost      : ${urlHost}${C.reset}`);
//       console.log(`  ${C.gray}│ url          : ${_previewUrl(libraryUrl, 100)}${C.reset}`);
//       console.log(`  ${C.gray}│ uploadMethod : binary-download → binary-upload${C.reset}`);

//       try {
//         const targetHash = await this.rateLimiter.executeWithRetry(
//           () => this._downloadAndUploadImage(libraryUrl, sourceHash),
//           `Upload image ${hashDisp}`
//         );
//         this.imageHashMap[sourceHash] = targetHash;
//         this._stats.imagesTransferred++;
//         console.log(
//           `  ${C.green}│ ✅ SUCCESS  targetHash=${targetHash.substring(0, 16)}…` +
//           `  sameHash=${targetHash === sourceHash}  tookMs=${Date.now() - t0}${C.reset}`
//         );
//       } catch (err) {
//         this._stats.imagesFailed++;
//         console.error(`  ${C.red}│ ❌ FAILED  tookMs=${Date.now() - t0}${C.reset}`);
//         console.error(`  ${C.red}│ error     : ${err?.message || String(err)}${C.reset}`);
//         if (err?.code)          console.error(`  ${C.red}│ metaCode  : ${err.code}${C.reset}`);
//         if (err?.error_subcode) console.error(`  ${C.red}│ subcode   : ${err.error_subcode}${C.reset}`);
//         if (err?.fbtrace_id)    console.error(`  ${C.red}│ traceId   : ${err.fbtrace_id}${C.reset}`);
//         this.logger.error(`❌ ${label} FAILED`, err, { sourceHash, libraryUrl: _previewUrl(libraryUrl, 80) });
//       }

//       console.log(`  ${C.cyan}└─────${C.reset}`);
//     }
//   }

//   async _downloadAndUploadImage(imageUrl, sourceHash) {
//     const rawId    = this.targetAccount.metaAccountId;
//     const cleanId  = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
//     const endpoint = `https://graph.facebook.com/${META_API_VERSION}/${cleanId}/adimages`;

//     console.log(`  ${C.gray}│ [DOWNLOAD] Starting binary download…${C.reset}`);
//     console.log(`  ${C.gray}│ [DOWNLOAD] URL: ${_previewUrl(imageUrl, 100)}${C.reset}`);

//     const dlCtrl  = new AbortController();
//     const dlTimer = setTimeout(() => dlCtrl.abort(), 30_000);
//     let downloadRes;
//     try {
//       downloadRes = await fetch(imageUrl, {
//         headers: {
//           "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
//           "Accept":     "image/*,*/*;q=0.8",
//           "Referer":    "https://www.facebook.com/",
//         },
//         signal: dlCtrl.signal,
//       });
//     } finally { clearTimeout(dlTimer); }

//     console.log(`  ${C.gray}│ [DOWNLOAD] HTTP status    : ${downloadRes.status}${C.reset}`);
//     console.log(`  ${C.gray}│ [DOWNLOAD] content-type   : ${downloadRes.headers.get("content-type") || "—"}${C.reset}`);
//     console.log(`  ${C.gray}│ [DOWNLOAD] x-deny-reason  : ${downloadRes.headers.get("x-deny-reason") || "—"}${C.reset}`);

//     if (!downloadRes.ok) {
//       const err         = new Error(`CDN download failed: HTTP ${downloadRes.status} from ${_previewUrl(imageUrl, 80)}`);
//       err.status        = downloadRes.status;
//       err.code          = 100;
//       err.error_subcode = 2490361;
//       throw err;
//     }

//     const buffer = Buffer.from(await downloadRes.arrayBuffer());

//     console.log(`  ${C.gray}│ [DOWNLOAD] Size           : ${(buffer.length / 1024).toFixed(1)} KB (${buffer.length} bytes)${C.reset}`);

//     if (buffer.length === 0) throw new Error("CDN download returned 0 bytes");

//     let detectedType;
//     try {
//       detectedType = validateImageBuffer(buffer, this.logger);
//       console.log(`  ${C.gray}│ [VALIDATE] Magic bytes OK : ${detectedType}${C.reset}`);
//     } catch (validationErr) {
//       const err         = new Error(`Image validation failed: ${validationErr.message}`);
//       err.code          = 100;
//       err.error_subcode = 2490361;
//       throw err;
//     }

//     const ext      = detectedType === "png" ? "png" : detectedType === "gif" ? "gif" : detectedType === "webp" ? "webp" : "jpg";
//     const mimeType = detectedType === "png" ? "image/png" : detectedType === "gif" ? "image/gif" : detectedType === "webp" ? "image/webp" : "image/jpeg";
//     const filename = `image_${sourceHash.substring(0, 8)}.${ext}`;

//     console.log(`  ${C.gray}│ [UPLOAD] Starting binary upload to Meta…${C.reset}`);
//     console.log(`  ${C.gray}│ [UPLOAD] filename         : ${filename}${C.reset}`);
//     console.log(`  ${C.gray}│ [UPLOAD] mimeType         : ${mimeType}${C.reset}`);
//     console.log(`  ${C.gray}│ [UPLOAD] size             : ${(buffer.length / 1024).toFixed(1)} KB${C.reset}`);
//     console.log(`  ${C.gray}│ [UPLOAD] endpoint         : ${endpoint.replace(/act_\d+/, "act_***")}${C.reset}`);

//     const boundary = `----FormBoundary${Date.now().toString(16)}`;
//     let bodyStr    = `--${boundary}\r\n`;
//     bodyStr       += `Content-Disposition: form-data; name="${filename}"; filename="${filename}"\r\n`;
//     bodyStr       += `Content-Type: ${mimeType}\r\n\r\n`;
//     bodyStr       += buffer.toString("binary");
//     bodyStr       += `\r\n--${boundary}--`;

//     const upCtrl  = new AbortController();
//     const upTimer = setTimeout(() => upCtrl.abort(), 60_000);
//     let uploadRes, body;
//     try {
//       uploadRes = await fetch(endpoint, {
//         method:  "POST",
//         headers: {
//           Authorization:  `Bearer ${this.targetAccount.accessToken}`,
//           "Content-Type": `multipart/form-data; boundary=${boundary}`,
//         },
//         body:   Buffer.from(bodyStr, "binary"),
//         signal: upCtrl.signal,
//       });
//       body = await uploadRes.json();
//     } finally { clearTimeout(upTimer); }

//     console.log(`  ${C.gray}│ [UPLOAD] HTTP status      : ${uploadRes.status}${C.reset}`);
//     console.log(`  ${C.gray}│ [UPLOAD] hasImages        : ${!!body?.images}${C.reset}`);
//     console.log(`  ${C.gray}│ [UPLOAD] imageKeys        : ${body?.images ? Object.keys(body.images).join(", ") : "—"}${C.reset}`);
//     if (body?.error) {
//       console.error(`  ${C.red}│ [UPLOAD] Meta error code  : ${body.error.code || "—"}${C.reset}`);
//       console.error(`  ${C.red}│ [UPLOAD] Meta error sub   : ${body.error.error_subcode || "—"}${C.reset}`);
//       console.error(`  ${C.red}│ [UPLOAD] Meta error msg   : ${body.error.message || "—"}${C.reset}`);
//       console.error(`  ${C.red}│ [UPLOAD] Meta error trace : ${body.error.fbtrace_id || "—"}${C.reset}`);
//     }

//     if (!uploadRes.ok || body?.error) {
//       const err         = new Error(body?.error?.message || `Image upload HTTP ${uploadRes.status}`);
//       err.code          = body?.error?.code;
//       err.error_subcode = body?.error?.error_subcode;
//       err.fbtrace_id    = body?.error?.fbtrace_id;
//       err.response      = body?.error;
//       err.status        = uploadRes.status;
//       throw err;
//     }

//     const images = body.images || {};
//     const keys   = Object.keys(images);
//     if (keys.length === 0) throw new Error(`/adimages upload: no image entry in response — body: ${JSON.stringify(body).substring(0, 200)}`);
//     const newHash = images[keys[0]]?.hash;
//     if (!newHash) throw new Error(`/adimages upload: response missing hash — entry: ${JSON.stringify(images[keys[0]]).substring(0, 200)}`);

//     console.log(`  ${C.gray}│ [UPLOAD] newHash          : ${newHash.substring(0, 16)}…${C.reset}`);
//     return newHash;
//   }

//   async _transferVideos(uniqueVideos) {
//     let idx = 0;
//     for (const [sourceVideoId] of uniqueVideos) {
//       idx++;
//       const t0    = Date.now();
//       const label = `Video ${idx}/${uniqueVideos.size}  id: ${sourceVideoId}`;

//       console.log(`\n${C.cyan}  ┌─ ${label}${C.reset}`);

//       const playableUrl = this._videoIdToUrl[String(sourceVideoId)];

//       if (!playableUrl) {
//         this._stats.videosFailed++;
//         console.error(
//           `  ${C.red}│ ❌ SKIPPED — no URL for this video (inline resolution failed)${C.reset}\n` +
//           `  ${C.red}│    videoId=${sourceVideoId}${C.reset}`
//         );
//         console.log(`  ${C.cyan}└─────${C.reset}`);
//         continue;
//       }

//       const urlHost = (() => { try { return new URL(playableUrl).hostname; } catch { return "?"; } })();
//       console.log(`  ${C.gray}│ URL source   : inline-resolved (GET /{videoId}?fields=source,playable_url)${C.reset}`);
//       console.log(`  ${C.gray}│ urlHost      : ${urlHost}${C.reset}`);
//       console.log(`  ${C.gray}│ url          : ${_previewUrl(playableUrl, 100)}${C.reset}`);
//       console.log(`  ${C.gray}│ uploadMethod : binary-download → binary-upload${C.reset}`);

//       try {
//         const newVideoId = await this._downloadAndUploadVideo(sourceVideoId, playableUrl);
//         this.videoIdMap[sourceVideoId] = newVideoId;
//         this._stats.videosTransferred++;
//         console.log(`  ${C.green}│ ✅ Uploaded  newVideoId=${newVideoId}  elapsed=${Date.now() - t0}ms${C.reset}`);
//         console.log(`  ${C.gray}│ ⏳ Polling for ready status…${C.reset}`);
//         await this._pollVideoReady(newVideoId);
//         console.log(`  ${C.green}│ ✅ Video READY  newVideoId=${newVideoId}  totalMs=${Date.now() - t0}${C.reset}`);
//       } catch (err) {
//         this._stats.videosFailed++;
//         console.error(`  ${C.red}│ ❌ FAILED  sourceVideoId=${sourceVideoId}  tookMs=${Date.now() - t0}${C.reset}`);
//         console.error(`  ${C.red}│ error      : ${err?.message || String(err)}${C.reset}`);
//         this.logger.error(`❌ ${label} FAILED`, err, { sourceVideoId, playableUrl: _previewUrl(playableUrl, 80) });
//       }

//       console.log(`  ${C.cyan}└─────${C.reset}`);
//     }
//   }

//   async _downloadAndUploadVideo(sourceVideoId, videoUrl) {
//     const rawId    = this.targetAccount.metaAccountId;
//     const cleanId  = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
//     const endpoint = `https://graph-video.facebook.com/${META_API_VERSION}/${cleanId}/advideos`;

//     console.log(`  ${C.gray}│ [DOWNLOAD] Downloading video…${C.reset}`);
//     console.log(`  ${C.gray}│ [DOWNLOAD] URL: ${_previewUrl(videoUrl, 100)}${C.reset}`);

//     const dlCtrl  = new AbortController();
//     const dlTimer = setTimeout(() => dlCtrl.abort(), 120_000);
//     let videoRes;
//     try {
//       videoRes = await fetch(videoUrl, {
//         headers: {
//           "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
//           "Accept":     "video/*,*/*;q=0.8",
//           "Referer":    "https://www.facebook.com/",
//         },
//         signal: dlCtrl.signal,
//       });
//     } finally { clearTimeout(dlTimer); }

//     console.log(`  ${C.gray}│ [DOWNLOAD] HTTP status    : ${videoRes.status}${C.reset}`);
//     console.log(`  ${C.gray}│ [DOWNLOAD] content-type   : ${videoRes.headers.get("content-type") || "—"}${C.reset}`);
//     console.log(`  ${C.gray}│ [DOWNLOAD] x-deny-reason  : ${videoRes.headers.get("x-deny-reason") || "—"}${C.reset}`);

//     if (!videoRes.ok) throw new Error(`Video CDN download failed: HTTP ${videoRes.status} from ${_previewUrl(videoUrl, 80)}`);

//     const contentType = videoRes.headers.get("content-type") || "video/mp4";
//     const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
//     const ext         = contentType.includes("quicktime") ? "mov" : contentType.includes("webm") ? "webm" : "mp4";
//     const videoMime   = contentType.startsWith("video/") ? contentType : "video/mp4";

//     console.log(`  ${C.gray}│ [DOWNLOAD] Size           : ${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB (${videoBuffer.length} bytes)${C.reset}`);
//     console.log(`  ${C.gray}│ [DOWNLOAD] ext            : ${ext}${C.reset}`);

//     if (videoBuffer.length === 0) throw new Error("Video CDN download returned 0 bytes");

//     const filename = `ad_video_${sourceVideoId}.${ext}`;
//     console.log(`  ${C.gray}│ [UPLOAD] filename         : ${filename}${C.reset}`);
//     console.log(`  ${C.gray}│ [UPLOAD] endpoint         : ${endpoint.replace(/act_\d+/, "act_***")}${C.reset}`);

//     const boundary = `----FormBoundary${Date.now().toString(16)}`;
//     let bodyStr    = `--${boundary}\r\n`;
//     bodyStr       += `Content-Disposition: form-data; name="source"; filename="${filename}"\r\n`;
//     bodyStr       += `Content-Type: ${videoMime}\r\n\r\n`;
//     bodyStr       += videoBuffer.toString("binary");
//     bodyStr       += `\r\n--${boundary}--`;

//     const upCtrl  = new AbortController();
//     const upTimer = setTimeout(() => upCtrl.abort(), 300_000);
//     let uploadRes, body;
//     try {
//       uploadRes = await fetch(endpoint, {
//         method:  "POST",
//         headers: {
//           Authorization:  `Bearer ${this.targetAccount.accessToken}`,
//           "Content-Type": `multipart/form-data; boundary=${boundary}`,
//         },
//         body:   Buffer.from(bodyStr, "binary"),
//         signal: upCtrl.signal,
//       });
//       body = await uploadRes.json();
//     } finally { clearTimeout(upTimer); }

//     console.log(`  ${C.gray}│ [UPLOAD] HTTP status      : ${uploadRes.status}${C.reset}`);
//     console.log(`  ${C.gray}│ [UPLOAD] newVideoId       : ${body?.id || "—"}${C.reset}`);
//     if (body?.error) {
//       console.error(`  ${C.red}│ [UPLOAD] Meta error code  : ${body.error.code || "—"}${C.reset}`);
//       console.error(`  ${C.red}│ [UPLOAD] Meta error sub   : ${body.error.error_subcode || "—"}${C.reset}`);
//       console.error(`  ${C.red}│ [UPLOAD] Meta error msg   : ${body.error.message || "—"}${C.reset}`);
//       console.error(`  ${C.red}│ [UPLOAD] Meta error trace : ${body.error.fbtrace_id || "—"}${C.reset}`);
//     }

//     if (!uploadRes.ok || body?.error) {
//       const err    = new Error(body?.error?.message || `Video upload HTTP ${uploadRes.status}`);
//       err.response = body?.error;
//       err.status   = uploadRes.status;
//       throw err;
//     }

//     if (!body?.id) throw new Error(`/advideos upload: no id in response — body: ${JSON.stringify(body).substring(0, 200)}`);
//     return body.id;
//   }

//   async _pollVideoReady(videoId, maxWaitMs = 180_000, intervalMs = 5_000) {
//     const endpoint = `https://graph.facebook.com/${META_API_VERSION}/${videoId}?fields=status,title&access_token=${this.targetAccount.accessToken}`;
//     const deadline = Date.now() + maxWaitMs;
//     let attempt    = 0;

//     while (Date.now() < deadline) {
//       attempt++;
//       await new Promise((r) => setTimeout(r, intervalMs));

//       const ctrl  = new AbortController();
//       const timer = setTimeout(() => ctrl.abort(), 15_000);
//       let res, body;
//       try {
//         res  = await fetch(endpoint, { signal: ctrl.signal });
//         body = await res.json();
//       } finally { clearTimeout(timer); }

//       const status = body?.status?.video_status;
//       const phase  = body?.status?.processing_phase?.status || "—";
//       console.log(`  ${C.gray}│ [POLL ${attempt}] status=${status || "unknown"}  processingPhase=${phase}${C.reset}`);

//       if (status === "ready") { this.logger.video(`  ✅ Video ${videoId} READY after ${attempt} poll(s)`); return; }
//       if (status === "error") throw new Error(`Meta video encoding failed for ${videoId}: ${JSON.stringify(body?.status || {})}`);
//       if (body?.error)        throw new Error(`Video poll API error: ${body.error.message}`);
//     }

//     throw new Error(`Video ${videoId} not ready after ${maxWaitMs / 1000}s and ${attempt} polls.`);
//   }

//   _logPostTransferResults(uniqueImages, uniqueVideos) {
//     console.log(`\n${C.blue}${"─".repeat(64)}${C.reset}`);
//     console.log(`${C.blue}${C.bold}  📊 ASSET TRANSFER RESULTS${C.reset}`);
//     console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);

//     let n = 0;
//     for (const [srcHash] of uniqueImages) {
//       n++;
//       const tgtHash  = this.imageHashMap[srcHash];
//       const hashDisp = srcHash.substring(0, 14) + "…";
//       const status   = tgtHash
//         ? `${C.green}✓ transferred → ${tgtHash.substring(0, 14)}…${C.reset}`
//         : `${C.red}✗ NO MAPPING — creative will be missing this image${C.reset}`;
//       console.log(`  ${C.gray}IMG ${n}${C.reset}  ${hashDisp}  ${status}`);
//     }

//     n = 0;
//     for (const [srcId] of uniqueVideos) {
//       n++;
//       const tgtId  = this.videoIdMap[srcId];
//       const status = tgtId
//         ? `${C.green}✓ transferred → ${tgtId}${C.reset}`
//         : `${C.red}✗ FAILED — creative will reference invalid video_id${C.reset}`;
//       console.log(`  ${C.gray}VID ${n}${C.reset}  id=${srcId}  ${status}`);
//     }

//     const imgFail = this._stats.imagesFailed;
//     const vidFail = this._stats.videosFailed;
//     console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);
//     console.log(`  Images : ${C.green}${this._stats.imagesTransferred} ok${C.reset}  ${imgFail > 0 ? C.red : C.gray}${imgFail} failed${C.reset}`);
//     console.log(`  Videos : ${C.green}${this._stats.videosTransferred} ok${C.reset}  ${vidFail > 0 ? C.red : C.gray}${vidFail} failed${C.reset}`);
//     console.log(`${C.blue}${"─".repeat(64)}${C.reset}\n`);
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // INSTAGRAM VALIDATOR
// // ─────────────────────────────────────────────────────────────────────────────

// class InstagramValidator {
//   constructor(logger, rateLimiter) { this.logger = logger; this.rateLimiter = rateLimiter; }

//   async validate(adAccount, instagramActorId, targetPageId) {
//     this.logger.instagram("Starting validation", { instagramActorId, targetPageId });
//     try {
//       const idString = String(instagramActorId);
//       if (!/^\d{8,20}$/.test(idString)) return { valid: false, error: "Invalid format", willContinueWithoutInstagram: true };

//       let adAccountIgIds = [];
//       try {
//         const data = await this.rateLimiter.executeWithRetry(() => adAccount.read(["instagram_accounts"]), "Fetch IG from ad account");
//         const raw  = data.instagram_accounts;
//         const arr  = Array.isArray(raw) ? raw : raw?.data && Array.isArray(raw.data) ? raw.data : raw ? [raw] : [];
//         adAccountIgIds = arr.map((a) => String(a.id || a)).filter(Boolean);
//         this.logger.instagram(`Ad account IG accounts: ${adAccountIgIds.length}`, { ids: adAccountIgIds });
//       } catch (e) { this.logger.warn("Could not fetch IG from ad account (non-fatal)", { error: e.message }); }

//       let pageIgIds = [];
//       if (targetPageId) {
//         try {
//           const page     = new Page(targetPageId);
//           const pageData = await this.rateLimiter.executeWithRetry(
//             () => page.read(["instagram_business_account", "connected_instagram_account"]),
//             "Fetch IG from page"
//           );
//           const fromBiz  = pageData.instagram_business_account?.id  || pageData.instagram_business_account;
//           const fromConn = pageData.connected_instagram_account?.id || pageData.connected_instagram_account;
//           if (fromBiz)  pageIgIds.push({ id: String(fromBiz),  source: "instagram_business_account" });
//           if (fromConn) pageIgIds.push({ id: String(fromConn), source: "connected_instagram_account" });
//           this.logger.instagram(`Page IG accounts: ${pageIgIds.length}`, { accounts: pageIgIds });
//         } catch (e) { this.logger.warn("Could not fetch IG from page (non-fatal)", { error: e.message }); }
//       }

//       const allValid = new Set([...adAccountIgIds, ...pageIgIds.map((a) => a.id)]);
//       const isValid  = allValid.has(idString);
//       this.logger.instagram(isValid ? "✅ Valid" : "❌ Not found", { provided: idString, allValidIds: [...allValid] });

//       if (isValid) {
//         const source = pageIgIds.find((a) => a.id === idString)?.source || (adAccountIgIds.includes(idString) ? "ad_account" : "unknown");
//         return { valid: true, instagramActorId: idString, source };
//       }
//       return { valid: false, error: "Not connected", willContinueWithoutInstagram: true };
//     } catch (err) {
//       this.logger.error("Instagram validation threw exception (proceeding without IG)", err);
//       return { valid: false, error: err.message, willContinueWithoutInstagram: true };
//     }
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // OBJECTIVE MAPPING
// // ─────────────────────────────────────────────────────────────────────────────

// const OBJECTIVE_MAP = {
//   LINK_CLICKS: "OUTCOME_TRAFFIC", POST_ENGAGEMENT: "OUTCOME_ENGAGEMENT", PAGE_LIKES: "OUTCOME_ENGAGEMENT",
//   EVENT_RESPONSES: "OUTCOME_ENGAGEMENT", CONVERSIONS: "OUTCOME_SALES", PRODUCT_CATALOG_SALES: "OUTCOME_SALES",
//   LEAD_GENERATION: "OUTCOME_LEADS", MESSAGES: "OUTCOME_LEADS", REACH: "OUTCOME_AWARENESS",
//   BRAND_AWARENESS: "OUTCOME_AWARENESS", VIDEO_VIEWS: "OUTCOME_AWARENESS", APP_INSTALLS: "OUTCOME_APP_PROMOTION",
//   MOBILE_APP_ENGAGEMENT: "OUTCOME_APP_PROMOTION",
//   OUTCOME_LEADS: "OUTCOME_LEADS", OUTCOME_SALES: "OUTCOME_SALES", OUTCOME_ENGAGEMENT: "OUTCOME_ENGAGEMENT",
//   OUTCOME_AWARENESS: "OUTCOME_AWARENESS", OUTCOME_TRAFFIC: "OUTCOME_TRAFFIC", OUTCOME_APP_PROMOTION: "OUTCOME_APP_PROMOTION",
// };

// function mapObjective(raw, logger) {
//   const mapped = OBJECTIVE_MAP[raw] || "OUTCOME_TRAFFIC";
//   if (mapped !== raw) logger.warn(`Objective remapped: ${raw} → ${mapped}`);
//   return mapped;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // SAFE FIELD BUILDERS
// // ─────────────────────────────────────────────────────────────────────────────

// const BID_STRATEGIES_NEEDING_AMOUNT = new Set(["LOWEST_COST_WITH_BID_CAP", "COST_CAP"]);
// const KNOWN_BID_STRATEGIES = new Set([
//   "LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "LOWEST_COST_WITH_MIN_ROAS",
// ]);

// function buildSafeBidFields(adSetData, logger) {
//   let strategy = adSetData.bid_strategy;
//   const amount = adSetData.bid_amount;
//   if (strategy && !KNOWN_BID_STRATEGIES.has(strategy)) {
//     logger.warn(`Unknown bid_strategy "${strategy}" — falling back`);
//     strategy = "LOWEST_COST_WITHOUT_CAP";
//   }
//   if (!strategy) strategy = "LOWEST_COST_WITHOUT_CAP";
//   if (BID_STRATEGIES_NEEDING_AMOUNT.has(strategy) && !amount) {
//     logger.warn(`"${strategy}" needs bid_amount — falling back`);
//     strategy = "LOWEST_COST_WITHOUT_CAP";
//   }
//   const out = { bid_strategy: strategy };
//   if (BID_STRATEGIES_NEEDING_AMOUNT.has(strategy) && amount) out.bid_amount = amount;
//   logger.debug("Resolved bid fields", out);
//   return out;
// }

// function buildSafeBudgetFields(adSetData, logger) {
//   const daily    = parseInt(adSetData.daily_budget,    10) || 0;
//   const lifetime = parseInt(adSetData.lifetime_budget, 10) || 0;
//   logger.debug("Budget resolution", { raw_daily: adSetData.daily_budget, raw_lifetime: adSetData.lifetime_budget, daily, lifetime });
//   if (daily > 0 && lifetime > 0) { logger.warn("Both daily+lifetime set — keeping daily_budget"); return { daily_budget: String(daily) }; }
//   if (daily > 0)    return { daily_budget:    String(daily) };
//   if (lifetime > 0) return { lifetime_budget: String(lifetime) };
//   return {};
// }

// function buildSafePromotedObject(promotedObject, targetPageId, isSameAccount, logger) {
//   if (!promotedObject) return null;
//   if (isSameAccount) return promotedObject;
//   logger.debug("promoted_object: sanitising for cross-account", { original: promotedObject });
//   const safe = {};
//   if (promotedObject.page_id) {
//     logger.info(`promoted_object.page_id: ${promotedObject.page_id} → ${targetPageId}`);
//     safe.page_id = targetPageId;
//   }
//   if (promotedObject.custom_event_type) safe.custom_event_type = promotedObject.custom_event_type;
//   if (promotedObject.object_store_url)  safe.object_store_url  = promotedObject.object_store_url;
//   const stripped = ["pixel_id","application_id","app_id","offer_id","product_set_id","product_catalog_id"]
//     .filter((k) => promotedObject[k]);
//   if (stripped.length) logger.warn(`promoted_object: stripped ${stripped.join(", ")} (source-account-specific)`);
//   if (Object.keys(safe).length === 0) { logger.warn("promoted_object: nothing transferable — omitting"); return null; }
//   logger.success(`promoted_object sanitised — kept: ${Object.keys(safe).join(", ")}`, { safe });
//   return safe;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // CREATIVE PROCESSOR  (v7.0 — FIX-19)
// //
// // FIX-19: _replaceAssets no longer DELETES the image_hash when it is not
// //   found in imageHashMap. Instead it keeps the original source hash and logs
// //   a warning. This means Meta receives the original hash and may still be
// //   able to serve the image if both accounts share a Business Manager image
// //   library. Previously deleting the hash left photo_data with only a caption
// //   and a stale profile picture URL, causing Meta error 2446603.
// // ─────────────────────────────────────────────────────────────────────────────

// class CreativeProcessor {
//   constructor(logger, isSameAccount, targetPageId, targetInstagramActorId, imageHashMap, videoIdMap) {
//     this.logger                 = logger;
//     this.isSameAccount          = isSameAccount;
//     this.targetPageId           = targetPageId;
//     this.targetInstagramActorId = targetInstagramActorId;
//     this.imageHashMap           = imageHashMap || {};
//     this.videoIdMap             = videoIdMap   || {};
//   }

//   processCreativeSpec(originalCreative, adName) {
//     this.logger.debug("Processing creative spec", {
//       adName,
//       isSameAccount:      this.isSameAccount,
//       hasObjectStorySpec: !!originalCreative.object_story_spec,
//       hasInstagramActor:  !!this.targetInstagramActorId,
//       imageHashMapSize:   Object.keys(this.imageHashMap).length,
//       videoIdMapSize:     Object.keys(this.videoIdMap).length,
//     });
//     const base = { name: `[DUPLICATE] ${adName} - Creative` };
//     const spec = originalCreative.object_story_spec;
//     if (!spec) {
//       this.logger.warn(`No object_story_spec for "${adName}" — using fallback`);
//       return this._fallbackCreative(originalCreative, base);
//     }
//     return this.isSameAccount
//       ? this._processSameAccount(spec, base)
//       : this._processCrossAccount(spec, base);
//   }

//   _processSameAccount(spec, base) {
//     const s = JSON.parse(JSON.stringify(spec));
//     // Remove redundant URL fields when hash is present
//     if (s.video_data?.image_hash && s.video_data?.image_url) delete s.video_data.image_url;
//     if (s.link_data?.image_hash  && s.link_data?.image_url)  delete s.link_data.image_url;
//     if (s.photo_data?.image_hash && s.photo_data?.url)       delete s.photo_data.url;
//     delete s.instagram_user_id;
//     return { ...base, object_story_spec: s };
//   }

//   _processCrossAccount(spec, base) {
//     const s       = JSON.parse(JSON.stringify(spec));
//     const oldPage = s.page_id;
//     s.page_id     = this.targetPageId;
//     this.logger.info(`page_id: ${oldPage || "(missing)"} → ${this.targetPageId}`);
//     this._handleInstagramPlacement(s);
//     this._replaceAssets(s);
//     this.logger.debug("Cross-account creative ready", {
//       page_id:            s.page_id,
//       instagram_actor_id: s.instagram_actor_id || "NOT SET",
//       hasVideoData:       !!s.video_data,
//       hasLinkData:        !!s.link_data,
//       hasPhotoData:       !!s.photo_data,
//     });
//     return { ...base, object_story_spec: s };
//   }

//   _handleInstagramPlacement(spec) {
//     const hadInstagram = !!(spec.instagram_actor_id || spec.instagram_user_id);
//     delete spec.instagram_user_id;
//     if (this.targetInstagramActorId) {
//       spec.instagram_actor_id = this.targetInstagramActorId;
//       this.logger.success(`Instagram placement ENABLED — actor: ${this.targetInstagramActorId}`);
//     } else if (hadInstagram) {
//       delete spec.instagram_actor_id;
//       this.logger.warn("Instagram placement REMOVED — no valid targetInstagramActorId");
//     }
//   }

//   // ── FIX-19: keep original hash on miss instead of deleting it ─────────────
//   _replaceAssets(spec) {
//     // photo_data
//     if (spec.photo_data?.image_hash) {
//       const src = spec.photo_data.image_hash;
//       const tgt = this.imageHashMap[src];
//       if (tgt) {
//         spec.photo_data.image_hash = tgt;
//         delete spec.photo_data.url;   // remove stale CDN url — hash takes precedence
//         this.logger.asset(`photo_data.image_hash: ${src.substring(0,12)}… → ${tgt.substring(0,12)}…`);
//       } else {
//         // FIX-19: KEEP the original hash rather than deleting it.
//         // Meta may still serve it if the accounts share a BM image library.
//         // Also clean up any stale url field so Meta uses the hash, not the url.
//         delete spec.photo_data.url;
//         this.logger.warn(
//           `photo_data.image_hash=${src.substring(0,12)}… not in imageHashMap — ` +
//           `keeping original hash (transfer failed); Meta may reject with 2446603 if not shared`
//         );
//       }
//     }

//     // link_data
//     if (spec.link_data?.image_hash) {
//       const src = spec.link_data.image_hash;
//       const tgt = this.imageHashMap[src];
//       if (tgt) {
//         spec.link_data.image_hash = tgt;
//         delete spec.link_data.image_url;
//         delete spec.link_data.picture;
//         this.logger.asset(`link_data.image_hash: ${src.substring(0,12)}… → ${tgt.substring(0,12)}…`);
//       } else {
//         delete spec.link_data.image_url;
//         delete spec.link_data.picture;
//         this.logger.warn(
//           `link_data.image_hash=${src.substring(0,12)}… not in imageHashMap — ` +
//           `keeping original hash; Meta may reject with 2446603 if not shared`
//         );
//       }
//     }

//     // video_data
//     if (spec.video_data?.video_id) {
//       const srcId = spec.video_data.video_id;
//       const tgtId = this.videoIdMap[srcId];
//       if (tgtId) {
//         spec.video_data.video_id = tgtId;
//         delete spec.video_data.video_url;
//         this.logger.asset(`video_data.video_id: ${srcId} → ${tgtId}`);
//       } else {
//         this.logger.warn(
//           `video_data.video_id=${srcId} not in videoIdMap — ` +
//           `keeping original id; Meta will likely reject this creative`
//         );
//       }
//       // video thumbnail
//       if (spec.video_data.image_hash) {
//         const src = spec.video_data.image_hash;
//         const tgt = this.imageHashMap[src];
//         if (tgt) {
//           spec.video_data.image_hash = tgt;
//           delete spec.video_data.image_url;
//           this.logger.asset(`video thumbnail: ${src.substring(0,12)}… → ${tgt.substring(0,12)}…`);
//         } else {
//           delete spec.video_data.image_url;
//           this.logger.warn(`video thumbnail hash=${src.substring(0,12)}… not in imageHashMap — keeping original`);
//         }
//       }
//     }

//     // carousel children
//     for (let i = 0; i < (spec.link_data?.child_attachments || []).length; i++) {
//       const child = spec.link_data.child_attachments[i];
//       if (child.image_hash) {
//         const src = child.image_hash;
//         const tgt = this.imageHashMap[src];
//         if (tgt) {
//           child.image_hash = tgt;
//           delete child.image_url;
//           delete child.picture;
//           this.logger.asset(`carousel[${i}]: ${src.substring(0,12)}… → ${tgt.substring(0,12)}…`);
//         } else {
//           delete child.image_url;
//           delete child.picture;
//           this.logger.warn(`carousel[${i}].image_hash=${src.substring(0,12)}… not in imageHashMap — keeping original`);
//         }
//       }
//     }
//   }

//   _fallbackCreative(original, base) {
//     return {
//       ...base,
//       title:               original.title               || "Learn More",
//       body:                original.body                || "Check this out!",
//       link_url:            original.link_url            || "https://example.com",
//       call_to_action_type: original.call_to_action_type || "LEARN_MORE",
//     };
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // DB PERSISTENCE
// // ─────────────────────────────────────────────────────────────────────────────

// async function persistCampaign(logger, { metaCampaignId, name, objective, targetAccount, userId }) {
//   try {
//     const now    = new Date();
//     const record = await prisma.metaCampaign.create({
//       data: {
//         id: metaCampaignId, userId, accountId: targetAccount.id, name, objective,
//         status: "PAUSED", effectiveStatus: "CAMPAIGN_PAUSED",
//         createdTime: now, updatedTime: now, specialAdCategories: [],
//       },
//     });
//     logger.db(`Campaign saved — id: ${record.id}`);
//     return record;
//   } catch (err) { logger.error("DB: Failed to save campaign (non-fatal)", err, { metaCampaignId }); return null; }
// }

// async function persistAdSet(logger, { metaAdSetId, name, metaCampaignId, targetAccount, dailyBudget, lifetimeBudget }) {
//   try {
//     const now  = new Date();
//     const data = {
//       id: metaAdSetId, accountId: targetAccount.id, name,
//       status: "PAUSED", effectiveStatus: "ADSET_PAUSED",
//       createdTime: now, updatedTime: now,
//     };
//     if (metaCampaignId) data.campaignId     = metaCampaignId;
//     if (dailyBudget)    data.dailyBudget    = String(dailyBudget);
//     if (lifetimeBudget) data.lifetimeBudget = String(lifetimeBudget);
//     const record = await prisma.metaAdSet.create({ data });
//     logger.db(`AdSet saved — id: ${record.id}`);
//     return record;
//   } catch (err) { logger.error("DB: Failed to save ad set (non-fatal)", err, { metaAdSetId }); return null; }
// }

// async function persistAd(logger, { metaAdId, name, metaAdSetId, metaCampaignId, creativeData, targetAccount }) {
//   try {
//     const now  = new Date();
//     const data = {
//       id: metaAdId, accountId: targetAccount.id, name,
//       status: "PAUSED", effectiveStatus: "PAUSED",
//       createdTime: now, updatedTime: now,
//       creative: creativeData || null,
//     };
//     if (metaAdSetId)    data.adSetId    = metaAdSetId;
//     if (metaCampaignId) data.campaignId = metaCampaignId;
//     const record = await prisma.metaAd.create({ data });
//     logger.db(`Ad saved — id: ${record.id}`);
//     return record;
//   } catch (err) { logger.error("DB: Failed to save ad (non-fatal)", err, { metaAdId }); return null; }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // CLEANUP HELPER
// // ─────────────────────────────────────────────────────────────────────────────

// async function bestEffortCleanup(logger, { campaignId, adSetIds }, accessToken) {
//   if (!campaignId) return;
//   logger.warn("Attempting cleanup of orphaned Meta objects…", { campaignId, adSetIds });
//   const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
//   for (const id of (adSetIds || [])) {
//     try {
//       await fetch(`https://graph.facebook.com/${META_API_VERSION}/${id}`, { method: "DELETE", headers });
//       logger.info(`Cleanup: deleted adset ${id}`);
//     } catch (e) { logger.warn(`Cleanup: failed to delete adset ${id}`, { error: e.message }); }
//   }
//   try {
//     await fetch(`https://graph.facebook.com/${META_API_VERSION}/${campaignId}`, { method: "DELETE", headers });
//     logger.info(`Cleanup: deleted campaign ${campaignId}`);
//   } catch (err) { logger.error("Cleanup: failed to delete campaign", err); }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // META ERROR CLASSIFIER  (v7.0 — FIX-20: added subcode 2446603)
// // ─────────────────────────────────────────────────────────────────────────────

// const META_KNOWN_ERRORS = {
//   // Subcode-keyed
//   1359188: { name: "NO_PAYMENT_METHOD", httpStatus: 402, userMessage: "The target ad account has no valid payment method." },
//   1487934: { name: "INVALID_IG_ACTOR",  httpStatus: 400, userMessage: "The Instagram actor ID is not valid for this ad account." },
//   2490361: { name: "INVALID_IMAGE",     httpStatus: 400, userMessage: "Meta could not process the image. The CDN URL could not be downloaded or validated." },
//   // FIX-20: 2446603 = "Invalid image in ad" — image hash not found or not accessible in target account
//   2446603: { name: "INVALID_IMAGE_HASH", httpStatus: 400, userMessage: "The image could not be loaded in the target ad account. The image hash was not transferred successfully — check asset transfer logs." },
//   // Code-keyed
//   33: { name: "ACCOUNT_NOT_FOUND", httpStatus: 404, userMessage: "The ad account ID does not exist or you do not have permission." },
// };

// function classifyMetaError(err) {
//   const subcode = err?.response?.error_subcode ?? err?.response?.error?.error_subcode ?? err?.body?.error?.error_subcode ?? err?.error_subcode;
//   const code    = err?.response?.code ?? err?.response?.error?.code ?? err?.body?.error?.code ?? err?.code;
//   return META_KNOWN_ERRORS[subcode] || META_KNOWN_ERRORS[code] || null;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // REQUEST VALIDATION
// // ─────────────────────────────────────────────────────────────────────────────

// function validateBody(body, isSameAccount, logger) {
//   const errors = [];
//   if (!body.sourceAccountId) errors.push("sourceAccountId required");
//   if (!body.targetAccountId) errors.push("targetAccountId required");
//   if (!body.campaignId)      errors.push("campaignId required");
//   if (!isSameAccount && !body.targetPageId) errors.push("targetPageId required for cross-account");
//   if (errors.length > 0) { logger.error("Validation failed", null, { errors }); return { valid: false, errors }; }
//   return { valid: true };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // MAIN HANDLER
// // ─────────────────────────────────────────────────────────────────────────────

// export async function POST(request) {
//   const requestId = `dup_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
//   const logger    = new Logger(requestId);
//   const rl        = new RateLimitHandler(logger);

//   const createdMetaIds = { campaignId: null, adSetIds: [], targetAccessToken: null };

//   logger.start(`Campaign Duplication v7.0 — requestId: ${requestId}`);

//   try {

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("AUTHENTICATION");
//     const session = await getServerSession(authOptions);
//     if (!session?.user?.id) {
//       logger.outcomes.auth = false;
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }
//     logger.outcomes.auth = true;
//     logger.success(`Authenticated — userId: ${session.user.id}`);

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("PARSE + VALIDATE REQUEST");
//     let body;
//     try { body = await request.json(); }
//     catch (e) { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

//     const isSameAccount = body.sourceAccountId === body.targetAccountId;

//     logger.info("Request body parsed", {
//       sourceAccountId:         body.sourceAccountId,
//       targetAccountId:         body.targetAccountId,
//       campaignId:              body.campaignId,
//       isSameAccount,
//       hasTargetPageId:         !!body.targetPageId,
//       hasTargetInstagramActor: !!body.targetInstagramActorId,
//       note: "v7.0: image hashes resolved via /adimages?hashes=[...] (FIX-17)",
//     });

//     const validation = validateBody(body, isSameAccount, logger);
//     if (!validation.valid) return NextResponse.json({ error: "Validation failed", details: validation.errors }, { status: 400 });
//     logger.success(`Mode: ${isSameAccount ? "SAME-ACCOUNT" : "CROSS-ACCOUNT"} duplication`);

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("LOAD AD ACCOUNTS FROM DB");
//     const t0 = Date.now();
//     const [sourceAccount, targetAccount] = await Promise.all([
//       prisma.metaAdAccount.findUnique({
//         where:  { id: body.sourceAccountId },
//         select: { id: true, metaAccountId: true, accessToken: true, name: true, userId: true },
//       }),
//       prisma.metaAdAccount.findUnique({
//         where:  { id: body.targetAccountId },
//         select: { id: true, metaAccountId: true, accessToken: true, name: true, userId: true },
//       }),
//     ]);
//     logger.perf("DB accounts loaded", t0);

//     if (!sourceAccount || sourceAccount.userId !== session.user.id) {
//       logger.outcomes.dbAccounts = false;
//       return NextResponse.json({ error: "Source ad account not found or not accessible" }, { status: 404 });
//     }
//     if (!targetAccount || targetAccount.userId !== session.user.id) {
//       logger.outcomes.dbAccounts = false;
//       return NextResponse.json({ error: "Target ad account not found or not accessible" }, { status: 404 });
//     }
//     logger.outcomes.dbAccounts       = true;
//     createdMetaIds.targetAccessToken = targetAccount.accessToken;
//     logger.success(`Accounts: "${sourceAccount.name}" → "${targetAccount.name}"`, {
//       sourceMetaId: sourceAccount.metaAccountId,
//       targetMetaId: targetAccount.metaAccountId,
//     });

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("FETCH SOURCE CAMPAIGN");
//     // ⚠️  ALL source-account API calls BEFORE FacebookAdsApi.init(targetAccount)
//     FacebookAdsApi.init(sourceAccount.accessToken);
//     const srcCampaign = new Campaign(body.campaignId);
//     let campaignData;
//     try {
//       campaignData = await rl.executeWithRetry(
//         () => srcCampaign.get([
//           "name","objective","status","special_ad_categories",
//           "buying_type","daily_budget","lifetime_budget",
//           "start_time","stop_time","bid_strategy",
//         ]),
//         "Fetch source campaign"
//       );
//     } catch (err) {
//       logger.outcomes.campaignFetch = false;
//       logger.error("Failed to fetch source campaign", err);
//       return NextResponse.json({ error: "Source campaign not found or inaccessible" }, { status: 404 });
//     }
//     const cf = campaignData.exportAllData();
//     logger.outcomes.campaignFetch = true;
//     logger.success("Source campaign loaded", { name: cf.name, objective: cf.objective, status: cf.status, buying_type: cf.buying_type });

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("FETCH AD SETS");
//     const adSets = await rl.executeWithRetry(
//       () => srcCampaign.getAdSets([
//         "name","status","daily_budget","lifetime_budget","bid_strategy","bid_amount",
//         "billing_event","optimization_goal","targeting","start_time","end_time",
//         "promoted_object","attribution_spec",
//       ]),
//       "Fetch ad sets"
//     );
//     if (adSets.length === 0) {
//       logger.outcomes.adSetsFetch = false;
//       return NextResponse.json({ error: "Campaign has no ad sets" }, { status: 400 });
//     }
//     logger.outcomes.adSetsFetch = true;
//     logger.success(`${adSets.length} ad set(s) found`);
//     adSets.forEach((as, i) => {
//       const d = as.exportAllData();
//       logger.info(`  Ad set [${i+1}]: "${d.name}"`, {
//         billing_event: d.billing_event, optimization_goal: d.optimization_goal, daily_budget: d.daily_budget,
//       });
//     });

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("FETCH ADS + CREATIVES  (source account token — DO NOT switch token yet)");
//     const adsWithCreatives  = [];
//     let failedCreativeLoads = 0;

//     for (const adSet of adSets) {
//       const ads = await rl.executeWithRetry(
//         () => adSet.getAds(["name","status","creative{id}"]),
//         `Fetch ads for adSet ${adSet.id}`
//       );
//       logger.info(`  AdSet ${adSet.id} → ${ads.length} ad(s)`);

//       for (const ad of ads) {
//         const adData     = ad.exportAllData();
//         const creativeId = adData.creative?.id;
//         if (!creativeId) { logger.warn(`  Ad "${adData.name}" has no creative — skipping`); continue; }

//         try {
//           const creative = await rl.executeWithRetry(
//             () => new AdCreative(creativeId).get([
//               "name","title","body","link_url","call_to_action_type",
//               "object_story_spec",
//               "image_hash",
//               "image_url",
//               "asset_feed_spec",
//               "degrees_of_freedom_spec",
//               "video_id",
//             ]),
//             `Fetch creative ${creativeId}`
//           );
//           const cData = creative.exportAllData();
//           adsWithCreatives.push({
//             adName: adData.name, adStatus: adData.status,
//             creative: cData, creativeId, originalAdSetId: adSet.id,
//           });
//           logger.debug(`  ✓ Creative loaded for "${adData.name}"`, {
//             creativeId,
//             hasObjectStorySpec: !!cData.object_story_spec,
//             mediaTypes: [
//               cData.object_story_spec?.video_data ? "video" : null,
//               cData.object_story_spec?.link_data  ? "link"  : null,
//               cData.object_story_spec?.photo_data ? "photo" : null,
//             ].filter(Boolean),
//             topLevelImageHash: cData.image_hash ? cData.image_hash.substring(0, 12) + "…" : null,
//             topLevelVideoId:   cData.video_id || null,
//           });
//         } catch (err) {
//           failedCreativeLoads++;
//           logger.error(`  Failed to load creative ${creativeId} for "${adData.name}"`, err);
//           adsWithCreatives.push({
//             adName: adData.name, adStatus: adData.status,
//             creative: { title: "Fallback", body: "Fallback", link_url: "https://example.com" },
//             creativeId: null, originalAdSetId: adSet.id,
//           });
//         }
//       }
//     }

//     if (adsWithCreatives.length === 0) {
//       logger.outcomes.creativesFetch = false;
//       return NextResponse.json({ error: "No ads found" }, { status: 400 });
//     }
//     logger.outcomes.creativesFetch = failedCreativeLoads === 0;
//     logger.success(`Total ads prepared: ${adsWithCreatives.length}`, { failedCreativeLoads });

//     // ────────────────────────────────────────────────────────────────────────
//     // v7.0: INLINE ASSET URL RESOLUTION
//     // Still on SOURCE account token — must happen before init(target)
//     // FIX-17 + FIX-18: uses /adimages?hashes=[...] + passes sourceMetaAccountId
//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("INLINE ASSET URL RESOLUTION  (source account — before token switch)");

//     let resolvedHashToUrl    = {};
//     let resolvedVideoIdToUrl = {};
//     let resolutionStats      = {};

//     if (!isSameAccount) {
//       // FIX-18: pass sourceAccount.metaAccountId as 4th argument
//       const resolver = new InlineAssetResolver(
//         logger,
//         rl,
//         sourceAccount.accessToken,
//         sourceAccount.metaAccountId   // ← NEW in v7.0
//       );
//       const result = await resolver.resolveAll(adsWithCreatives);

//       resolvedHashToUrl    = result.hashToUrl;
//       resolvedVideoIdToUrl = result.videoIdToUrl;
//       resolutionStats      = result.stats;
//       logger.outcomes.assetResolution = result.allOk;

//       logger.info("Inline resolution summary", {
//         resolvedImages: Object.keys(resolvedHashToUrl).length,
//         resolvedVideos: Object.keys(resolvedVideoIdToUrl).length,
//         stats: resolutionStats,
//       });

//       if (!result.allOk) {
//         logger.warn(
//           "⚠️  Some assets could not be resolved. Duplication will continue but affected " +
//           "creatives may fail at Meta.\n" +
//           "   Possible causes:\n" +
//           "     • The source access token lacks ads_read permission on the image library\n" +
//           "     • The image was uploaded to a different ad account not shared with this token\n" +
//           "     • The video is not in READY status\n" +
//           "     • The CDN URL returned is geo-blocked from this server"
//         );
//       }
//     } else {
//       logger.outcomes.assetResolution = "skipped";
//       logger.info("Same-account — inline asset resolution skipped");
//     }

//     // ────────────────────────────────────────────────────────────────────────
//     // NOW safe to switch to target account token
//     // ────────────────────────────────────────────────────────────────────────
//     logger.info("🔑 Switching FacebookAdsApi token → target account");
//     FacebookAdsApi.init(targetAccount.accessToken);
//     const targetAdAccount = new AdAccount(targetAccount.metaAccountId);

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("AUTO ASSET TRANSFER (cross-account only)");

//     let imageHashMap = {};
//     let videoIdMap   = {};
//     let assetStats   = {};

//     if (!isSameAccount) {
//       const assetManager = new AssetTransferManager(logger, rl, sourceAccount, targetAccount);
//       assetManager.loadResolvedMaps(resolvedHashToUrl, resolvedVideoIdToUrl);

//       const result  = await assetManager.transferAllAssets(adsWithCreatives);
//       imageHashMap  = result.imageHashMap;
//       videoIdMap    = result.videoIdMap;
//       assetStats    = result.stats;
//       logger.outcomes.assetTransfer = result.allOk;

//       logger.info("Final asset maps", {
//         imageHashMap: Object.entries(imageHashMap).map(([k, v]) => `${k.substring(0,10)}…→${v.substring(0,10)}…`),
//         videoIdMap:   Object.entries(videoIdMap).map(([k, v]) => `${k}→${v}`),
//       });
//     } else {
//       logger.outcomes.assetTransfer = "skipped";
//       logger.info("Same-account — no asset transfer needed");
//     }

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("INSTAGRAM ACTOR VALIDATION");
//     let validatedInstagramActorId = null;
//     const instagramWarnings       = [];

//     if (body.targetInstagramActorId && !isSameAccount) {
//       const igValidator = new InstagramValidator(logger, rl);
//       const result      = await igValidator.validate(targetAdAccount, body.targetInstagramActorId, body.targetPageId);
//       if (result.valid) {
//         validatedInstagramActorId    = result.instagramActorId;
//         logger.outcomes.igValidation = true;
//         logger.success(`Instagram actor validated — source: ${result.source}`);
//       } else {
//         logger.outcomes.igValidation = false;
//         logger.warn("Instagram validation FAILED — proceeding Facebook-only", { reason: result.message });
//         instagramWarnings.push({ type: "instagram_validation_failed", message: result.message, impact: "Facebook-only" });
//       }
//     } else if (isSameAccount && body.targetInstagramActorId) {
//       validatedInstagramActorId    = body.targetInstagramActorId;
//       logger.outcomes.igValidation = "skipped";
//     } else {
//       logger.outcomes.igValidation = "skipped";
//       logger.instagram("No IG actor provided — Facebook-only");
//     }

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("CREATE NEW CAMPAIGN");
//     const mappedObjective = mapObjective(cf.objective, logger);
//     const campaignName    = `[DUPLICATE ${new Date().toISOString().slice(0, 10)}] ${cf.name}`;
//     const rawSac          = cf.special_ad_categories || [];
//     const sanitizedSac    = rawSac
//       .map((i) => (typeof i === "object" && i !== null ? i.category : i))
//       .filter((s) => typeof s === "string" && s !== "NONE" && s !== "");

//     const campaignParams = {
//       name:                            campaignName,
//       objective:                       mappedObjective,
//       status:                          "PAUSED",
//       special_ad_categories:           sanitizedSac,
//       buying_type:                     cf.buying_type || "AUCTION",
//       is_adset_budget_sharing_enabled: false,
//     };
//     const cboDailyVal    = parseInt(cf.daily_budget,    10) || 0;
//     const cboLifetimeVal = parseInt(cf.lifetime_budget, 10) || 0;
//     if      (cboDailyVal > 0 && cboLifetimeVal > 0) { campaignParams.daily_budget = String(cboDailyVal); logger.warn("Both CBO budgets set — keeping daily_budget"); }
//     else if (cboDailyVal > 0)    { campaignParams.daily_budget    = String(cboDailyVal);    logger.info(`CBO daily budget: ${cboDailyVal}`); }
//     else if (cboLifetimeVal > 0) { campaignParams.lifetime_budget = String(cboLifetimeVal); logger.info(`CBO lifetime budget: ${cboLifetimeVal}`); }
//     else                         { logger.info("ABO mode — no campaign-level budget"); }

//     logger.meta("Creating campaign", campaignParams);
//     let newCampaign;
//     try {
//       newCampaign = await rl.executeWithRetry(
//         () => targetAdAccount.createCampaign([], campaignParams),
//         "Create campaign"
//       );
//     } catch (err) {
//       logger.outcomes.campaignCreate = false;
//       const known = classifyMetaError(err);
//       logger.metaError("createCampaign", campaignParams, err);
//       if (known) return NextResponse.json({ error: known.name, message: known.userMessage, requestId }, { status: known.httpStatus });
//       throw err;
//     }
//     createdMetaIds.campaignId      = newCampaign.id;
//     logger.outcomes.campaignCreate = true;
//     logger.success(`Campaign created — Meta ID: ${newCampaign.id}`, { name: campaignName });

//     const campaignRecord       = await persistCampaign(logger, { metaCampaignId: newCampaign.id, name: campaignName, objective: mappedObjective, targetAccount, userId: session.user.id });
//     logger.outcomes.campaignDB = !!campaignRecord;

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("CREATE AD SETS");
//     const adSetIdMap  = {};
//     const newAdSetIds = [];

//     for (let i = 0; i < adSets.length; i++) {
//       const adSet = adSets[i];
//       const asd   = adSet.exportAllData();
//       const label = `AdSet ${i+1}/${adSets.length}: "${asd.name}"`;
//       logger.divider(label);

//       const safeBudget         = buildSafeBudgetFields(asd, logger);
//       const safeBid            = buildSafeBidFields(asd, logger);
//       const safePromotedObject = buildSafePromotedObject(asd.promoted_object, body.targetPageId, isSameAccount, logger);

//       const adSetParams = {
//         name:              `[DUPLICATE] ${asd.name}`,
//         campaign_id:       newCampaign.id,
//         status:            "PAUSED",
//         billing_event:     asd.billing_event,
//         optimization_goal: asd.optimization_goal,
//         targeting:         asd.targeting,
//         ...safeBudget,
//         ...safeBid,
//         ...(safePromotedObject && { promoted_object: safePromotedObject }),
//         ...(asd.attribution_spec && mappedObjective === cf.objective && { attribution_spec: asd.attribution_spec }),
//       };

//       logger.meta(`Creating ${label}`, adSetParams);
//       const adSetOutcome = { name: asd.name, metaOk: false, dbOk: false, metaId: null, error: null };
//       logger.outcomes.adSetsCreate.push(adSetOutcome);

//       try {
//         const newAdSet = await rl.executeWithRetry(
//           () => targetAdAccount.createAdSet([], adSetParams),
//           `Create ad set ${i+1}`
//         );
//         createdMetaIds.adSetIds.push(newAdSet.id);
//         adSetIdMap[adSet.id] = newAdSet.id;
//         newAdSetIds.push(newAdSet.id);
//         adSetOutcome.metaOk = true;
//         adSetOutcome.metaId = newAdSet.id;
//         logger.success(`${label} created — Meta ID: ${newAdSet.id}`);

//         const asRecord = await persistAdSet(logger, {
//           metaAdSetId:    newAdSet.id,
//           name:           `[DUPLICATE] ${asd.name}`,
//           metaCampaignId: newCampaign.id,
//           targetAccount,
//           dailyBudget:    safeBudget.daily_budget    || null,
//           lifetimeBudget: safeBudget.lifetime_budget || null,
//         });
//         adSetOutcome.dbOk = !!asRecord;
//       } catch (err) {
//         adSetOutcome.error = err.message;
//         const known = classifyMetaError(err);
//         logger.metaError(`createAdSet — ${label}`, adSetParams, err);
//         await bestEffortCleanup(logger, createdMetaIds, targetAccount.accessToken);
//         if (known) return NextResponse.json({ error: known.name, message: known.userMessage, requestId }, { status: known.httpStatus });
//         throw new Error(`Ad set creation failed for "${asd.name}": ${err.message}`);
//       }
//     }

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("CREATE CREATIVES + ADS");
//     logger.info(`Placement strategy: ${validatedInstagramActorId ? "Facebook + Instagram" : "Facebook ONLY"}`, {
//       instagramActorId: validatedInstagramActorId || "N/A",
//     });

//     const creativeProcessor = new CreativeProcessor(
//       logger, isSameAccount, body.targetPageId, validatedInstagramActorId, imageHashMap, videoIdMap
//     );
//     let adsCreated  = 0;
//     let adsFailed   = 0;
//     const failedAds = [];

//     for (let i = 0; i < adsWithCreatives.length; i++) {
//       const item  = adsWithCreatives[i];
//       const label = `Ad ${i+1}/${adsWithCreatives.length}: "${item.adName}"`;
//       logger.divider(label);

//       const targetAdSetId = adSetIdMap[item.originalAdSetId];
//       if (!targetAdSetId) {
//         logger.warn(`${label} — parent ad set failed, skipping`);
//         adsFailed++;
//         failedAds.push({ name: item.adName, error: "Parent ad set failed" });
//         continue;
//       }

//       const adOutcome = { name: item.adName, metaOk: false, dbOk: false, metaId: null, placement: null, error: null };
//       logger.outcomes.adsCreate.push(adOutcome);

//       try {
//         logger.debug(`${label} — source creative`, {
//           creativeId:          item.creativeId,
//           hasObjectStorySpec:  !!item.creative?.object_story_spec,
//           objectStorySpecKeys: item.creative?.object_story_spec ? Object.keys(item.creative.object_story_spec) : [],
//           hasVideoData:        !!item.creative?.object_story_spec?.video_data,
//           hasLinkData:         !!item.creative?.object_story_spec?.link_data,
//           hasPhotoData:        !!item.creative?.object_story_spec?.photo_data,
//         });

//         let creativeSpec;
//         try {
//           creativeSpec = creativeProcessor.processCreativeSpec(item.creative, item.adName);
//           logger.debug(`${label} — creative spec ready`, {
//             hasObjectStorySpec: !!creativeSpec.object_story_spec,
//             hasInstagramActor:  !!creativeSpec.object_story_spec?.instagram_actor_id,
//           });
//           logger.meta(`${label} — creativeSpec being sent to Meta`, creativeSpec);
//         } catch (specErr) { throw specErr; }

//         let newCreative;
//         let finalPlacement = creativeSpec.object_story_spec?.instagram_actor_id ? "fb+ig" : "fb";

//         try {
//           logger.meta(`${label} — creating creative`);
//           newCreative = await rl.executeWithRetry(
//             () => targetAdAccount.createAdCreative([], creativeSpec),
//             `Create creative for "${item.adName}"`
//           );
//           logger.success(`${label} — creative created: ${newCreative.id}`);
//         } catch (creativeErr) {
//           const knownCreativeErr = classifyMetaError(creativeErr);
//           const isIgError        = creativeErr?.message?.includes("instagram_actor_id") ||
//                                    (creativeErr?.response?.error_subcode === 1487934);

//           if (isIgError && creativeSpec.object_story_spec?.instagram_actor_id) {
//             logger.warn(`${label} — Meta rejected instagram_actor_id — retrying without IG`, {
//               originalError: creativeErr.message,
//             });
//             delete creativeSpec.object_story_spec.instagram_actor_id;
//             delete creativeSpec.object_story_spec.instagram_user_id;
//             finalPlacement = "fb";
//             instagramWarnings.push({
//               type:    "instagram_creative_rejected",
//               message: `"${item.adName}": IG removed after rejection`,
//               impact:  "Facebook-only",
//             });
//             newCreative = await rl.executeWithRetry(
//               () => targetAdAccount.createAdCreative([], creativeSpec),
//               `Create creative "${item.adName}" (FB-only retry)`
//             );
//             logger.success(`${label} — creative created (FB-only): ${newCreative.id}`);
//           } else {
//             logger.metaError(`createAdCreative — ${label}`, creativeSpec, creativeErr);
//             if (knownCreativeErr) {
//               return NextResponse.json({
//                 error:   knownCreativeErr.name,
//                 message: knownCreativeErr.userMessage,
//                 requestId,
//                 createdMetaObjects: {
//                   note:       "May need manual deletion",
//                   campaignId: createdMetaIds.campaignId,
//                   adSetIds:   createdMetaIds.adSetIds,
//                 },
//               }, { status: knownCreativeErr.httpStatus });
//             }
//             throw creativeErr;
//           }
//         }

//         const adParams = {
//           name:      `[DUPLICATE] ${item.adName}`,
//           adset_id:  targetAdSetId,
//           status:    "PAUSED",
//           creative:  { creative_id: newCreative.id },
//         };
//         logger.meta(`${label} — creating ad`, adParams);

//         let newAd;
//         try {
//           newAd = await rl.executeWithRetry(
//             () => targetAdAccount.createAd([], adParams),
//             `Create ad "${item.adName}"`
//           );
//         } catch (adErr) {
//           const known = classifyMetaError(adErr);
//           logger.metaError(`createAd — ${label}`, adParams, adErr);
//           if (known) return NextResponse.json({
//             error:   known.name,
//             message: known.userMessage,
//             requestId,
//             createdMetaObjects: {
//               note:       "May need manual deletion",
//               campaignId: createdMetaIds.campaignId,
//               adSetIds:   createdMetaIds.adSetIds,
//             },
//           }, { status: known.httpStatus });
//           throw adErr;
//         }

//         adsCreated++;
//         adOutcome.metaOk    = true;
//         adOutcome.metaId    = newAd.id;
//         adOutcome.placement = finalPlacement;
//         logger.success(`✅ ${label} DONE`, { adId: newAd.id, adSetId: targetAdSetId, placement: finalPlacement });

//         const adRecord = await persistAd(logger, {
//           metaAdId:       newAd.id,
//           name:           `[DUPLICATE] ${item.adName}`,
//           metaAdSetId:    targetAdSetId,
//           metaCampaignId: newCampaign.id,
//           creativeData:   { creative_id: newCreative.id, spec: creativeSpec },
//           targetAccount,
//         });
//         adOutcome.dbOk = !!adRecord;

//       } catch (err) {
//         adsFailed++;
//         adOutcome.error = err.message;
//         failedAds.push({ name: item.adName, error: err.message });
//         logger.error(`❌ ${label} FAILED`, err, { adSetId: targetAdSetId });
//       }
//     }

//     // ────────────────────────────────────────────────────────────────────────
//     logger.step("FINAL SUMMARY");
//     const totalMs = Date.now() - logger.startTime;
//     logger.printFinalSummary(totalMs);

//     return NextResponse.json({
//       success: true,
//       requestId,
//       message: isSameAccount
//         ? "Campaign duplicated within same account"
//         : "Campaign duplicated to new account with inline asset resolution + transfer",
//       data: {
//         duplicatedCampaignId: newCampaign.id,
//         campaignName,
//         adSetsCreated:  newAdSetIds.length,
//         adsCreated,
//         adsFailed,
//         totalAds:       adsWithCreatives.length,
//         processingTime: `${(totalMs / 1000).toFixed(2)}s`,
//         placement: {
//           type:             validatedInstagramActorId ? "facebook_and_instagram" : "facebook_only",
//           instagramActorId: validatedInstagramActorId || null,
//         },
//         ...(isSameAccount ? {} : {
//           assetResolution: {
//             imagesResolved: resolutionStats.imagesResolved || 0,
//             imagesFailed:   resolutionStats.imagesFailed   || 0,
//             videosResolved: resolutionStats.videosResolved || 0,
//             videosFailed:   resolutionStats.videosFailed   || 0,
//           },
//           assetTransfer: {
//             imagesTransferred: assetStats.imagesTransferred || 0,
//             imagesFailed:      assetStats.imagesFailed      || 0,
//             videosTransferred: assetStats.videosTransferred || 0,
//             videosFailed:      assetStats.videosFailed      || 0,
//             imageHashMapSize:  Object.keys(imageHashMap).length,
//             videoIdMapSize:    Object.keys(videoIdMap).length,
//           },
//         }),
//       },
//       ...(mappedObjective !== cf.objective && {
//         objectiveMapping: { original: cf.objective, mapped: mappedObjective },
//       }),
//       ...((instagramWarnings.length > 0 || failedAds.length > 0) && {
//         warnings: {
//           ...(instagramWarnings.length > 0 && { instagram: instagramWarnings }),
//           ...(failedAds.length > 0         && { failedAds }),
//         },
//       }),
//     }, { status: 200 });

//   } catch (err) {
//     const totalMs = Date.now() - logger.startTime;
//     logger.printFinalSummary(totalMs);
//     logger.error("CRITICAL FAILURE — duplication aborted", err, {
//       requestId,
//       totalTime:          `${(totalMs / 1000).toFixed(2)}s`,
//       createdMetaObjects: { campaignId: createdMetaIds.campaignId, adSetIds: createdMetaIds.adSetIds },
//     });
//     return NextResponse.json({
//       error:   "Campaign duplication failed",
//       message: err.message,
//       requestId,
//       createdMetaObjects: {
//         note:       "May need manual deletion",
//         campaignId: createdMetaIds.campaignId,
//         adSetIds:   createdMetaIds.adSetIds,
//       },
//     }, { status: 500 });
//   }
// }

// app/api/campaign/duplicate/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Campaign Duplication Route — v7.0
//
// KEY FIXES vs v6.0:
//
//   FIX-17  (CORRECT IMAGE HASH RESOLUTION):
//     v6.0 tried GET /{hash}?fields=url which always returns 400 because an
//     image hash is NOT a Graph API node ID. Fixed to use the correct endpoint:
//       GET /act_{sourceMetaAccountId}/adimages?hashes=[hash1,hash2,...]&fields=hash,url
//     Hashes are batched in chunks of 50 to stay within URL length limits.
//     The fallback _resolveImageViaAdimagesEdge was also broken (wrong URL
//     shape) — replaced with a proper single-hash /adimages?hashes=[hash] call.
//
//   FIX-18  (sourceMetaAccountId PASSED INTO InlineAssetResolver):
//     InlineAssetResolver constructor now accepts sourceMetaAccountId so it
//     can build the correct /adimages endpoint. Main handler passes
//     sourceAccount.metaAccountId when constructing the resolver.
//
//   FIX-19  (DON'T DELETE image_hash ON MISS IN CreativeProcessor):
//     Previously _replaceAssets() deleted spec.photo_data.image_hash /
//     spec.link_data.image_hash when the hash wasn't in imageHashMap, leaving
//     Meta with a broken photo_data that had only a caption and a stale URL.
//     Now the original hash is kept on miss so Meta can still attempt to use
//     the source hash (which may work if both accounts share the same Business
//     Manager image library), and a warning is logged instead.
//
//   FIX-20  (ADD Meta subcode 2446603 TO KNOWN ERRORS):
//     Subcode 2446603 ("Invalid image in ad") added to META_KNOWN_ERRORS so
//     it is recognised and surfaces a clear user-facing message instead of a
//     raw 500 throw.
//
//   FIX-21  (withAuth INTEGRATION — admin / owner / team-member access):
//     Replaced manual getServerSession + userId ownership check with withAuth
//     middleware. ctx.adAccountAccess.canAccess() now correctly allows:
//       admin   → any account in the system
//       owner   → accounts they created
//       member  → accounts shared via team membership
//     Removed getServerSession / authOptions imports (handled by withAuth).
//
// ─────────────────────────────────────────────────────────────────────────────

import {
  FacebookAdsApi,
  AdAccount,
  Campaign,
  AdCreative,
  Page,
} from "facebook-nodejs-business-sdk";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";

// ─────────────────────────────────────────────────────────────────────────────
// CONSOLE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  reset:    "\x1b[0m",
  bold:     "\x1b[1m",
  dim:      "\x1b[2m",
  green:    "\x1b[32m",
  yellow:   "\x1b[33m",
  red:      "\x1b[31m",
  cyan:     "\x1b[36m",
  blue:     "\x1b[34m",
  magenta:  "\x1b[35m",
  gray:     "\x1b[90m",
  white:    "\x1b[37m",
  bgGreen:  "\x1b[42m",
  bgRed:    "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgBlue:   "\x1b[44m",
};

function box(lines, color = C.cyan) {
  const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
  const maxLen = Math.max(...lines.map((l) => stripAnsi(l).length));
  const hr     = "─".repeat(maxLen + 4);
  console.error(`${color}┌${hr}┐${C.reset}`);
  for (const line of lines) {
    const pad = " ".repeat(maxLen - stripAnsi(line).length);
    console.error(`${color}│${C.reset}  ${line}${pad}  ${color}│${C.reset}`);
  }
  console.error(`${color}└${hr}┘${C.reset}`);
}

function checkRow(label, ok, detail = "") {
  const icon  = ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  const color = ok ? C.green : C.red;
  const d     = detail ? `  ${C.gray}${detail}${C.reset}` : "";
  console.log(`   ${icon} ${color}${label}${C.reset}${d}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────

class Logger {
  constructor(requestId) {
    this.requestId    = requestId;
    this.startTime    = Date.now();
    this._stepCounter = 0;

    this.outcomes = {
      auth:            null,
      dbAccounts:      null,
      campaignFetch:   null,
      adSetsFetch:     null,
      creativesFetch:  null,
      assetResolution: null,
      assetTransfer:   null,
      igValidation:    null,
      campaignCreate:  null,
      campaignDB:      null,
      adSetsCreate:    [],
      adsCreate:       [],
    };
  }

  _elapsed() { return `${((Date.now() - this.startTime) / 1000).toFixed(2)}s`; }

  _extractFbError(err) {
    if (!err) return null;
    const direct = err?.response;
    if (direct && (direct.fbtrace_id || direct.error_subcode != null || direct.code != null)) return direct;
    return err?.response?.error || err?.response?.body?.error || err?.body?.error || err?._error || err?.error || null;
  }

  _formatError(err) {
    if (!err) return null;
    const fbErr = this._extractFbError(err);
    const out   = { message: fbErr?.error_user_msg || fbErr?.message || err?.message || String(err) };
    if (fbErr?.code)             out.meta_error_code    = fbErr.code;
    if (fbErr?.error_subcode)    out.meta_error_subcode = fbErr.error_subcode;
    if (fbErr?.type)             out.meta_error_type    = fbErr.type;
    if (fbErr?.error_user_title) out.meta_user_title    = fbErr.error_user_title;
    if (fbErr?.error_user_msg)   out.meta_user_message  = fbErr.error_user_msg;
    if (fbErr?.fbtrace_id)       out.meta_trace_id      = fbErr.fbtrace_id;
    if (fbErr?.error_data)       out.meta_error_data    = fbErr.error_data;
    if (err?.status)             out.http_status        = err.status;
    if (fbErr)                   out._raw_meta_error    = fbErr;
    out.stack = err?.stack?.split("\n").slice(0, 4).join(" | ");
    return out;
  }

  _printMetaErrorBlock(fbErr) {
    if (!fbErr) return;
    box([
      `${C.bold}${C.red}OFFICIAL META API ERROR${C.reset}`,
      `${C.gray}Code     :${C.reset} ${fbErr.code || "—"}   ${C.gray}Subcode:${C.reset} ${fbErr.error_subcode || "—"}`,
      `${C.gray}Type     :${C.reset} ${fbErr.type || "—"}`,
      ...(fbErr.error_user_title ? [`${C.gray}Title    :${C.reset} ${fbErr.error_user_title}`] : []),
      ...(fbErr.error_user_msg   ? [`${C.gray}Message  :${C.reset} ${fbErr.error_user_msg}`]   : []),
      ...(fbErr.message          ? [`${C.gray}Dev msg  :${C.reset} ${fbErr.message}`]           : []),
      ...(fbErr.fbtrace_id       ? [`${C.gray}Trace ID :${C.reset} ${fbErr.fbtrace_id}`]        : []),
    ], C.red);
    if (fbErr.error_data) console.error(`${C.gray}  📋 Error data:${C.reset}`, fbErr.error_data);
  }

  _print(level, emoji, msg, data, err) {
    const lc = { SUCCESS: C.green, ERROR: C.red, WARN: C.yellow, DEBUG: C.gray, INFO: C.cyan }[level] || C.white;
    const prefix = `${lc}${emoji} [${level}]${C.reset} ${C.gray}[${this._elapsed()}]${C.reset}`;
    const parts  = [prefix, msg];
    if (data) parts.push(`\n${C.gray}${JSON.stringify(data, null, 2)}${C.reset}`);

    if (level === "ERROR") {
      console.error(...parts);
      const fbErr = err ? this._extractFbError(err) : null;
      if (fbErr) this._printMetaErrorBlock(fbErr);
      if (err) console.error(`${C.red}❌ Error details:${C.reset}\n${C.gray}${JSON.stringify(this._formatError(err), null, 2)}${C.reset}`);
    } else if (level === "WARN") {
      console.warn(...parts);
    } else {
      console.log(...parts);
    }
  }

  step(name) {
    this._stepCounter++;
    const label = `STEP ${this._stepCounter}: ${name}`;
    console.log(`\n${C.blue}${"─".repeat(64)}${C.reset}`);
    console.log(`${C.blue}${C.bold}🔷 ${label}${C.reset}  ${C.gray}[${this._elapsed()}]${C.reset}`);
    console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);
    return label;
  }

  start(msg) {
    console.log(`\n${C.bgBlue}${C.bold}${"═".repeat(70)}${C.reset}`);
    console.log(`${C.blue}${C.bold}🚀 ${msg}${C.reset}`);
    console.log(`${C.bgBlue}${C.bold}${"═".repeat(70)}${C.reset}\n`);
  }

  info(msg, data = null)              { this._print("INFO",    "ℹ️ ", msg, data); }
  success(msg, data = null)           { this._print("SUCCESS", "✅", msg, data); }
  warn(msg, data = null)              { this._print("WARN",    "⚠️ ", msg, data); }
  error(msg, err = null, data = null) { this._print("ERROR",   "❌", msg, data, err); }
  meta(msg, data = null)              { this._print("INFO",    "🌐", `Meta API → ${msg}`, data); }
  instagram(msg, data = null)         { this._print("INFO",    "📸", `Instagram → ${msg}`, data); }
  asset(msg, data = null)             { this._print("INFO",    "🖼️ ", `Asset → ${msg}`, data); }
  video(msg, data = null)             { this._print("INFO",    "🎬", `Video → ${msg}`, data); }
  db(msg, data = null)                { this._print("INFO",    "💾", `DB → ${msg}`, data); }
  debug(msg, data = null)             { this._print("DEBUG",   "🔍", msg, data); }
  perf(msg, startMs)                  { this._print("INFO",    "⏱️ ", `${msg} — took ${Date.now() - startMs}ms`); }

  metaError(context, params, err) {
    const fbErr = this._extractFbError(err);
    console.error(`\n${C.bgRed}${C.bold}${"═".repeat(60)}${C.reset}`);
    console.error(`${C.red}${C.bold}🔴 META API CALL FAILED — ${context}${C.reset}`);
    console.error(`${C.bgRed}${C.bold}${"═".repeat(60)}${C.reset}`);
    console.error(`${C.yellow}📤 Params sent:${C.reset}\n${C.gray}${JSON.stringify(params, null, 2)}${C.reset}`);
    if (fbErr) this._printMetaErrorBlock(fbErr);
    console.error(`${C.red}🔎 Formatted:${C.reset}\n${C.gray}${JSON.stringify(this._formatError(err), null, 2)}${C.reset}`);
    console.error(`${C.bgRed}${C.bold}${"═".repeat(60)}${C.reset}\n`);
  }

  divider(label = "") {
    console.log(`\n${C.gray}${"· ".repeat(32)}${C.reset}`);
    if (label) console.log(`${C.bold}   ${label}${C.reset}`);
  }

  printFinalSummary(totalMs) {
    const o = this.outcomes;
    console.log(`\n${C.bgBlue}${C.bold}${"═".repeat(70)}${C.reset}`);
    console.log(`${C.blue}${C.bold}  📊 DUPLICATION RUN SUMMARY  ${C.gray}(${(totalMs / 1000).toFixed(2)}s total)${C.reset}`);
    console.log(`${C.bgBlue}${C.bold}${"═".repeat(70)}${C.reset}\n`);

    console.log(`${C.bold}  Pipeline:${C.reset}`);
    checkRow("Auth",                 o.auth            === true);
    checkRow("DB Accounts",          o.dbAccounts      === true);
    checkRow("Campaign Fetch",       o.campaignFetch   === true);
    checkRow("Ad Sets Fetch",        o.adSetsFetch     === true);
    checkRow("Creatives Fetch",      o.creativesFetch  === true);
    checkRow("Inline Asset Resolve", o.assetResolution === true || o.assetResolution === "skipped",
      o.assetResolution === false     ? "some URLs could not be resolved" :
      o.assetResolution === "skipped" ? "same-account — skipped" : "");
    checkRow("Asset Transfer",       o.assetTransfer   === true || o.assetTransfer === "skipped",
      o.assetTransfer === false     ? "transfer failed — creative will be missing image" :
      o.assetTransfer === "skipped" ? "same-account — skipped" : "");
    checkRow("Instagram Validation", o.igValidation    === true || o.igValidation === "skipped");
    checkRow("Campaign → Meta",      o.campaignCreate  === true);
    checkRow("Campaign → DB",        o.campaignDB      === true);

    if (o.adSetsCreate.length > 0) {
      console.log(`\n${C.bold}  Ad Sets:${C.reset}`);
      for (const as of o.adSetsCreate) {
        checkRow(`"${as.name}" → Meta`, as.metaOk, as.metaId ? `id: ${as.metaId}` : as.error || "");
        checkRow(`"${as.name}" → DB`,   as.dbOk,   as.dbOk  === false ? "non-fatal" : "");
      }
    }

    if (o.adsCreate.length > 0) {
      console.log(`\n${C.bold}  Ads:${C.reset}`);
      for (const ad of o.adsCreate) {
        checkRow(`"${ad.name}" → Meta`, ad.metaOk, ad.metaId ? `id: ${ad.metaId}` : ad.error || "");
        checkRow(`"${ad.name}" → DB`,   ad.dbOk,   ad.dbOk  === false ? "non-fatal" : "");
      }
    }

    const metaFullOk = o.campaignCreate && o.adSetsCreate.every((a) => a.metaOk) && o.adsCreate.every((a) => a.metaOk);
    const dbAnyFail  = !o.campaignDB    || o.adSetsCreate.some((a) => !a.dbOk)   || o.adsCreate.some((a) => !a.dbOk);

    console.log(`\n${C.bold}  Verdict:${C.reset}`);
    if (metaFullOk && !dbAnyFail) {
      console.log(`  ${C.bgGreen}${C.bold}  ✅ FULLY SUCCESSFUL  ${C.reset}`);
    } else if (metaFullOk && dbAnyFail) {
      console.log(`  ${C.bgYellow}${C.bold}  ⚠️  META OK — DB SYNC PARTIAL  ${C.reset}`);
    } else {
      console.log(`  ${C.bgRed}${C.bold}  ❌ PARTIAL / FULL FAILURE  ${C.reset}`);
      console.log(`  ${C.red}  Check errors above. Orphaned Meta objects may need manual deletion.${C.reset}`);
    }
    console.log(`\n${C.bgBlue}${C.bold}${"═".repeat(70)}${C.reset}\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMIT HANDLER
// ─────────────────────────────────────────────────────────────────────────────

class RateLimitHandler {
  constructor(logger) { this.logger = logger; this.maxRetries = 3; }

  async executeWithRetry(fn, context = "API call") {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try { return await fn(); } catch (err) {
        const isRate = this._isRateLimit(err);
        const isLast = attempt === this.maxRetries;
        if (!isRate || isLast) throw err;
        const wait = Math.min(1000 * Math.pow(2, attempt + 1), 12000);
        this.logger.warn(`Rate limit on "${context}" — retrying in ${wait}ms (attempt ${attempt + 1}/${this.maxRetries})`);
        await this._sleep(wait);
      }
    }
  }

  _isRateLimit(err) {
    const code = err?.code || err?.body?.error?.code;
    return [4, 17, 32, 613, 80004].includes(code);
  }

  _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const META_API_VERSION = process.env.META_API_VERSION || "v24.0";

function _previewUrl(url, len = 110) {
  if (!url) return "(none)";
  return url.length > len ? url.substring(0, len) + "…" : url;
}

function isFacebookCdnUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host.endsWith("fbcdn.net") || host.endsWith("cdninstagram.com") || host.includes("fbcdn");
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Magic-byte image validation
// ─────────────────────────────────────────────────────────────────────────────
function validateImageBuffer(buffer, logger) {
  if (!buffer || buffer.length < 12) {
    throw new Error(`Downloaded buffer too small (${buffer?.length || 0} bytes)`);
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return "gif";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "webp";

  const hexPreview = Array.from(buffer.slice(0, 32)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
  logger.warn(`  Image buffer magic bytes unrecognized — first 32 bytes: ${hexPreview}`);

  if (buffer[0] === 0x3C) {
    const textPreview = buffer.slice(0, 200).toString("utf8");
    throw new Error(
      `Downloaded content is HTML (not an image). CDN URL may be geo-blocked or expired. ` +
      `Preview: ${textPreview.substring(0, 120)}`
    );
  }
  throw new Error(`Buffer (${buffer.length} bytes) is not a valid image. Hex: ${hexPreview}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE ASSET RESOLVER  (v7.0 — FIX-17, FIX-18)
// ─────────────────────────────────────────────────────────────────────────────

class InlineAssetResolver {
  constructor(logger, rateLimiter, sourceAccessToken, sourceMetaAccountId) {
    this.logger               = logger;
    this.rateLimiter          = rateLimiter;
    this.sourceAccessToken    = sourceAccessToken;

    const raw = String(sourceMetaAccountId || "");
    this.sourceMetaAccountId  = raw.startsWith("act_") ? raw : `act_${raw}`;

    this.hashToUrl    = {};
    this.videoIdToUrl = {};

    this._stats = {
      imagesResolved: 0,
      imagesFailed:   0,
      videosResolved: 0,
      videosFailed:   0,
    };
  }

  async resolveAll(adsWithCreatives) {
    const t0 = Date.now();

    console.log(`\n${C.magenta}${"─".repeat(64)}${C.reset}`);
    console.log(`${C.magenta}${C.bold}  🔎 INLINE ASSET RESOLUTION (v7.0)${C.reset}`);
    console.log(`${C.magenta}  Resolving image hashes via /adimages edge (FIX-17)${C.reset}`);
    console.log(`${C.magenta}  sourceAccount: ${this.sourceMetaAccountId}${C.reset}`);
    console.log(`${C.magenta}${"─".repeat(64)}${C.reset}`);

    const { uniqueHashes, uniqueVideoIds } = this._discoverFromCreatives(adsWithCreatives);

    this.logger.asset("Discovered unique assets to resolve", {
      uniqueImageHashes: uniqueHashes.size,
      uniqueVideoIds:    uniqueVideoIds.size,
    });

    if (uniqueHashes.size > 0) {
      console.log(`\n${C.magenta}  ┌─ IMAGE URL RESOLUTION (${uniqueHashes.size} unique hashes)${C.reset}`);
      await this._resolveImages(uniqueHashes);
      console.log(`${C.magenta}  └─────${C.reset}`);
    } else {
      this.logger.asset("No image hashes found in creatives — skipping image resolution");
    }

    if (uniqueVideoIds.size > 0) {
      console.log(`\n${C.magenta}  ┌─ VIDEO URL RESOLUTION (${uniqueVideoIds.size} unique video IDs)${C.reset}`);
      await this._resolveVideos(uniqueVideoIds);
      console.log(`${C.magenta}  └─────${C.reset}`);
    } else {
      this.logger.video("No video IDs found in creatives — skipping video resolution");
    }

    this._printResolutionManifest(uniqueHashes, uniqueVideoIds);

    const allOk = this._stats.imagesFailed === 0 && this._stats.videosFailed === 0;

    this.logger.asset(`✅ Inline resolution complete — ${Date.now() - t0}ms`, {
      allOk,
      stats:          this._stats,
      resolvedImages: Object.keys(this.hashToUrl).length,
      resolvedVideos: Object.keys(this.videoIdToUrl).length,
    });

    console.log(`${C.magenta}${"─".repeat(64)}${C.reset}\n`);

    return {
      hashToUrl:    this.hashToUrl,
      videoIdToUrl: this.videoIdToUrl,
      stats:        this._stats,
      allOk,
    };
  }

  _discoverFromCreatives(adsWithCreatives) {
    const uniqueHashes   = new Set();
    const uniqueVideoIds = new Set();

    for (const item of adsWithCreatives) {
      const spec = item.creative?.object_story_spec;
      if (!spec) continue;

      if (spec.photo_data?.image_hash)  uniqueHashes.add(spec.photo_data.image_hash);
      if (spec.link_data?.image_hash)   uniqueHashes.add(spec.link_data.image_hash);

      for (const child of (spec.link_data?.child_attachments || [])) {
        if (child.image_hash) uniqueHashes.add(child.image_hash);
      }

      if (spec.video_data?.video_id) {
        uniqueVideoIds.add(String(spec.video_data.video_id));
        if (spec.video_data.image_hash) uniqueHashes.add(spec.video_data.image_hash);
      }

      this.logger.debug(`  Scanned creative for "${item.adName}"`, {
        creativeId:    item.creativeId,
        foundHashes:   [
          spec.photo_data?.image_hash,
          spec.link_data?.image_hash,
          spec.video_data?.image_hash,
          ...(spec.link_data?.child_attachments || []).map((c) => c.image_hash),
        ].filter(Boolean).map((h) => h.substring(0, 12) + "…"),
        foundVideoIds: spec.video_data?.video_id ? [spec.video_data.video_id] : [],
      });
    }

    this.logger.asset("Asset discovery from creatives complete", {
      uniqueHashes:   uniqueHashes.size,
      uniqueVideoIds: uniqueVideoIds.size,
    });

    return { uniqueHashes, uniqueVideoIds };
  }

  async _resolveImages(uniqueHashes) {
    const CHUNK_SIZE  = 50;
    const hashArray   = [...uniqueHashes];
    const totalChunks = Math.ceil(hashArray.length / CHUNK_SIZE);

    console.log(`\n${C.magenta}  │  Fetching ${hashArray.length} hash(es) via /adimages edge` +
      ` (${totalChunks} batch(es) of up to ${CHUNK_SIZE})${C.reset}`);
    console.log(`${C.magenta}  │  endpoint: GET /${this.sourceMetaAccountId}/adimages?hashes=[...]&fields=hash,url${C.reset}`);

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const chunk    = hashArray.slice(chunkIdx * CHUNK_SIZE, (chunkIdx + 1) * CHUNK_SIZE);
      const t0Chunk  = Date.now();

      console.log(`\n${C.magenta}  │  ── Batch ${chunkIdx + 1}/${totalChunks}  (${chunk.length} hashes) ──${C.reset}`);

      const hashesParam = encodeURIComponent(JSON.stringify(chunk));
      const endpoint    =
        `https://graph.facebook.com/${META_API_VERSION}/${this.sourceMetaAccountId}/adimages` +
        `?hashes=${hashesParam}&fields=hash,url,width,height` +
        `&access_token=${this.sourceAccessToken}`;

      try {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20_000);
        let res, data;
        try {
          res  = await fetch(endpoint, { signal: ctrl.signal });
          data = await res.json();
        } finally { clearTimeout(timer); }

        console.log(`  ${C.gray}│  → HTTP ${res.status}  hasData=${!!data?.data}  hasError=${!!data?.error}  ms=${Date.now() - t0Chunk}${C.reset}`);

        if (data?.error) {
          const errMsg = data.error.message || JSON.stringify(data.error);
          console.error(`  ${C.red}│  → Meta error on batch ${chunkIdx + 1}: ${errMsg}${C.reset}`);
          for (const hash of chunk) {
            if (!this.hashToUrl[hash]) this._stats.imagesFailed++;
          }
          continue;
        }

        const entries     = data?.data || [];
        const returnedSet = new Set(entries.map((e) => e.hash));

        for (const entry of entries) {
          if (!entry.hash || !entry.url) continue;

          const isCdn  = isFacebookCdnUrl(entry.url);
          const host   = (() => { try { return new URL(entry.url).hostname; } catch { return "?"; } })();
          const hDisp  = entry.hash.substring(0, 14) + "…";

          this.hashToUrl[entry.hash] = entry.url;
          this._stats.imagesResolved++;

          if (isCdn) {
            console.log(`  ${C.green}│  → ✅ ${hDisp}  host=${host}${entry.width ? `  ${entry.width}×${entry.height}` : ""}${C.reset}`);
          } else {
            console.log(`  ${C.yellow}│  → ⚠️  ${hDisp}  NON-CDN url — may fail download  host=${host}${C.reset}`);
          }
          console.log(`  ${C.gray}│     url=${_previewUrl(entry.url, 90)}${C.reset}`);
        }

        for (const hash of chunk) {
          if (!returnedSet.has(hash)) {
            const hDisp = hash.substring(0, 14) + "…";
            console.error(`  ${C.red}│  → ❌ ${hDisp}  not returned by /adimages (may not exist in source account)${C.reset}`);
            this._stats.imagesFailed++;
          }
        }

      } catch (err) {
        console.error(`  ${C.red}│  → ❌ EXCEPTION on batch ${chunkIdx + 1}: ${err?.message}${C.reset}`);
        for (const hash of chunk) {
          if (!this.hashToUrl[hash]) this._stats.imagesFailed++;
        }
        this.logger.error(`/adimages batch ${chunkIdx + 1} exception`, err);
      }
    }
  }

  async _resolveVideos(uniqueVideoIds) {
    let idx = 0;
    for (const videoId of uniqueVideoIds) {
      idx++;
      const t0 = Date.now();

      console.log(`\n${C.magenta}  │  VID ${idx}/${uniqueVideoIds.size}  id=${C.cyan}${videoId}${C.reset}`);

      if (this.videoIdToUrl[videoId]) {
        console.log(`  ${C.gray}│  → cache HIT — url already resolved${C.reset}`);
        continue;
      }

      try {
        const endpoint =
          `https://graph.facebook.com/${META_API_VERSION}/${videoId}` +
          `?fields=source,playable_url,status,title,length&access_token=${this.sourceAccessToken}`;

        console.log(`  ${C.gray}│  → GET /{videoId}?fields=source,playable_url,status,title,length${C.reset}`);

        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15_000);
        let res, data;
        try {
          res  = await fetch(endpoint, { signal: ctrl.signal });
          data = await res.json();
        } finally { clearTimeout(timer); }

        console.log(`  ${C.gray}│  → HTTP ${res.status}  hasSource=${!!data?.source}  hasPlayable=${!!data?.playable_url}  hasError=${!!data?.error}${C.reset}`);

        if (data?.error) {
          console.error(`  ${C.red}│  → Meta error: ${data.error.message || JSON.stringify(data.error)}${C.reset}`);
          this._stats.videosFailed++;
          continue;
        }

        if (data?.title)  console.log(`  ${C.gray}│  → title=${data.title}${C.reset}`);
        if (data?.length) console.log(`  ${C.gray}│  → duration=${data.length}s${C.reset}`);

        const videoStatus = data?.status?.video_status || "unknown";
        console.log(`  ${C.gray}│  → videoStatus=${videoStatus}${C.reset}`);

        if (data?.source) {
          this.videoIdToUrl[videoId] = data.source;
          this._stats.videosResolved++;
          const host = (() => { try { return new URL(data.source).hostname; } catch { return "?"; } })();
          console.log(`  ${C.green}│  → ✅ RESOLVED via source (direct mp4)  host=${host}  ms=${Date.now() - t0}${C.reset}`);
          console.log(`  ${C.gray}│  → url=${_previewUrl(data.source, 90)}${C.reset}`);
        } else if (data?.playable_url) {
          this.videoIdToUrl[videoId] = data.playable_url;
          this._stats.videosResolved++;
          const host = (() => { try { return new URL(data.playable_url).hostname; } catch { return "?"; } })();
          console.log(`  ${C.green}│  → ✅ RESOLVED via playable_url  host=${host}  ms=${Date.now() - t0}${C.reset}`);
          console.log(`  ${C.gray}│  → url=${_previewUrl(data.playable_url, 90)}${C.reset}`);
        } else {
          console.error(
            `  ${C.red}│  → ❌ FAILED — neither source nor playable_url returned${C.reset}\n` +
            `  ${C.red}│     videoStatus="${videoStatus}"  response: ${JSON.stringify(data).substring(0, 200)}${C.reset}`
          );
          this._stats.videosFailed++;
        }
      } catch (err) {
        console.error(`  ${C.red}│  → ❌ EXCEPTION  ms=${Date.now() - t0}  error=${err?.message}${C.reset}`);
        this._stats.videosFailed++;
        this.logger.error(`Video URL resolution failed for id ${videoId}`, err);
      }
    }
  }

  _printResolutionManifest(uniqueHashes, uniqueVideoIds) {
    console.log(`\n${C.blue}${"─".repeat(64)}${C.reset}`);
    console.log(`${C.blue}${C.bold}  📦 RESOLVED ASSET MANIFEST (pre-transfer)${C.reset}`);
    console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);

    let n = 0;
    for (const hash of uniqueHashes) {
      n++;
      const url      = this.hashToUrl[hash];
      const hashDisp = hash.substring(0, 14) + "…";
      if (url) {
        const isCdn = isFacebookCdnUrl(url);
        const host  = (() => { try { return new URL(url).hostname; } catch { return "?"; } })();
        console.log(
          `  ${C.gray}IMG ${n}${C.reset}  hash=${C.cyan}${hashDisp}${C.reset}` +
          `  ${C.green}✓ RESOLVED${C.reset}` +
          `  isCdn=${isCdn}  host=${C.gray}${host}${C.reset}` +
          `  url=${C.gray}${_previewUrl(url, 60)}${C.reset}`
        );
      } else {
        console.log(
          `  ${C.gray}IMG ${n}${C.reset}  hash=${C.cyan}${hashDisp}${C.reset}` +
          `  ${C.red}✗ NO URL — image will be missing from duplicated creative${C.reset}`
        );
      }
    }

    n = 0;
    for (const videoId of uniqueVideoIds) {
      n++;
      const url = this.videoIdToUrl[videoId];
      if (url) {
        const host = (() => { try { return new URL(url).hostname; } catch { return "?"; } })();
        console.log(
          `  ${C.gray}VID ${n}${C.reset}  id=${C.cyan}${videoId}${C.reset}` +
          `  ${C.green}✓ RESOLVED${C.reset}` +
          `  host=${C.gray}${host}${C.reset}` +
          `  url=${C.gray}${_previewUrl(url, 60)}${C.reset}`
        );
      } else {
        console.log(
          `  ${C.gray}VID ${n}${C.reset}  id=${C.cyan}${videoId}${C.reset}` +
          `  ${C.red}✗ NO URL — video will be missing from duplicated creative${C.reset}`
        );
      }
    }

    console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);
    console.log(
      `  Images : ${C.green}${this._stats.imagesResolved} resolved${C.reset}` +
      `  ${this._stats.imagesFailed > 0 ? C.red : C.gray}${this._stats.imagesFailed} failed${C.reset}`
    );
    console.log(
      `  Videos : ${C.green}${this._stats.videosResolved} resolved${C.reset}` +
      `  ${this._stats.videosFailed > 0 ? C.red : C.gray}${this._stats.videosFailed} failed${C.reset}`
    );
    console.log(`${C.blue}${"─".repeat(64)}${C.reset}\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET TRANSFER MANAGER
// ─────────────────────────────────────────────────────────────────────────────

class AssetTransferManager {
  constructor(logger, rateLimiter, sourceAccount, targetAccount) {
    this.logger        = logger;
    this.rateLimiter   = rateLimiter;
    this.sourceAccount = sourceAccount;
    this.targetAccount = targetAccount;

    this.imageHashMap = {};
    this.videoIdMap   = {};

    this._stats = {
      imagesTransferred: 0,
      imagesFailed:      0,
      videosTransferred: 0,
      videosFailed:      0,
    };

    this._hashToUrl    = {};
    this._videoIdToUrl = {};
  }

  loadResolvedMaps(hashToUrl, videoIdToUrl) {
    console.log(`\n${C.cyan}${"─".repeat(64)}${C.reset}`);
    console.log(`${C.cyan}${C.bold}  📥 LOADING INLINE-RESOLVED ASSET MAPS${C.reset}`);
    console.log(`${C.cyan}${"─".repeat(64)}${C.reset}`);

    this._hashToUrl    = hashToUrl    || {};
    this._videoIdToUrl = videoIdToUrl || {};

    let imgLoaded = 0, imgMissing = 0;
    for (const [hash, url] of Object.entries(this._hashToUrl)) {
      if (url) {
        imgLoaded++;
        this.logger.debug("  Image map entry", {
          hash:       hash.substring(0, 16) + "…",
          isCdn:      isFacebookCdnUrl(url),
          urlPreview: _previewUrl(url, 80),
        });
      } else {
        imgMissing++;
        this.logger.warn("  Image map entry has null URL", { hash: hash.substring(0, 12) + "…" });
      }
    }

    let vidLoaded = 0, vidMissing = 0;
    for (const [id, url] of Object.entries(this._videoIdToUrl)) {
      if (url) { vidLoaded++; this.logger.debug("  Video map entry", { id, urlPreview: _previewUrl(url, 80) }); }
      else      { vidMissing++; this.logger.warn("  Video map entry has null URL", { id }); }
    }

    this.logger.asset("✅ Resolved maps loaded into transfer manager", {
      images: { loaded: imgLoaded, missing: imgMissing },
      videos: { loaded: vidLoaded, missing: vidMissing },
    });
    console.log(`${C.cyan}${"─".repeat(64)}${C.reset}\n`);
  }

  async transferAllAssets(adsWithCreatives) {
    const t0 = Date.now();
    this.logger.asset("🚦 Starting asset transfer pipeline…", {
      totalAds:            adsWithCreatives.length,
      libraryImagesLoaded: Object.keys(this._hashToUrl).length,
      libraryVideosLoaded: Object.keys(this._videoIdToUrl).length,
    });

    const { uniqueImages, uniqueVideos } = this._discoverAssets(adsWithCreatives);
    this._logPreTransferManifest(uniqueImages, uniqueVideos);

    if (uniqueImages.size > 0) {
      this.logger.divider(`IMAGE TRANSFERS  (${uniqueImages.size} unique)`);
      await this._transferImages(uniqueImages);
    } else {
      this.logger.asset("ℹ️  No images discovered in creatives — skipping image transfer");
    }

    if (uniqueVideos.size > 0) {
      this.logger.divider(`VIDEO TRANSFERS  (${uniqueVideos.size} unique)`);
      await this._transferVideos(uniqueVideos);
    } else {
      this.logger.video("ℹ️  No videos discovered in creatives — skipping video transfer");
    }

    this._logPostTransferResults(uniqueImages, uniqueVideos);

    const noAssets = uniqueImages.size === 0 && uniqueVideos.size === 0;
    const allOk    = noAssets || (this._stats.imagesFailed === 0 && this._stats.videosFailed === 0);

    this.logger.asset(`🏁 Asset transfer pipeline complete — ${Date.now() - t0}ms`, {
      allOk, stats: this._stats,
      imageHashMapSize: Object.keys(this.imageHashMap).length,
      videoIdMapSize:   Object.keys(this.videoIdMap).length,
    });

    return { imageHashMap: this.imageHashMap, videoIdMap: this.videoIdMap, stats: this._stats, allOk };
  }

  _discoverAssets(adsWithCreatives) {
    const uniqueImages = new Map();
    const uniqueVideos = new Map();
    let adsWithSpec = 0, adsWithoutSpec = 0;

    for (const item of adsWithCreatives) {
      const spec = item.creative?.object_story_spec;
      if (!spec) { adsWithoutSpec++; continue; }
      adsWithSpec++;
      this._extractFromPhotoData(spec.photo_data, uniqueImages);
      this._extractFromLinkData(spec.link_data, uniqueImages);
      this._extractFromVideoData(spec.video_data, uniqueImages, uniqueVideos);
      for (const child of (spec.link_data?.child_attachments || [])) {
        this._extractFromLinkData(child, uniqueImages);
      }
    }

    this.logger.asset("🔍 Asset discovery complete", {
      adsScanned: adsWithCreatives.length, adsWithSpec, adsWithoutSpec,
      uniqueImages: uniqueImages.size, uniqueVideos: uniqueVideos.size,
    });

    return { uniqueImages, uniqueVideos };
  }

  _extractFromPhotoData(data, uniqueImages) {
    if (!data?.image_hash) return;
    uniqueImages.set(data.image_hash, data.url || null);
  }

  _extractFromLinkData(data, uniqueImages) {
    if (!data) return;
    if (data.image_hash) uniqueImages.set(data.image_hash, data.image_url || null);
  }

  _extractFromVideoData(data, uniqueImages, uniqueVideos) {
    if (!data?.video_id) return;
    uniqueVideos.set(data.video_id, { thumbnailHash: data.image_hash || null, thumbnailUrl: data.image_url || null });
    if (data.image_hash) uniqueImages.set(data.image_hash, data.image_url || null);
  }

  _logPreTransferManifest(uniqueImages, uniqueVideos) {
    console.log(`\n${C.blue}${"─".repeat(64)}${C.reset}`);
    console.log(`${C.blue}${C.bold}  📦 PRE-TRANSFER ASSET MANIFEST${C.reset}`);
    console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);

    if (uniqueImages.size === 0 && uniqueVideos.size === 0) {
      console.log(`  ${C.gray}(no assets to transfer)${C.reset}`);
    }

    let n = 0;
    for (const [hash] of uniqueImages) {
      n++;
      const url      = this._hashToUrl[hash];
      const hashDisp = hash.substring(0, 14) + "…";
      if (url) {
        const host = (() => { try { return new URL(url).hostname; } catch { return "?"; } })();
        console.log(
          `  ${C.gray}IMG ${n}${C.reset}  hash=${C.cyan}${hashDisp}${C.reset}` +
          `  source=${C.green}[inline-resolved]${C.reset}  method=${C.yellow}binary-download${C.reset}` +
          `  host=${C.gray}${host}${C.reset}  url=${C.gray}${_previewUrl(url, 60)}${C.reset}`
        );
      } else {
        console.log(
          `  ${C.gray}IMG ${n}${C.reset}  hash=${C.cyan}${hashDisp}${C.reset}` +
          `  ${C.red}✗ NO URL — inline resolution failed for this hash${C.reset}`
        );
      }
    }

    n = 0;
    for (const [videoId] of uniqueVideos) {
      n++;
      const url = this._videoIdToUrl[String(videoId)];
      if (url) {
        const host = (() => { try { return new URL(url).hostname; } catch { return "?"; } })();
        console.log(
          `  ${C.gray}VID ${n}${C.reset}  id=${C.cyan}${videoId}${C.reset}` +
          `  source=${C.green}[inline-resolved]${C.reset}  method=${C.yellow}binary-download${C.reset}` +
          `  host=${C.gray}${host}${C.reset}  url=${C.gray}${_previewUrl(url, 60)}${C.reset}`
        );
      } else {
        console.log(
          `  ${C.gray}VID ${n}${C.reset}  id=${C.cyan}${videoId}${C.reset}` +
          `  ${C.red}✗ NO URL — inline resolution failed for this video${C.reset}`
        );
      }
    }

    console.log(`${C.blue}${"─".repeat(64)}${C.reset}\n`);
  }

  async _transferImages(uniqueImages) {
    let idx = 0;
    for (const [sourceHash] of uniqueImages) {
      idx++;
      const t0       = Date.now();
      const hashDisp = sourceHash.substring(0, 16) + "…";
      const label    = `Image ${idx}/${uniqueImages.size}  hash: ${hashDisp}`;

      console.log(`\n${C.cyan}  ┌─ ${label}${C.reset}`);

      const libraryUrl = this._hashToUrl[sourceHash];

      if (!libraryUrl) {
        this._stats.imagesFailed++;
        console.error(
          `  ${C.red}│ ❌ SKIPPED — no URL for this hash (inline resolution failed)${C.reset}\n` +
          `  ${C.red}│    hash=${sourceHash.substring(0, 16)}…${C.reset}`
        );
        console.log(`  ${C.cyan}└─────${C.reset}`);
        continue;
      }

      const isCdn   = isFacebookCdnUrl(libraryUrl);
      const urlHost = (() => { try { return new URL(libraryUrl).hostname; } catch { return "?"; } })();

      console.log(`  ${C.gray}│ URL source   : inline-resolved (GET /adimages?hashes=[...])${C.reset}`);
      console.log(`  ${C.gray}│ isFbCdn      : ${isCdn}${C.reset}`);
      console.log(`  ${C.gray}│ urlHost      : ${urlHost}${C.reset}`);
      console.log(`  ${C.gray}│ url          : ${_previewUrl(libraryUrl, 100)}${C.reset}`);
      console.log(`  ${C.gray}│ uploadMethod : binary-download → binary-upload${C.reset}`);

      try {
        const targetHash = await this.rateLimiter.executeWithRetry(
          () => this._downloadAndUploadImage(libraryUrl, sourceHash),
          `Upload image ${hashDisp}`
        );
        this.imageHashMap[sourceHash] = targetHash;
        this._stats.imagesTransferred++;
        console.log(
          `  ${C.green}│ ✅ SUCCESS  targetHash=${targetHash.substring(0, 16)}…` +
          `  sameHash=${targetHash === sourceHash}  tookMs=${Date.now() - t0}${C.reset}`
        );
      } catch (err) {
        this._stats.imagesFailed++;
        console.error(`  ${C.red}│ ❌ FAILED  tookMs=${Date.now() - t0}${C.reset}`);
        console.error(`  ${C.red}│ error     : ${err?.message || String(err)}${C.reset}`);
        if (err?.code)          console.error(`  ${C.red}│ metaCode  : ${err.code}${C.reset}`);
        if (err?.error_subcode) console.error(`  ${C.red}│ subcode   : ${err.error_subcode}${C.reset}`);
        if (err?.fbtrace_id)    console.error(`  ${C.red}│ traceId   : ${err.fbtrace_id}${C.reset}`);
        this.logger.error(`❌ ${label} FAILED`, err, { sourceHash, libraryUrl: _previewUrl(libraryUrl, 80) });
      }

      console.log(`  ${C.cyan}└─────${C.reset}`);
    }
  }

  async _downloadAndUploadImage(imageUrl, sourceHash) {
    const rawId    = this.targetAccount.metaAccountId;
    const cleanId  = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
    const endpoint = `https://graph.facebook.com/${META_API_VERSION}/${cleanId}/adimages`;

    console.log(`  ${C.gray}│ [DOWNLOAD] Starting binary download…${C.reset}`);
    console.log(`  ${C.gray}│ [DOWNLOAD] URL: ${_previewUrl(imageUrl, 100)}${C.reset}`);

    const dlCtrl  = new AbortController();
    const dlTimer = setTimeout(() => dlCtrl.abort(), 30_000);
    let downloadRes;
    try {
      downloadRes = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept":     "image/*,*/*;q=0.8",
          "Referer":    "https://www.facebook.com/",
        },
        signal: dlCtrl.signal,
      });
    } finally { clearTimeout(dlTimer); }

    console.log(`  ${C.gray}│ [DOWNLOAD] HTTP status    : ${downloadRes.status}${C.reset}`);
    console.log(`  ${C.gray}│ [DOWNLOAD] content-type   : ${downloadRes.headers.get("content-type") || "—"}${C.reset}`);
    console.log(`  ${C.gray}│ [DOWNLOAD] x-deny-reason  : ${downloadRes.headers.get("x-deny-reason") || "—"}${C.reset}`);

    if (!downloadRes.ok) {
      const err         = new Error(`CDN download failed: HTTP ${downloadRes.status} from ${_previewUrl(imageUrl, 80)}`);
      err.status        = downloadRes.status;
      err.code          = 100;
      err.error_subcode = 2490361;
      throw err;
    }

    const buffer = Buffer.from(await downloadRes.arrayBuffer());

    console.log(`  ${C.gray}│ [DOWNLOAD] Size           : ${(buffer.length / 1024).toFixed(1)} KB (${buffer.length} bytes)${C.reset}`);

    if (buffer.length === 0) throw new Error("CDN download returned 0 bytes");

    let detectedType;
    try {
      detectedType = validateImageBuffer(buffer, this.logger);
      console.log(`  ${C.gray}│ [VALIDATE] Magic bytes OK : ${detectedType}${C.reset}`);
    } catch (validationErr) {
      const err         = new Error(`Image validation failed: ${validationErr.message}`);
      err.code          = 100;
      err.error_subcode = 2490361;
      throw err;
    }

    const ext      = detectedType === "png" ? "png" : detectedType === "gif" ? "gif" : detectedType === "webp" ? "webp" : "jpg";
    const mimeType = detectedType === "png" ? "image/png" : detectedType === "gif" ? "image/gif" : detectedType === "webp" ? "image/webp" : "image/jpeg";
    const filename = `image_${sourceHash.substring(0, 8)}.${ext}`;

    console.log(`  ${C.gray}│ [UPLOAD] Starting binary upload to Meta…${C.reset}`);
    console.log(`  ${C.gray}│ [UPLOAD] filename         : ${filename}${C.reset}`);
    console.log(`  ${C.gray}│ [UPLOAD] mimeType         : ${mimeType}${C.reset}`);
    console.log(`  ${C.gray}│ [UPLOAD] size             : ${(buffer.length / 1024).toFixed(1)} KB${C.reset}`);
    console.log(`  ${C.gray}│ [UPLOAD] endpoint         : ${endpoint.replace(/act_\d+/, "act_***")}${C.reset}`);

    const boundary = `----FormBoundary${Date.now().toString(16)}`;
    let bodyStr    = `--${boundary}\r\n`;
    bodyStr       += `Content-Disposition: form-data; name="${filename}"; filename="${filename}"\r\n`;
    bodyStr       += `Content-Type: ${mimeType}\r\n\r\n`;
    bodyStr       += buffer.toString("binary");
    bodyStr       += `\r\n--${boundary}--`;

    const upCtrl  = new AbortController();
    const upTimer = setTimeout(() => upCtrl.abort(), 60_000);
    let uploadRes, body;
    try {
      uploadRes = await fetch(endpoint, {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${this.targetAccount.accessToken}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body:   Buffer.from(bodyStr, "binary"),
        signal: upCtrl.signal,
      });
      body = await uploadRes.json();
    } finally { clearTimeout(upTimer); }

    console.log(`  ${C.gray}│ [UPLOAD] HTTP status      : ${uploadRes.status}${C.reset}`);
    console.log(`  ${C.gray}│ [UPLOAD] hasImages        : ${!!body?.images}${C.reset}`);
    console.log(`  ${C.gray}│ [UPLOAD] imageKeys        : ${body?.images ? Object.keys(body.images).join(", ") : "—"}${C.reset}`);
    if (body?.error) {
      console.error(`  ${C.red}│ [UPLOAD] Meta error code  : ${body.error.code || "—"}${C.reset}`);
      console.error(`  ${C.red}│ [UPLOAD] Meta error sub   : ${body.error.error_subcode || "—"}${C.reset}`);
      console.error(`  ${C.red}│ [UPLOAD] Meta error msg   : ${body.error.message || "—"}${C.reset}`);
      console.error(`  ${C.red}│ [UPLOAD] Meta error trace : ${body.error.fbtrace_id || "—"}${C.reset}`);
    }

    if (!uploadRes.ok || body?.error) {
      const err         = new Error(body?.error?.message || `Image upload HTTP ${uploadRes.status}`);
      err.code          = body?.error?.code;
      err.error_subcode = body?.error?.error_subcode;
      err.fbtrace_id    = body?.error?.fbtrace_id;
      err.response      = body?.error;
      err.status        = uploadRes.status;
      throw err;
    }

    const images = body.images || {};
    const keys   = Object.keys(images);
    if (keys.length === 0) throw new Error(`/adimages upload: no image entry in response — body: ${JSON.stringify(body).substring(0, 200)}`);
    const newHash = images[keys[0]]?.hash;
    if (!newHash) throw new Error(`/adimages upload: response missing hash — entry: ${JSON.stringify(images[keys[0]]).substring(0, 200)}`);

    console.log(`  ${C.gray}│ [UPLOAD] newHash          : ${newHash.substring(0, 16)}…${C.reset}`);
    return newHash;
  }

  async _transferVideos(uniqueVideos) {
    let idx = 0;
    for (const [sourceVideoId] of uniqueVideos) {
      idx++;
      const t0    = Date.now();
      const label = `Video ${idx}/${uniqueVideos.size}  id: ${sourceVideoId}`;

      console.log(`\n${C.cyan}  ┌─ ${label}${C.reset}`);

      const playableUrl = this._videoIdToUrl[String(sourceVideoId)];

      if (!playableUrl) {
        this._stats.videosFailed++;
        console.error(
          `  ${C.red}│ ❌ SKIPPED — no URL for this video (inline resolution failed)${C.reset}\n` +
          `  ${C.red}│    videoId=${sourceVideoId}${C.reset}`
        );
        console.log(`  ${C.cyan}└─────${C.reset}`);
        continue;
      }

      const urlHost = (() => { try { return new URL(playableUrl).hostname; } catch { return "?"; } })();
      console.log(`  ${C.gray}│ URL source   : inline-resolved (GET /{videoId}?fields=source,playable_url)${C.reset}`);
      console.log(`  ${C.gray}│ urlHost      : ${urlHost}${C.reset}`);
      console.log(`  ${C.gray}│ url          : ${_previewUrl(playableUrl, 100)}${C.reset}`);
      console.log(`  ${C.gray}│ uploadMethod : binary-download → binary-upload${C.reset}`);

      try {
        const newVideoId = await this._downloadAndUploadVideo(sourceVideoId, playableUrl);
        this.videoIdMap[sourceVideoId] = newVideoId;
        this._stats.videosTransferred++;
        console.log(`  ${C.green}│ ✅ Uploaded  newVideoId=${newVideoId}  elapsed=${Date.now() - t0}ms${C.reset}`);
        console.log(`  ${C.gray}│ ⏳ Polling for ready status…${C.reset}`);
        await this._pollVideoReady(newVideoId);
        console.log(`  ${C.green}│ ✅ Video READY  newVideoId=${newVideoId}  totalMs=${Date.now() - t0}${C.reset}`);
      } catch (err) {
        this._stats.videosFailed++;
        console.error(`  ${C.red}│ ❌ FAILED  sourceVideoId=${sourceVideoId}  tookMs=${Date.now() - t0}${C.reset}`);
        console.error(`  ${C.red}│ error      : ${err?.message || String(err)}${C.reset}`);
        this.logger.error(`❌ ${label} FAILED`, err, { sourceVideoId, playableUrl: _previewUrl(playableUrl, 80) });
      }

      console.log(`  ${C.cyan}└─────${C.reset}`);
    }
  }

  async _downloadAndUploadVideo(sourceVideoId, videoUrl) {
    const rawId    = this.targetAccount.metaAccountId;
    const cleanId  = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
    const endpoint = `https://graph-video.facebook.com/${META_API_VERSION}/${cleanId}/advideos`;

    console.log(`  ${C.gray}│ [DOWNLOAD] Downloading video…${C.reset}`);
    console.log(`  ${C.gray}│ [DOWNLOAD] URL: ${_previewUrl(videoUrl, 100)}${C.reset}`);

    const dlCtrl  = new AbortController();
    const dlTimer = setTimeout(() => dlCtrl.abort(), 120_000);
    let videoRes;
    try {
      videoRes = await fetch(videoUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept":     "video/*,*/*;q=0.8",
          "Referer":    "https://www.facebook.com/",
        },
        signal: dlCtrl.signal,
      });
    } finally { clearTimeout(dlTimer); }

    console.log(`  ${C.gray}│ [DOWNLOAD] HTTP status    : ${videoRes.status}${C.reset}`);
    console.log(`  ${C.gray}│ [DOWNLOAD] content-type   : ${videoRes.headers.get("content-type") || "—"}${C.reset}`);
    console.log(`  ${C.gray}│ [DOWNLOAD] x-deny-reason  : ${videoRes.headers.get("x-deny-reason") || "—"}${C.reset}`);

    if (!videoRes.ok) throw new Error(`Video CDN download failed: HTTP ${videoRes.status} from ${_previewUrl(videoUrl, 80)}`);

    const contentType = videoRes.headers.get("content-type") || "video/mp4";
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const ext         = contentType.includes("quicktime") ? "mov" : contentType.includes("webm") ? "webm" : "mp4";
    const videoMime   = contentType.startsWith("video/") ? contentType : "video/mp4";

    console.log(`  ${C.gray}│ [DOWNLOAD] Size           : ${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB (${videoBuffer.length} bytes)${C.reset}`);
    console.log(`  ${C.gray}│ [DOWNLOAD] ext            : ${ext}${C.reset}`);

    if (videoBuffer.length === 0) throw new Error("Video CDN download returned 0 bytes");

    const filename = `ad_video_${sourceVideoId}.${ext}`;
    console.log(`  ${C.gray}│ [UPLOAD] filename         : ${filename}${C.reset}`);
    console.log(`  ${C.gray}│ [UPLOAD] endpoint         : ${endpoint.replace(/act_\d+/, "act_***")}${C.reset}`);

    const boundary = `----FormBoundary${Date.now().toString(16)}`;
    let bodyStr    = `--${boundary}\r\n`;
    bodyStr       += `Content-Disposition: form-data; name="source"; filename="${filename}"\r\n`;
    bodyStr       += `Content-Type: ${videoMime}\r\n\r\n`;
    bodyStr       += videoBuffer.toString("binary");
    bodyStr       += `\r\n--${boundary}--`;

    const upCtrl  = new AbortController();
    const upTimer = setTimeout(() => upCtrl.abort(), 300_000);
    let uploadRes, body;
    try {
      uploadRes = await fetch(endpoint, {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${this.targetAccount.accessToken}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body:   Buffer.from(bodyStr, "binary"),
        signal: upCtrl.signal,
      });
      body = await uploadRes.json();
    } finally { clearTimeout(upTimer); }

    console.log(`  ${C.gray}│ [UPLOAD] HTTP status      : ${uploadRes.status}${C.reset}`);
    console.log(`  ${C.gray}│ [UPLOAD] newVideoId       : ${body?.id || "—"}${C.reset}`);
    if (body?.error) {
      console.error(`  ${C.red}│ [UPLOAD] Meta error code  : ${body.error.code || "—"}${C.reset}`);
      console.error(`  ${C.red}│ [UPLOAD] Meta error sub   : ${body.error.error_subcode || "—"}${C.reset}`);
      console.error(`  ${C.red}│ [UPLOAD] Meta error msg   : ${body.error.message || "—"}${C.reset}`);
      console.error(`  ${C.red}│ [UPLOAD] Meta error trace : ${body.error.fbtrace_id || "—"}${C.reset}`);
    }

    if (!uploadRes.ok || body?.error) {
      const err    = new Error(body?.error?.message || `Video upload HTTP ${uploadRes.status}`);
      err.response = body?.error;
      err.status   = uploadRes.status;
      throw err;
    }

    if (!body?.id) throw new Error(`/advideos upload: no id in response — body: ${JSON.stringify(body).substring(0, 200)}`);
    return body.id;
  }

  async _pollVideoReady(videoId, maxWaitMs = 180_000, intervalMs = 5_000) {
    const endpoint = `https://graph.facebook.com/${META_API_VERSION}/${videoId}?fields=status,title&access_token=${this.targetAccount.accessToken}`;
    const deadline = Date.now() + maxWaitMs;
    let attempt    = 0;

    while (Date.now() < deadline) {
      attempt++;
      await new Promise((r) => setTimeout(r, intervalMs));

      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      let res, body;
      try {
        res  = await fetch(endpoint, { signal: ctrl.signal });
        body = await res.json();
      } finally { clearTimeout(timer); }

      const status = body?.status?.video_status;
      const phase  = body?.status?.processing_phase?.status || "—";
      console.log(`  ${C.gray}│ [POLL ${attempt}] status=${status || "unknown"}  processingPhase=${phase}${C.reset}`);

      if (status === "ready") { this.logger.video(`  ✅ Video ${videoId} READY after ${attempt} poll(s)`); return; }
      if (status === "error") throw new Error(`Meta video encoding failed for ${videoId}: ${JSON.stringify(body?.status || {})}`);
      if (body?.error)        throw new Error(`Video poll API error: ${body.error.message}`);
    }

    throw new Error(`Video ${videoId} not ready after ${maxWaitMs / 1000}s and ${attempt} polls.`);
  }

  _logPostTransferResults(uniqueImages, uniqueVideos) {
    console.log(`\n${C.blue}${"─".repeat(64)}${C.reset}`);
    console.log(`${C.blue}${C.bold}  📊 ASSET TRANSFER RESULTS${C.reset}`);
    console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);

    let n = 0;
    for (const [srcHash] of uniqueImages) {
      n++;
      const tgtHash  = this.imageHashMap[srcHash];
      const hashDisp = srcHash.substring(0, 14) + "…";
      const status   = tgtHash
        ? `${C.green}✓ transferred → ${tgtHash.substring(0, 14)}…${C.reset}`
        : `${C.red}✗ NO MAPPING — creative will be missing this image${C.reset}`;
      console.log(`  ${C.gray}IMG ${n}${C.reset}  ${hashDisp}  ${status}`);
    }

    n = 0;
    for (const [srcId] of uniqueVideos) {
      n++;
      const tgtId  = this.videoIdMap[srcId];
      const status = tgtId
        ? `${C.green}✓ transferred → ${tgtId}${C.reset}`
        : `${C.red}✗ FAILED — creative will reference invalid video_id${C.reset}`;
      console.log(`  ${C.gray}VID ${n}${C.reset}  id=${srcId}  ${status}`);
    }

    const imgFail = this._stats.imagesFailed;
    const vidFail = this._stats.videosFailed;
    console.log(`${C.blue}${"─".repeat(64)}${C.reset}`);
    console.log(`  Images : ${C.green}${this._stats.imagesTransferred} ok${C.reset}  ${imgFail > 0 ? C.red : C.gray}${imgFail} failed${C.reset}`);
    console.log(`  Videos : ${C.green}${this._stats.videosTransferred} ok${C.reset}  ${vidFail > 0 ? C.red : C.gray}${vidFail} failed${C.reset}`);
    console.log(`${C.blue}${"─".repeat(64)}${C.reset}\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTAGRAM VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

class InstagramValidator {
  constructor(logger, rateLimiter) { this.logger = logger; this.rateLimiter = rateLimiter; }

  async validate(adAccount, instagramActorId, targetPageId) {
    this.logger.instagram("Starting validation", { instagramActorId, targetPageId });
    try {
      const idString = String(instagramActorId);
      if (!/^\d{8,20}$/.test(idString)) return { valid: false, error: "Invalid format", willContinueWithoutInstagram: true };

      let adAccountIgIds = [];
      try {
        const data = await this.rateLimiter.executeWithRetry(() => adAccount.read(["instagram_accounts"]), "Fetch IG from ad account");
        const raw  = data.instagram_accounts;
        const arr  = Array.isArray(raw) ? raw : raw?.data && Array.isArray(raw.data) ? raw.data : raw ? [raw] : [];
        adAccountIgIds = arr.map((a) => String(a.id || a)).filter(Boolean);
        this.logger.instagram(`Ad account IG accounts: ${adAccountIgIds.length}`, { ids: adAccountIgIds });
      } catch (e) { this.logger.warn("Could not fetch IG from ad account (non-fatal)", { error: e.message }); }

      let pageIgIds = [];
      if (targetPageId) {
        try {
          const page     = new Page(targetPageId);
          const pageData = await this.rateLimiter.executeWithRetry(
            () => page.read(["instagram_business_account", "connected_instagram_account"]),
            "Fetch IG from page"
          );
          const fromBiz  = pageData.instagram_business_account?.id  || pageData.instagram_business_account;
          const fromConn = pageData.connected_instagram_account?.id || pageData.connected_instagram_account;
          if (fromBiz)  pageIgIds.push({ id: String(fromBiz),  source: "instagram_business_account" });
          if (fromConn) pageIgIds.push({ id: String(fromConn), source: "connected_instagram_account" });
          this.logger.instagram(`Page IG accounts: ${pageIgIds.length}`, { accounts: pageIgIds });
        } catch (e) { this.logger.warn("Could not fetch IG from page (non-fatal)", { error: e.message }); }
      }

      const allValid = new Set([...adAccountIgIds, ...pageIgIds.map((a) => a.id)]);
      const isValid  = allValid.has(idString);
      this.logger.instagram(isValid ? "✅ Valid" : "❌ Not found", { provided: idString, allValidIds: [...allValid] });

      if (isValid) {
        const source = pageIgIds.find((a) => a.id === idString)?.source || (adAccountIgIds.includes(idString) ? "ad_account" : "unknown");
        return { valid: true, instagramActorId: idString, source };
      }
      return { valid: false, error: "Not connected", willContinueWithoutInstagram: true };
    } catch (err) {
      this.logger.error("Instagram validation threw exception (proceeding without IG)", err);
      return { valid: false, error: err.message, willContinueWithoutInstagram: true };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OBJECTIVE MAPPING
// ─────────────────────────────────────────────────────────────────────────────

const OBJECTIVE_MAP = {
  LINK_CLICKS: "OUTCOME_TRAFFIC", POST_ENGAGEMENT: "OUTCOME_ENGAGEMENT", PAGE_LIKES: "OUTCOME_ENGAGEMENT",
  EVENT_RESPONSES: "OUTCOME_ENGAGEMENT", CONVERSIONS: "OUTCOME_SALES", PRODUCT_CATALOG_SALES: "OUTCOME_SALES",
  LEAD_GENERATION: "OUTCOME_LEADS", MESSAGES: "OUTCOME_LEADS", REACH: "OUTCOME_AWARENESS",
  BRAND_AWARENESS: "OUTCOME_AWARENESS", VIDEO_VIEWS: "OUTCOME_AWARENESS", APP_INSTALLS: "OUTCOME_APP_PROMOTION",
  MOBILE_APP_ENGAGEMENT: "OUTCOME_APP_PROMOTION",
  OUTCOME_LEADS: "OUTCOME_LEADS", OUTCOME_SALES: "OUTCOME_SALES", OUTCOME_ENGAGEMENT: "OUTCOME_ENGAGEMENT",
  OUTCOME_AWARENESS: "OUTCOME_AWARENESS", OUTCOME_TRAFFIC: "OUTCOME_TRAFFIC", OUTCOME_APP_PROMOTION: "OUTCOME_APP_PROMOTION",
};

function mapObjective(raw, logger) {
  const mapped = OBJECTIVE_MAP[raw] || "OUTCOME_TRAFFIC";
  if (mapped !== raw) logger.warn(`Objective remapped: ${raw} → ${mapped}`);
  return mapped;
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE FIELD BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

const BID_STRATEGIES_NEEDING_AMOUNT = new Set(["LOWEST_COST_WITH_BID_CAP", "COST_CAP"]);
const KNOWN_BID_STRATEGIES = new Set([
  "LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "LOWEST_COST_WITH_MIN_ROAS",
]);

function buildSafeBidFields(adSetData, logger) {
  let strategy = adSetData.bid_strategy;
  const amount = adSetData.bid_amount;
  if (strategy && !KNOWN_BID_STRATEGIES.has(strategy)) {
    logger.warn(`Unknown bid_strategy "${strategy}" — falling back`);
    strategy = "LOWEST_COST_WITHOUT_CAP";
  }
  if (!strategy) strategy = "LOWEST_COST_WITHOUT_CAP";
  if (BID_STRATEGIES_NEEDING_AMOUNT.has(strategy) && !amount) {
    logger.warn(`"${strategy}" needs bid_amount — falling back`);
    strategy = "LOWEST_COST_WITHOUT_CAP";
  }
  const out = { bid_strategy: strategy };
  if (BID_STRATEGIES_NEEDING_AMOUNT.has(strategy) && amount) out.bid_amount = amount;
  logger.debug("Resolved bid fields", out);
  return out;
}

function buildSafeBudgetFields(adSetData, logger) {
  const daily    = parseInt(adSetData.daily_budget,    10) || 0;
  const lifetime = parseInt(adSetData.lifetime_budget, 10) || 0;
  logger.debug("Budget resolution", { raw_daily: adSetData.daily_budget, raw_lifetime: adSetData.lifetime_budget, daily, lifetime });
  if (daily > 0 && lifetime > 0) { logger.warn("Both daily+lifetime set — keeping daily_budget"); return { daily_budget: String(daily) }; }
  if (daily > 0)    return { daily_budget:    String(daily) };
  if (lifetime > 0) return { lifetime_budget: String(lifetime) };
  return {};
}

function buildSafePromotedObject(promotedObject, targetPageId, isSameAccount, logger) {
  if (!promotedObject) return null;
  if (isSameAccount) return promotedObject;
  logger.debug("promoted_object: sanitising for cross-account", { original: promotedObject });
  const safe = {};
  if (promotedObject.page_id) {
    logger.info(`promoted_object.page_id: ${promotedObject.page_id} → ${targetPageId}`);
    safe.page_id = targetPageId;
  }
  if (promotedObject.custom_event_type) safe.custom_event_type = promotedObject.custom_event_type;
  if (promotedObject.object_store_url)  safe.object_store_url  = promotedObject.object_store_url;
  const stripped = ["pixel_id","application_id","app_id","offer_id","product_set_id","product_catalog_id"]
    .filter((k) => promotedObject[k]);
  if (stripped.length) logger.warn(`promoted_object: stripped ${stripped.join(", ")} (source-account-specific)`);
  if (Object.keys(safe).length === 0) { logger.warn("promoted_object: nothing transferable — omitting"); return null; }
  logger.success(`promoted_object sanitised — kept: ${Object.keys(safe).join(", ")}`, { safe });
  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATIVE PROCESSOR  (v7.0 — FIX-19)
// ─────────────────────────────────────────────────────────────────────────────

class CreativeProcessor {
  constructor(logger, isSameAccount, targetPageId, targetInstagramActorId, imageHashMap, videoIdMap) {
    this.logger                 = logger;
    this.isSameAccount          = isSameAccount;
    this.targetPageId           = targetPageId;
    this.targetInstagramActorId = targetInstagramActorId;
    this.imageHashMap           = imageHashMap || {};
    this.videoIdMap             = videoIdMap   || {};
  }

  processCreativeSpec(originalCreative, adName) {
    this.logger.debug("Processing creative spec", {
      adName,
      isSameAccount:      this.isSameAccount,
      hasObjectStorySpec: !!originalCreative.object_story_spec,
      hasInstagramActor:  !!this.targetInstagramActorId,
      imageHashMapSize:   Object.keys(this.imageHashMap).length,
      videoIdMapSize:     Object.keys(this.videoIdMap).length,
    });
    const base = { name: `[DUPLICATE] ${adName} - Creative` };
    const spec = originalCreative.object_story_spec;
    if (!spec) {
      this.logger.warn(`No object_story_spec for "${adName}" — using fallback`);
      return this._fallbackCreative(originalCreative, base);
    }
    return this.isSameAccount
      ? this._processSameAccount(spec, base)
      : this._processCrossAccount(spec, base);
  }

  _processSameAccount(spec, base) {
    const s = JSON.parse(JSON.stringify(spec));
    if (s.video_data?.image_hash && s.video_data?.image_url) delete s.video_data.image_url;
    if (s.link_data?.image_hash  && s.link_data?.image_url)  delete s.link_data.image_url;
    if (s.photo_data?.image_hash && s.photo_data?.url)       delete s.photo_data.url;
    delete s.instagram_user_id;
    return { ...base, object_story_spec: s };
  }

  _processCrossAccount(spec, base) {
    const s       = JSON.parse(JSON.stringify(spec));
    const oldPage = s.page_id;
    s.page_id     = this.targetPageId;
    this.logger.info(`page_id: ${oldPage || "(missing)"} → ${this.targetPageId}`);
    this._handleInstagramPlacement(s);
    this._replaceAssets(s);
    this.logger.debug("Cross-account creative ready", {
      page_id:            s.page_id,
      instagram_actor_id: s.instagram_actor_id || "NOT SET",
      hasVideoData:       !!s.video_data,
      hasLinkData:        !!s.link_data,
      hasPhotoData:       !!s.photo_data,
    });
    return { ...base, object_story_spec: s };
  }

  _handleInstagramPlacement(spec) {
    const hadInstagram = !!(spec.instagram_actor_id || spec.instagram_user_id);
    delete spec.instagram_user_id;
    if (this.targetInstagramActorId) {
      spec.instagram_actor_id = this.targetInstagramActorId;
      this.logger.success(`Instagram placement ENABLED — actor: ${this.targetInstagramActorId}`);
    } else if (hadInstagram) {
      delete spec.instagram_actor_id;
      this.logger.warn("Instagram placement REMOVED — no valid targetInstagramActorId");
    }
  }

  _replaceAssets(spec) {
    // photo_data
    if (spec.photo_data?.image_hash) {
      const src = spec.photo_data.image_hash;
      const tgt = this.imageHashMap[src];
      if (tgt) {
        spec.photo_data.image_hash = tgt;
        delete spec.photo_data.url;
        this.logger.asset(`photo_data.image_hash: ${src.substring(0,12)}… → ${tgt.substring(0,12)}…`);
      } else {
        delete spec.photo_data.url;
        this.logger.warn(
          `photo_data.image_hash=${src.substring(0,12)}… not in imageHashMap — ` +
          `keeping original hash (transfer failed); Meta may reject with 2446603 if not shared`
        );
      }
    }

    // link_data
    if (spec.link_data?.image_hash) {
      const src = spec.link_data.image_hash;
      const tgt = this.imageHashMap[src];
      if (tgt) {
        spec.link_data.image_hash = tgt;
        delete spec.link_data.image_url;
        delete spec.link_data.picture;
        this.logger.asset(`link_data.image_hash: ${src.substring(0,12)}… → ${tgt.substring(0,12)}…`);
      } else {
        delete spec.link_data.image_url;
        delete spec.link_data.picture;
        this.logger.warn(
          `link_data.image_hash=${src.substring(0,12)}… not in imageHashMap — ` +
          `keeping original hash; Meta may reject with 2446603 if not shared`
        );
      }
    }

    // video_data
    if (spec.video_data?.video_id) {
      const srcId = spec.video_data.video_id;
      const tgtId = this.videoIdMap[srcId];
      if (tgtId) {
        spec.video_data.video_id = tgtId;
        delete spec.video_data.video_url;
        this.logger.asset(`video_data.video_id: ${srcId} → ${tgtId}`);
      } else {
        this.logger.warn(
          `video_data.video_id=${srcId} not in videoIdMap — ` +
          `keeping original id; Meta will likely reject this creative`
        );
      }
      if (spec.video_data.image_hash) {
        const src = spec.video_data.image_hash;
        const tgt = this.imageHashMap[src];
        if (tgt) {
          spec.video_data.image_hash = tgt;
          delete spec.video_data.image_url;
          this.logger.asset(`video thumbnail: ${src.substring(0,12)}… → ${tgt.substring(0,12)}…`);
        } else {
          delete spec.video_data.image_url;
          this.logger.warn(`video thumbnail hash=${src.substring(0,12)}… not in imageHashMap — keeping original`);
        }
      }
    }

    // carousel children
    for (let i = 0; i < (spec.link_data?.child_attachments || []).length; i++) {
      const child = spec.link_data.child_attachments[i];
      if (child.image_hash) {
        const src = child.image_hash;
        const tgt = this.imageHashMap[src];
        if (tgt) {
          child.image_hash = tgt;
          delete child.image_url;
          delete child.picture;
          this.logger.asset(`carousel[${i}]: ${src.substring(0,12)}… → ${tgt.substring(0,12)}…`);
        } else {
          delete child.image_url;
          delete child.picture;
          this.logger.warn(`carousel[${i}].image_hash=${src.substring(0,12)}… not in imageHashMap — keeping original`);
        }
      }
    }
  }

  _fallbackCreative(original, base) {
    return {
      ...base,
      title:               original.title               || "Learn More",
      body:                original.body                || "Check this out!",
      link_url:            original.link_url            || "https://example.com",
      call_to_action_type: original.call_to_action_type || "LEARN_MORE",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

async function persistCampaign(logger, { metaCampaignId, name, objective, targetAccount, userId }) {
  try {
    const now    = new Date();
    const record = await prisma.metaCampaign.create({
      data: {
        id: metaCampaignId, userId, accountId: targetAccount.id, name, objective,
        status: "PAUSED", effectiveStatus: "CAMPAIGN_PAUSED",
        createdTime: now, updatedTime: now, specialAdCategories: [],
      },
    });
    logger.db(`Campaign saved — id: ${record.id}`);
    return record;
  } catch (err) { logger.error("DB: Failed to save campaign (non-fatal)", err, { metaCampaignId }); return null; }
}

async function persistAdSet(logger, { metaAdSetId, name, metaCampaignId, targetAccount, dailyBudget, lifetimeBudget }) {
  try {
    const now  = new Date();
    const data = {
      id: metaAdSetId, accountId: targetAccount.id, name,
      status: "PAUSED", effectiveStatus: "ADSET_PAUSED",
      createdTime: now, updatedTime: now,
    };
    if (metaCampaignId) data.campaignId     = metaCampaignId;
    if (dailyBudget)    data.dailyBudget    = String(dailyBudget);
    if (lifetimeBudget) data.lifetimeBudget = String(lifetimeBudget);
    const record = await prisma.metaAdSet.create({ data });
    logger.db(`AdSet saved — id: ${record.id}`);
    return record;
  } catch (err) { logger.error("DB: Failed to save ad set (non-fatal)", err, { metaAdSetId }); return null; }
}

async function persistAd(logger, { metaAdId, name, metaAdSetId, metaCampaignId, creativeData, targetAccount }) {
  try {
    const now  = new Date();
    const data = {
      id: metaAdId, accountId: targetAccount.id, name,
      status: "PAUSED", effectiveStatus: "PAUSED",
      createdTime: now, updatedTime: now,
      creative: creativeData || null,
    };
    if (metaAdSetId)    data.adSetId    = metaAdSetId;
    if (metaCampaignId) data.campaignId = metaCampaignId;
    const record = await prisma.metaAd.create({ data });
    logger.db(`Ad saved — id: ${record.id}`);
    return record;
  } catch (err) { logger.error("DB: Failed to save ad (non-fatal)", err, { metaAdId }); return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP HELPER
// ─────────────────────────────────────────────────────────────────────────────

async function bestEffortCleanup(logger, { campaignId, adSetIds }, accessToken) {
  if (!campaignId) return;
  logger.warn("Attempting cleanup of orphaned Meta objects…", { campaignId, adSetIds });
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  for (const id of (adSetIds || [])) {
    try {
      await fetch(`https://graph.facebook.com/${META_API_VERSION}/${id}`, { method: "DELETE", headers });
      logger.info(`Cleanup: deleted adset ${id}`);
    } catch (e) { logger.warn(`Cleanup: failed to delete adset ${id}`, { error: e.message }); }
  }
  try {
    await fetch(`https://graph.facebook.com/${META_API_VERSION}/${campaignId}`, { method: "DELETE", headers });
    logger.info(`Cleanup: deleted campaign ${campaignId}`);
  } catch (err) { logger.error("Cleanup: failed to delete campaign", err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// META ERROR CLASSIFIER  (v7.0 — FIX-20: added subcode 2446603)
// ─────────────────────────────────────────────────────────────────────────────

const META_KNOWN_ERRORS = {
  1359188: { name: "NO_PAYMENT_METHOD",  httpStatus: 402, userMessage: "The target ad account has no valid payment method." },
  1487934: { name: "INVALID_IG_ACTOR",   httpStatus: 400, userMessage: "The Instagram actor ID is not valid for this ad account." },
  2490361: { name: "INVALID_IMAGE",      httpStatus: 400, userMessage: "Meta could not process the image. The CDN URL could not be downloaded or validated." },
  2446603: { name: "INVALID_IMAGE_HASH", httpStatus: 400, userMessage: "The image could not be loaded in the target ad account. The image hash was not transferred successfully — check asset transfer logs." },
  33:      { name: "ACCOUNT_NOT_FOUND",  httpStatus: 404, userMessage: "The ad account ID does not exist or you do not have permission." },
};

function classifyMetaError(err) {
  const subcode = err?.response?.error_subcode ?? err?.response?.error?.error_subcode ?? err?.body?.error?.error_subcode ?? err?.error_subcode;
  const code    = err?.response?.code ?? err?.response?.error?.code ?? err?.body?.error?.code ?? err?.code;
  return META_KNOWN_ERRORS[subcode] || META_KNOWN_ERRORS[code] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function validateBody(body, isSameAccount, logger) {
  const errors = [];
  if (!body.sourceAccountId) errors.push("sourceAccountId required");
  if (!body.targetAccountId) errors.push("targetAccountId required");
  if (!body.campaignId)      errors.push("campaignId required");
  if (!isSameAccount && !body.targetPageId) errors.push("targetPageId required for cross-account");
  if (errors.length > 0) { logger.error("Validation failed", null, { errors }); return { valid: false, errors }; }
  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
//
// FIX-21: Wrapped with withAuth so ctx.adAccountAccess resolves admin /
// owner / team-member access automatically. Removed manual getServerSession
// check and direct userId ownership comparison.
// ─────────────────────────────────────────────────────────────────────────────

export const POST = withAuth(async (request, routeContext, ctx) => {
  const requestId = `dup_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const logger    = new Logger(requestId);
  const rl        = new RateLimitHandler(logger);

  const createdMetaIds = { campaignId: null, adSetIds: [], targetAccessToken: null };

  logger.start(`Campaign Duplication v7.0 — requestId: ${requestId}`);

  try {

    // ────────────────────────────────────────────────────────────────────────
    // STEP: AUTHENTICATION  (handled by withAuth — ctx.userId is guaranteed)
    // ────────────────────────────────────────────────────────────────────────
    logger.step("AUTHENTICATION");
    logger.outcomes.auth = true;
    logger.success(`Authenticated — userId: ${ctx.userId}`, {
      isAdmin: ctx.adAccountAccess.isAdmin,
      role:    ctx.session.user?.role ?? "user",
    });

    // ────────────────────────────────────────────────────────────────────────
    logger.step("PARSE + VALIDATE REQUEST");
    let body;
    try { body = await request.json(); }
    catch (e) { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const isSameAccount = body.sourceAccountId === body.targetAccountId;

    logger.info("Request body parsed", {
      sourceAccountId:         body.sourceAccountId,
      targetAccountId:         body.targetAccountId,
      campaignId:              body.campaignId,
      isSameAccount,
      hasTargetPageId:         !!body.targetPageId,
      hasTargetInstagramActor: !!body.targetInstagramActorId,
      note: "v7.0: image hashes resolved via /adimages?hashes=[...] (FIX-17)",
    });

    const validation = validateBody(body, isSameAccount, logger);
    if (!validation.valid) return NextResponse.json({ error: "Validation failed", details: validation.errors }, { status: 400 });
    logger.success(`Mode: ${isSameAccount ? "SAME-ACCOUNT" : "CROSS-ACCOUNT"} duplication`);

    // ────────────────────────────────────────────────────────────────────────
    // STEP: LOAD AD ACCOUNTS FROM DB
    //
    // FIX-21: Access check now uses ctx.adAccountAccess.canAccess() which
    // correctly handles admin (all accounts), owner (their accounts), and
    // team member (shared accounts) — instead of the old hard userId ownership
    // check (sourceAccount.userId !== session.user.id) that broke for admins
    // and team members.
    // ────────────────────────────────────────────────────────────────────────
    logger.step("LOAD AD ACCOUNTS FROM DB");
    const t0 = Date.now();
    const [sourceAccount, targetAccount] = await Promise.all([
      prisma.metaAdAccount.findUnique({
        where:  { id: body.sourceAccountId },
        select: { id: true, metaAccountId: true, accessToken: true, name: true, userId: true },
      }),
      prisma.metaAdAccount.findUnique({
        where:  { id: body.targetAccountId },
        select: { id: true, metaAccountId: true, accessToken: true, name: true, userId: true },
      }),
    ]);
    logger.perf("DB accounts loaded", t0);

    // ── FIX-21: canAccess() honours admin / owner / team-member ──────────────
    if (!sourceAccount || !ctx.adAccountAccess.canAccess(body.sourceAccountId)) {
      logger.outcomes.dbAccounts = false;
      logger.warn("Source account access denied", {
        userId:          ctx.userId,
        sourceAccountId: body.sourceAccountId,
        isAdmin:         ctx.adAccountAccess.isAdmin,
        accessibleIds:   ctx.adAccountAccess.allIds,
      });
      return NextResponse.json({ error: "Source ad account not found or not accessible" }, { status: 404 });
    }
    if (!targetAccount || !ctx.adAccountAccess.canAccess(body.targetAccountId)) {
      logger.outcomes.dbAccounts = false;
      logger.warn("Target account access denied", {
        userId:          ctx.userId,
        targetAccountId: body.targetAccountId,
        isAdmin:         ctx.adAccountAccess.isAdmin,
        accessibleIds:   ctx.adAccountAccess.allIds,
      });
      return NextResponse.json({ error: "Target ad account not found or not accessible" }, { status: 404 });
    }

    logger.outcomes.dbAccounts       = true;
    createdMetaIds.targetAccessToken = targetAccount.accessToken;
    logger.success(`Accounts: "${sourceAccount.name}" → "${targetAccount.name}"`, {
      sourceMetaId: sourceAccount.metaAccountId,
      targetMetaId: targetAccount.metaAccountId,
      accessType: {
        source: ctx.adAccountAccess.getAccount(body.sourceAccountId)?.accessType ?? "admin",
        target: ctx.adAccountAccess.getAccount(body.targetAccountId)?.accessType ?? "admin",
      },
    });

    // ────────────────────────────────────────────────────────────────────────
    logger.step("FETCH SOURCE CAMPAIGN");
    // ⚠️  ALL source-account API calls BEFORE FacebookAdsApi.init(targetAccount)
    FacebookAdsApi.init(sourceAccount.accessToken);
    const srcCampaign = new Campaign(body.campaignId);
    let campaignData;
    try {
      campaignData = await rl.executeWithRetry(
        () => srcCampaign.get([
          "name","objective","status","special_ad_categories",
          "buying_type","daily_budget","lifetime_budget",
          "start_time","stop_time","bid_strategy",
        ]),
        "Fetch source campaign"
      );
    } catch (err) {
      logger.outcomes.campaignFetch = false;
      logger.error("Failed to fetch source campaign", err);
      return NextResponse.json({ error: "Source campaign not found or inaccessible" }, { status: 404 });
    }
    const cf = campaignData.exportAllData();
    logger.outcomes.campaignFetch = true;
    logger.success("Source campaign loaded", { name: cf.name, objective: cf.objective, status: cf.status, buying_type: cf.buying_type });

    // ────────────────────────────────────────────────────────────────────────
    logger.step("FETCH AD SETS");
    const adSets = await rl.executeWithRetry(
      () => srcCampaign.getAdSets([
        "name","status","daily_budget","lifetime_budget","bid_strategy","bid_amount",
        "billing_event","optimization_goal","targeting","start_time","end_time",
        "promoted_object","attribution_spec",
      ]),
      "Fetch ad sets"
    );
    if (adSets.length === 0) {
      logger.outcomes.adSetsFetch = false;
      return NextResponse.json({ error: "Campaign has no ad sets" }, { status: 400 });
    }
    logger.outcomes.adSetsFetch = true;
    logger.success(`${adSets.length} ad set(s) found`);
    adSets.forEach((as, i) => {
      const d = as.exportAllData();
      logger.info(`  Ad set [${i+1}]: "${d.name}"`, {
        billing_event: d.billing_event, optimization_goal: d.optimization_goal, daily_budget: d.daily_budget,
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    logger.step("FETCH ADS + CREATIVES  (source account token — DO NOT switch token yet)");
    const adsWithCreatives  = [];
    let failedCreativeLoads = 0;

    for (const adSet of adSets) {
      const ads = await rl.executeWithRetry(
        () => adSet.getAds(["name","status","creative{id}"]),
        `Fetch ads for adSet ${adSet.id}`
      );
      logger.info(`  AdSet ${adSet.id} → ${ads.length} ad(s)`);

      for (const ad of ads) {
        const adData     = ad.exportAllData();
        const creativeId = adData.creative?.id;
        if (!creativeId) { logger.warn(`  Ad "${adData.name}" has no creative — skipping`); continue; }

        try {
          const creative = await rl.executeWithRetry(
            () => new AdCreative(creativeId).get([
              "name","title","body","link_url","call_to_action_type",
              "object_story_spec",
              "image_hash",
              "image_url",
              "asset_feed_spec",
              "degrees_of_freedom_spec",
              "video_id",
            ]),
            `Fetch creative ${creativeId}`
          );
          const cData = creative.exportAllData();
          adsWithCreatives.push({
            adName: adData.name, adStatus: adData.status,
            creative: cData, creativeId, originalAdSetId: adSet.id,
          });
          logger.debug(`  ✓ Creative loaded for "${adData.name}"`, {
            creativeId,
            hasObjectStorySpec: !!cData.object_story_spec,
            mediaTypes: [
              cData.object_story_spec?.video_data ? "video" : null,
              cData.object_story_spec?.link_data  ? "link"  : null,
              cData.object_story_spec?.photo_data ? "photo" : null,
            ].filter(Boolean),
            topLevelImageHash: cData.image_hash ? cData.image_hash.substring(0, 12) + "…" : null,
            topLevelVideoId:   cData.video_id || null,
          });
        } catch (err) {
          failedCreativeLoads++;
          logger.error(`  Failed to load creative ${creativeId} for "${adData.name}"`, err);
          adsWithCreatives.push({
            adName: adData.name, adStatus: adData.status,
            creative: { title: "Fallback", body: "Fallback", link_url: "https://example.com" },
            creativeId: null, originalAdSetId: adSet.id,
          });
        }
      }
    }

    if (adsWithCreatives.length === 0) {
      logger.outcomes.creativesFetch = false;
      return NextResponse.json({ error: "No ads found" }, { status: 400 });
    }
    logger.outcomes.creativesFetch = failedCreativeLoads === 0;
    logger.success(`Total ads prepared: ${adsWithCreatives.length}`, { failedCreativeLoads });

    // ────────────────────────────────────────────────────────────────────────
    // v7.0: INLINE ASSET URL RESOLUTION
    // Still on SOURCE account token — must happen before init(target)
    // FIX-17 + FIX-18: uses /adimages?hashes=[...] + passes sourceMetaAccountId
    // ────────────────────────────────────────────────────────────────────────
    logger.step("INLINE ASSET URL RESOLUTION  (source account — before token switch)");

    let resolvedHashToUrl    = {};
    let resolvedVideoIdToUrl = {};
    let resolutionStats      = {};

    if (!isSameAccount) {
      const resolver = new InlineAssetResolver(
        logger,
        rl,
        sourceAccount.accessToken,
        sourceAccount.metaAccountId
      );
      const result = await resolver.resolveAll(adsWithCreatives);

      resolvedHashToUrl    = result.hashToUrl;
      resolvedVideoIdToUrl = result.videoIdToUrl;
      resolutionStats      = result.stats;
      logger.outcomes.assetResolution = result.allOk;

      logger.info("Inline resolution summary", {
        resolvedImages: Object.keys(resolvedHashToUrl).length,
        resolvedVideos: Object.keys(resolvedVideoIdToUrl).length,
        stats: resolutionStats,
      });

      if (!result.allOk) {
        logger.warn(
          "⚠️  Some assets could not be resolved. Duplication will continue but affected " +
          "creatives may fail at Meta.\n" +
          "   Possible causes:\n" +
          "     • The source access token lacks ads_read permission on the image library\n" +
          "     • The image was uploaded to a different ad account not shared with this token\n" +
          "     • The video is not in READY status\n" +
          "     • The CDN URL returned is geo-blocked from this server"
        );
      }
    } else {
      logger.outcomes.assetResolution = "skipped";
      logger.info("Same-account — inline asset resolution skipped");
    }

    // ────────────────────────────────────────────────────────────────────────
    // NOW safe to switch to target account token
    // ────────────────────────────────────────────────────────────────────────
    logger.info("🔑 Switching FacebookAdsApi token → target account");
    FacebookAdsApi.init(targetAccount.accessToken);
    const targetAdAccount = new AdAccount(targetAccount.metaAccountId);

    // ────────────────────────────────────────────────────────────────────────
    logger.step("AUTO ASSET TRANSFER (cross-account only)");

    let imageHashMap = {};
    let videoIdMap   = {};
    let assetStats   = {};

    if (!isSameAccount) {
      const assetManager = new AssetTransferManager(logger, rl, sourceAccount, targetAccount);
      assetManager.loadResolvedMaps(resolvedHashToUrl, resolvedVideoIdToUrl);

      const result  = await assetManager.transferAllAssets(adsWithCreatives);
      imageHashMap  = result.imageHashMap;
      videoIdMap    = result.videoIdMap;
      assetStats    = result.stats;
      logger.outcomes.assetTransfer = result.allOk;

      logger.info("Final asset maps", {
        imageHashMap: Object.entries(imageHashMap).map(([k, v]) => `${k.substring(0,10)}…→${v.substring(0,10)}…`),
        videoIdMap:   Object.entries(videoIdMap).map(([k, v]) => `${k}→${v}`),
      });
    } else {
      logger.outcomes.assetTransfer = "skipped";
      logger.info("Same-account — no asset transfer needed");
    }

    // ────────────────────────────────────────────────────────────────────────
    logger.step("INSTAGRAM ACTOR VALIDATION");
    let validatedInstagramActorId = null;
    const instagramWarnings       = [];

    if (body.targetInstagramActorId && !isSameAccount) {
      const igValidator = new InstagramValidator(logger, rl);
      const result      = await igValidator.validate(targetAdAccount, body.targetInstagramActorId, body.targetPageId);
      if (result.valid) {
        validatedInstagramActorId    = result.instagramActorId;
        logger.outcomes.igValidation = true;
        logger.success(`Instagram actor validated — source: ${result.source}`);
      } else {
        logger.outcomes.igValidation = false;
        logger.warn("Instagram validation FAILED — proceeding Facebook-only", { reason: result.message });
        instagramWarnings.push({ type: "instagram_validation_failed", message: result.message, impact: "Facebook-only" });
      }
    } else if (isSameAccount && body.targetInstagramActorId) {
      validatedInstagramActorId    = body.targetInstagramActorId;
      logger.outcomes.igValidation = "skipped";
    } else {
      logger.outcomes.igValidation = "skipped";
      logger.instagram("No IG actor provided — Facebook-only");
    }

    // ────────────────────────────────────────────────────────────────────────
    logger.step("CREATE NEW CAMPAIGN");
    const mappedObjective = mapObjective(cf.objective, logger);
    const campaignName    = `[DUPLICATE ${new Date().toISOString().slice(0, 10)}] ${cf.name}`;
    const rawSac          = cf.special_ad_categories || [];
    const sanitizedSac    = rawSac
      .map((i) => (typeof i === "object" && i !== null ? i.category : i))
      .filter((s) => typeof s === "string" && s !== "NONE" && s !== "");

    const campaignParams = {
      name:                            campaignName,
      objective:                       mappedObjective,
      status:                          "PAUSED",
      special_ad_categories:           sanitizedSac,
      buying_type:                     cf.buying_type || "AUCTION",
      is_adset_budget_sharing_enabled: false,
    };
    const cboDailyVal    = parseInt(cf.daily_budget,    10) || 0;
    const cboLifetimeVal = parseInt(cf.lifetime_budget, 10) || 0;
    if      (cboDailyVal > 0 && cboLifetimeVal > 0) { campaignParams.daily_budget = String(cboDailyVal); logger.warn("Both CBO budgets set — keeping daily_budget"); }
    else if (cboDailyVal > 0)    { campaignParams.daily_budget    = String(cboDailyVal);    logger.info(`CBO daily budget: ${cboDailyVal}`); }
    else if (cboLifetimeVal > 0) { campaignParams.lifetime_budget = String(cboLifetimeVal); logger.info(`CBO lifetime budget: ${cboLifetimeVal}`); }
    else                         { logger.info("ABO mode — no campaign-level budget"); }

    logger.meta("Creating campaign", campaignParams);
    let newCampaign;
    try {
      newCampaign = await rl.executeWithRetry(
        () => targetAdAccount.createCampaign([], campaignParams),
        "Create campaign"
      );
    } catch (err) {
      logger.outcomes.campaignCreate = false;
      const known = classifyMetaError(err);
      logger.metaError("createCampaign", campaignParams, err);
      if (known) return NextResponse.json({ error: known.name, message: known.userMessage, requestId }, { status: known.httpStatus });
      throw err;
    }
    createdMetaIds.campaignId      = newCampaign.id;
    logger.outcomes.campaignCreate = true;
    logger.success(`Campaign created — Meta ID: ${newCampaign.id}`, { name: campaignName });

    // FIX-21: use ctx.userId instead of session.user.id
    const campaignRecord       = await persistCampaign(logger, { metaCampaignId: newCampaign.id, name: campaignName, objective: mappedObjective, targetAccount, userId: ctx.userId });
    logger.outcomes.campaignDB = !!campaignRecord;

    // ────────────────────────────────────────────────────────────────────────
    logger.step("CREATE AD SETS");
    const adSetIdMap  = {};
    const newAdSetIds = [];

    for (let i = 0; i < adSets.length; i++) {
      const adSet = adSets[i];
      const asd   = adSet.exportAllData();
      const label = `AdSet ${i+1}/${adSets.length}: "${asd.name}"`;
      logger.divider(label);

      const safeBudget         = buildSafeBudgetFields(asd, logger);
      const safeBid            = buildSafeBidFields(asd, logger);
      const safePromotedObject = buildSafePromotedObject(asd.promoted_object, body.targetPageId, isSameAccount, logger);

      const adSetParams = {
        name:              `[DUPLICATE] ${asd.name}`,
        campaign_id:       newCampaign.id,
        status:            "PAUSED",
        billing_event:     asd.billing_event,
        optimization_goal: asd.optimization_goal,
        targeting:         asd.targeting,
        ...safeBudget,
        ...safeBid,
        ...(safePromotedObject && { promoted_object: safePromotedObject }),
        ...(asd.attribution_spec && mappedObjective === cf.objective && { attribution_spec: asd.attribution_spec }),
      };

      logger.meta(`Creating ${label}`, adSetParams);
      const adSetOutcome = { name: asd.name, metaOk: false, dbOk: false, metaId: null, error: null };
      logger.outcomes.adSetsCreate.push(adSetOutcome);

      try {
        const newAdSet = await rl.executeWithRetry(
          () => targetAdAccount.createAdSet([], adSetParams),
          `Create ad set ${i+1}`
        );
        createdMetaIds.adSetIds.push(newAdSet.id);
        adSetIdMap[adSet.id] = newAdSet.id;
        newAdSetIds.push(newAdSet.id);
        adSetOutcome.metaOk = true;
        adSetOutcome.metaId = newAdSet.id;
        logger.success(`${label} created — Meta ID: ${newAdSet.id}`);

        const asRecord = await persistAdSet(logger, {
          metaAdSetId:    newAdSet.id,
          name:           `[DUPLICATE] ${asd.name}`,
          metaCampaignId: newCampaign.id,
          targetAccount,
          dailyBudget:    safeBudget.daily_budget    || null,
          lifetimeBudget: safeBudget.lifetime_budget || null,
        });
        adSetOutcome.dbOk = !!asRecord;
      } catch (err) {
        adSetOutcome.error = err.message;
        const known = classifyMetaError(err);
        logger.metaError(`createAdSet — ${label}`, adSetParams, err);
        await bestEffortCleanup(logger, createdMetaIds, targetAccount.accessToken);
        if (known) return NextResponse.json({ error: known.name, message: known.userMessage, requestId }, { status: known.httpStatus });
        throw new Error(`Ad set creation failed for "${asd.name}": ${err.message}`);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    logger.step("CREATE CREATIVES + ADS");
    logger.info(`Placement strategy: ${validatedInstagramActorId ? "Facebook + Instagram" : "Facebook ONLY"}`, {
      instagramActorId: validatedInstagramActorId || "N/A",
    });

    const creativeProcessor = new CreativeProcessor(
      logger, isSameAccount, body.targetPageId, validatedInstagramActorId, imageHashMap, videoIdMap
    );
    let adsCreated  = 0;
    let adsFailed   = 0;
    const failedAds = [];

    for (let i = 0; i < adsWithCreatives.length; i++) {
      const item  = adsWithCreatives[i];
      const label = `Ad ${i+1}/${adsWithCreatives.length}: "${item.adName}"`;
      logger.divider(label);

      const targetAdSetId = adSetIdMap[item.originalAdSetId];
      if (!targetAdSetId) {
        logger.warn(`${label} — parent ad set failed, skipping`);
        adsFailed++;
        failedAds.push({ name: item.adName, error: "Parent ad set failed" });
        continue;
      }

      const adOutcome = { name: item.adName, metaOk: false, dbOk: false, metaId: null, placement: null, error: null };
      logger.outcomes.adsCreate.push(adOutcome);

      try {
        logger.debug(`${label} — source creative`, {
          creativeId:          item.creativeId,
          hasObjectStorySpec:  !!item.creative?.object_story_spec,
          objectStorySpecKeys: item.creative?.object_story_spec ? Object.keys(item.creative.object_story_spec) : [],
          hasVideoData:        !!item.creative?.object_story_spec?.video_data,
          hasLinkData:         !!item.creative?.object_story_spec?.link_data,
          hasPhotoData:        !!item.creative?.object_story_spec?.photo_data,
        });

        let creativeSpec;
        try {
          creativeSpec = creativeProcessor.processCreativeSpec(item.creative, item.adName);
          logger.debug(`${label} — creative spec ready`, {
            hasObjectStorySpec: !!creativeSpec.object_story_spec,
            hasInstagramActor:  !!creativeSpec.object_story_spec?.instagram_actor_id,
          });
          logger.meta(`${label} — creativeSpec being sent to Meta`, creativeSpec);
        } catch (specErr) { throw specErr; }

        let newCreative;
        let finalPlacement = creativeSpec.object_story_spec?.instagram_actor_id ? "fb+ig" : "fb";

        try {
          logger.meta(`${label} — creating creative`);
          newCreative = await rl.executeWithRetry(
            () => targetAdAccount.createAdCreative([], creativeSpec),
            `Create creative for "${item.adName}"`
          );
          logger.success(`${label} — creative created: ${newCreative.id}`);
        } catch (creativeErr) {
          const knownCreativeErr = classifyMetaError(creativeErr);
          const isIgError        = creativeErr?.message?.includes("instagram_actor_id") ||
                                   (creativeErr?.response?.error_subcode === 1487934);

          if (isIgError && creativeSpec.object_story_spec?.instagram_actor_id) {
            logger.warn(`${label} — Meta rejected instagram_actor_id — retrying without IG`, {
              originalError: creativeErr.message,
            });
            delete creativeSpec.object_story_spec.instagram_actor_id;
            delete creativeSpec.object_story_spec.instagram_user_id;
            finalPlacement = "fb";
            instagramWarnings.push({
              type:    "instagram_creative_rejected",
              message: `"${item.adName}": IG removed after rejection`,
              impact:  "Facebook-only",
            });
            newCreative = await rl.executeWithRetry(
              () => targetAdAccount.createAdCreative([], creativeSpec),
              `Create creative "${item.adName}" (FB-only retry)`
            );
            logger.success(`${label} — creative created (FB-only): ${newCreative.id}`);
          } else {
            logger.metaError(`createAdCreative — ${label}`, creativeSpec, creativeErr);
            if (knownCreativeErr) {
              return NextResponse.json({
                error:   knownCreativeErr.name,
                message: knownCreativeErr.userMessage,
                requestId,
                createdMetaObjects: {
                  note:       "May need manual deletion",
                  campaignId: createdMetaIds.campaignId,
                  adSetIds:   createdMetaIds.adSetIds,
                },
              }, { status: knownCreativeErr.httpStatus });
            }
            throw creativeErr;
          }
        }

        const adParams = {
          name:      `[DUPLICATE] ${item.adName}`,
          adset_id:  targetAdSetId,
          status:    "PAUSED",
          creative:  { creative_id: newCreative.id },
        };
        logger.meta(`${label} — creating ad`, adParams);

        let newAd;
        try {
          newAd = await rl.executeWithRetry(
            () => targetAdAccount.createAd([], adParams),
            `Create ad "${item.adName}"`
          );
        } catch (adErr) {
          const known = classifyMetaError(adErr);
          logger.metaError(`createAd — ${label}`, adParams, adErr);
          if (known) return NextResponse.json({
            error:   known.name,
            message: known.userMessage,
            requestId,
            createdMetaObjects: {
              note:       "May need manual deletion",
              campaignId: createdMetaIds.campaignId,
              adSetIds:   createdMetaIds.adSetIds,
            },
          }, { status: known.httpStatus });
          throw adErr;
        }

        adsCreated++;
        adOutcome.metaOk    = true;
        adOutcome.metaId    = newAd.id;
        adOutcome.placement = finalPlacement;
        logger.success(`✅ ${label} DONE`, { adId: newAd.id, adSetId: targetAdSetId, placement: finalPlacement });

        const adRecord = await persistAd(logger, {
          metaAdId:       newAd.id,
          name:           `[DUPLICATE] ${item.adName}`,
          metaAdSetId:    targetAdSetId,
          metaCampaignId: newCampaign.id,
          creativeData:   { creative_id: newCreative.id, spec: creativeSpec },
          targetAccount,
        });
        adOutcome.dbOk = !!adRecord;

      } catch (err) {
        adsFailed++;
        adOutcome.error = err.message;
        failedAds.push({ name: item.adName, error: err.message });
        logger.error(`❌ ${label} FAILED`, err, { adSetId: targetAdSetId });
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    logger.step("FINAL SUMMARY");
    const totalMs = Date.now() - logger.startTime;
    logger.printFinalSummary(totalMs);

    return NextResponse.json({
      success: true,
      requestId,
      message: isSameAccount
        ? "Campaign duplicated within same account"
        : "Campaign duplicated to new account with inline asset resolution + transfer",
      data: {
        duplicatedCampaignId: newCampaign.id,
        campaignName,
        adSetsCreated:  newAdSetIds.length,
        adsCreated,
        adsFailed,
        totalAds:       adsWithCreatives.length,
        processingTime: `${(totalMs / 1000).toFixed(2)}s`,
        placement: {
          type:             validatedInstagramActorId ? "facebook_and_instagram" : "facebook_only",
          instagramActorId: validatedInstagramActorId || null,
        },
        ...(isSameAccount ? {} : {
          assetResolution: {
            imagesResolved: resolutionStats.imagesResolved || 0,
            imagesFailed:   resolutionStats.imagesFailed   || 0,
            videosResolved: resolutionStats.videosResolved || 0,
            videosFailed:   resolutionStats.videosFailed   || 0,
          },
          assetTransfer: {
            imagesTransferred: assetStats.imagesTransferred || 0,
            imagesFailed:      assetStats.imagesFailed      || 0,
            videosTransferred: assetStats.videosTransferred || 0,
            videosFailed:      assetStats.videosFailed      || 0,
            imageHashMapSize:  Object.keys(imageHashMap).length,
            videoIdMapSize:    Object.keys(videoIdMap).length,
          },
        }),
      },
      ...(mappedObjective !== cf.objective && {
        objectiveMapping: { original: cf.objective, mapped: mappedObjective },
      }),
      ...((instagramWarnings.length > 0 || failedAds.length > 0) && {
        warnings: {
          ...(instagramWarnings.length > 0 && { instagram: instagramWarnings }),
          ...(failedAds.length > 0         && { failedAds }),
        },
      }),
    }, { status: 200 });

  } catch (err) {
    const totalMs = Date.now() - logger.startTime;
    logger.printFinalSummary(totalMs);
    logger.error("CRITICAL FAILURE — duplication aborted", err, {
      requestId,
      totalTime:          `${(totalMs / 1000).toFixed(2)}s`,
      createdMetaObjects: { campaignId: createdMetaIds.campaignId, adSetIds: createdMetaIds.adSetIds },
    });
    return NextResponse.json({
      error:   "Campaign duplication failed",
      message: err.message,
      requestId,
      createdMetaObjects: {
        note:       "May need manual deletion",
        campaignId: createdMetaIds.campaignId,
        adSetIds:   createdMetaIds.adSetIds,
      },
    }, { status: 500 });
  }
});