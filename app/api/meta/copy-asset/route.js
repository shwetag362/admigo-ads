// // ============================================================
// // app/api/meta/copy-asset/route.js
// // Copy images or videos from one Meta Ad Account to another
// //
// // KEY INSIGHT: Meta's advideos `source` field returns a DASH
// // fragmented MP4 (fMP4). These are valid video/mp4 content-type
// // but Meta's upload API rejects them because fMP4 containers
// // lack a self-contained `moov` atom at the head.
// //
// // Fix: pipe the downloaded buffer through ffmpeg to remux it
// // into a proper standalone MP4 (no re-encoding, just container
// // conversion — very fast even for large files).
// // ============================================================

// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";
// import { prisma } from "@/lib/prisma";
// import { spawn } from "child_process";
// import { tmpdir } from "os";
// import { join } from "path";
// import { writeFile, readFile, unlink } from "fs/promises";
// import { randomUUID } from "crypto";

// const API_VERSION = "v24.0";

// const log = {
//   start:   (msg, d = null) => console.log(`\n🔁 COPY-ASSET START → ${msg}`, d ? JSON.stringify(d, null, 2) : ""),
//   step:    (msg, d = null) => console.log(`📌 STEP → ${msg}`,    d ? JSON.stringify(d, null, 2) : ""),
//   info:    (msg, d = null) => console.log(`ℹ️  INFO → ${msg}`,    d ? JSON.stringify(d, null, 2) : ""),
//   success: (msg, d = null) => console.log(`✅ SUCCESS → ${msg}`, d ? JSON.stringify(d, null, 2) : ""),
//   warn:    (msg, d = null) => console.warn(`⚠️  WARN → ${msg}`,  d ? JSON.stringify(d, null, 2) : ""),
//   error:   (msg, err = null) => {
//     console.error(`\n❌ ERROR → ${msg}`);
//     if (err) {
//       console.error("   MESSAGE:", err?.message || err);
//       if (err?.response?.error) console.error("   META ERROR:", JSON.stringify(err.response.error, null, 2));
//       if (err?.stack) console.error("   STACK:", err.stack);
//     }
//     console.error("\n");
//   },
// };

// // ============================================================
// // HELPER: Fetch both ad account records and verify ownership
// // ============================================================
// async function resolveAccounts(sourceAccountId, targetAccountId, userId) {
//   const [source, target] = await Promise.all([
//     prisma.metaAdAccount.findUnique({
//       where: { id: sourceAccountId, userId },
//       select: { id: true, name: true, metaAccountId: true, accessToken: true },
//     }),
//     prisma.metaAdAccount.findUnique({
//       where: { id: targetAccountId, userId },
//       select: { id: true, name: true, metaAccountId: true, accessToken: true },
//     }),
//   ]);
//   return { source, target };
// }

// // ============================================================
// // HELPER: Normalize Meta account ID  →  "act_XXXXXXXXX"
// // ============================================================
// function normalizeMetaId(rawId) {
//   return `act_${rawId.toString().trim().replace(/^act_/, "")}`;
// }

// // ============================================================
// // HELPER: Check if ffmpeg is available on this system
// // ============================================================
// async function isFfmpegAvailable() {
//   return new Promise((resolve) => {
//     const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
//     proc.on("error", () => resolve(false));
//     proc.on("close", (code) => resolve(code === 0));
//   });
// }

// // ============================================================
// // HELPER: Remux a fragmented MP4 (fMP4/DASH) buffer into a
// // standalone MP4 using ffmpeg.
// //
// // Uses: ffmpeg -i input.mp4 -c copy -movflags faststart output.mp4
// //   -c copy      → no re-encoding, just container remux (fast)
// //   -movflags faststart → moves moov atom to front (required for upload)
// //
// // Returns a new Buffer containing the remuxed MP4.
// // ============================================================
// async function remuxToStandaloneMP4(inputBuffer) {
//   const id = randomUUID();
//   const inputPath  = join(tmpdir(), `admigo_in_${id}.mp4`);
//   const outputPath = join(tmpdir(), `admigo_out_${id}.mp4`);

//   try {
//     // Write input buffer to temp file
//     await writeFile(inputPath, inputBuffer);

//     log.step(`ffmpeg remux: ${(inputBuffer.length / 1024 / 1024).toFixed(2)} MB → standalone MP4`);

//     // Run ffmpeg
//     await new Promise((resolve, reject) => {
//       const args = [
//         "-y",                    // overwrite output if exists
//         "-i", inputPath,         // input file
//         "-c", "copy",            // copy streams, no re-encode
//         "-movflags", "faststart", // moov atom at front — required for upload
//         "-f", "mp4",             // force mp4 container
//         outputPath,              // output file
//       ];

//       const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });

//       let stderr = "";
//       proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

//       proc.on("error", (err) => {
//         reject(new Error(`ffmpeg spawn error: ${err.message}`));
//       });

//       proc.on("close", (code) => {
//         if (code === 0) {
//           resolve();
//         } else {
//           // Include last 500 chars of stderr for diagnosis
//           const tail = stderr.slice(-500);
//           reject(new Error(`ffmpeg exited with code ${code}. stderr: ${tail}`));
//         }
//       });
//     });

//     // Read remuxed output
//     const outputBuffer = await readFile(outputPath);
//     log.success(`ffmpeg remux complete: ${(outputBuffer.length / 1024 / 1024).toFixed(2)} MB`);
//     return outputBuffer;

//   } finally {
//     // Clean up temp files — don't throw if already gone
//     await unlink(inputPath).catch(() => {});
//     await unlink(outputPath).catch(() => {});
//   }
// }

// // ============================================================
// // HELPER: Download asset bytes from a URL
// // ============================================================
// async function downloadAsset(url, accessToken = null) {
//   const headers = {};
//   if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

//   const response = await fetch(url, { headers });

//   if (!response.ok) {
//     throw new Error(`Failed to download asset: HTTP ${response.status} from ${url}`);
//   }

//   const contentType = response.headers.get("content-type") || "";
//   const arrayBuffer = await response.arrayBuffer();
//   const buffer = Buffer.from(arrayBuffer);

//   return { buffer, contentType };
// }

// // ============================================================
// // HELPER: Detect fragmented/DASH MP4 by checking the buffer
// // for the 'ftyp' + 'moof' box structure.
// // A proper standalone MP4 has 'moov' before any 'mdat'.
// // An fMP4 has 'moof' boxes and/or 'moov' after 'mdat'.
// // ============================================================
// function isFragmentedMP4(buffer) {
//   // Scan first 512 bytes for box type markers
//   const head = buffer.slice(0, Math.min(buffer.length, 1024));
//   const str = head.toString("binary");

//   const hasMoof = str.includes("moof");
//   const hasMoov = str.includes("moov");
//   const hasMdat = str.includes("mdat");

//   // fMP4: has moof segments, or moov comes after mdat
//   if (hasMoof) return true;

//   // Check moov position vs mdat position
//   const moovPos = str.indexOf("moov");
//   const mdatPos = str.indexOf("mdat");

//   if (hasMoov && hasMdat && moovPos > mdatPos) return true;

//   // If moov not found in first 1024 bytes but mdat is — likely fMP4
//   if (!hasMoov && hasMdat) return true;

//   return false;
// }

// // ============================================================
// // HELPER: Derive a safe filename from URL + content-type
// // ============================================================
// function deriveFilename(url, contentType) {
//   try {
//     const pathname = new URL(url).pathname;
//     const base = pathname.split("/").pop() || "asset";
//     const clean = base.split("?")[0];
//     if (clean && clean.includes(".")) return clean;
//   } catch (_) { /* ignore */ }

//   const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
//   return `asset_${Date.now()}.${ext}`;
// }

// // ============================================================
// // HELPER: Validate image MIME type
// // ============================================================
// function isValidImageType(ct) {
//   return ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
//     .some(t => ct.startsWith(t));
// }

// // ============================================================
// // HELPER: Validate video MIME type
// // ============================================================
// function isValidVideoType(ct) {
//   return ["video/mp4", "video/quicktime", "video/mov", "video/avi", "video/mpeg"]
//     .some(t => ct.startsWith(t));
// }

// // ============================================================
// // HELPER: Build multipart/form-data body safely with
// // Buffer.concat — zero string-to-binary conversion.
// // ============================================================
// function buildMultipartBody(fields = [], file = null) {
//   const boundary =
//     "----FormBoundary" + Date.now().toString(16) + Math.random().toString(16).slice(2);
//   const parts = [];

//   for (const { name, value } of fields) {
//     parts.push(
//       Buffer.from(
//         `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
//         "utf8"
//       )
//     );
//   }

//   if (file) {
//     const header =
//       `--${boundary}\r\n` +
//       `Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n` +
//       `Content-Type: ${file.mime}\r\n\r\n`;

//     parts.push(Buffer.from(header, "utf8"));
//     parts.push(file.buffer);
//     parts.push(Buffer.from("\r\n", "utf8"));
//   }

//   parts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));

//   const body = Buffer.concat(parts);
//   return { body, contentType: `multipart/form-data; boundary=${boundary}` };
// }

// // ============================================================
// // CORE: Upload image buffer → target Meta Ad Account
// // Returns { image_hash }
// // ============================================================
// async function uploadImageToAccount(buffer, filename, mimeType, metaAccountId, accessToken) {
//   const uploadUrl = `https://graph.facebook.com/${API_VERSION}/${metaAccountId}/adimages`;

//   const { body, contentType } = buildMultipartBody(
//     [],
//     { name: "filename", filename, mime: mimeType, buffer }
//   );

//   const response = await fetch(uploadUrl, {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//       "Content-Type": contentType,
//       "Content-Length": body.length.toString(),
//     },
//     body,
//   });

//   const result = await response.json();

//   if (!response.ok) {
//     throw Object.assign(
//       new Error(`Meta image upload failed: ${result?.error?.message || response.status}`),
//       { metaError: result?.error }
//     );
//   }

//   let imageHash = null;
//   if (result.images) {
//     const key = Object.keys(result.images)[0];
//     imageHash = result.images[key]?.hash || null;
//   } else if (result.hash) {
//     imageHash = result.hash;
//   }

//   if (!imageHash) throw new Error("Upload succeeded but no image hash returned by Meta.");

//   return { image_hash: imageHash };
// }

// // ============================================================
// // CORE: Upload video buffer → target Meta Ad Account
// // ≤ 100 MB → direct upload
// // > 100 MB → resumable (start / transfer chunks / finish)
// // Returns { video_id, upload_method }
// // ============================================================
// async function uploadVideoToAccount(buffer, filename, mimeType, metaAccountId, accessToken) {
//   const baseUrl = `https://graph-video.facebook.com/${API_VERSION}/${metaAccountId}/advideos`;
//   const DIRECT_MAX = 100 * 1024 * 1024;

//   // ── Direct upload ────────────────────────────────────────
//   if (buffer.length <= DIRECT_MAX) {
//     log.step(`Direct video upload (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

//     const { body, contentType } = buildMultipartBody(
//       [],
//       { name: "source", filename, mime: mimeType, buffer }
//     );

//     const response = await fetch(baseUrl, {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         "Content-Type": contentType,
//         "Content-Length": body.length.toString(),
//       },
//       body,
//     });

//     const result = await response.json();

//     if (!response.ok) {
//       throw Object.assign(
//         new Error(`Meta video upload failed: ${result?.error?.message || response.status}`),
//         { metaError: result?.error }
//       );
//     }

//     if (!result.id) throw new Error("Upload succeeded but no video ID returned by Meta.");

//     return { video_id: result.id, upload_method: "direct" };
//   }

//   // ── Resumable upload ─────────────────────────────────────
//   log.step(`Resumable video upload (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

//   // Phase 1 – Start
//   const startRes = await fetch(
//     `${baseUrl}?upload_phase=start&file_size=${buffer.length}`,
//     { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
//   );
//   const startData = await startRes.json();
//   if (!startRes.ok) throw new Error(`Resumable start failed: ${startData?.error?.message || startRes.status}`);

//   const { upload_session_id: sessionId } = startData;
//   let videoId = startData.video_id || null;
//   let currentOffset = parseInt(startData.start_offset || "0", 10);

//   // Phase 2 – Transfer chunks (50 MB each)
//   const CHUNK_SIZE = 50 * 1024 * 1024;
//   let chunkNum = 1;
//   const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);

//   while (currentOffset < buffer.length) {
//     const chunkEnd  = Math.min(currentOffset + CHUNK_SIZE - 1, buffer.length - 1);
//     const chunkData = buffer.slice(currentOffset, chunkEnd + 1);

//     log.step(`Chunk ${chunkNum}/${totalChunks} → bytes ${currentOffset}–${chunkEnd}`);

//     const { body: chunkBody, contentType: chunkContentType } = buildMultipartBody(
//       [],
//       { name: "video_file_chunk", filename: "chunk.mp4", mime: "video/mp4", buffer: chunkData }
//     );

//     const params = new URLSearchParams({
//       upload_phase:      "transfer",
//       upload_session_id: sessionId,
//       start_offset:      currentOffset.toString(),
//     });

//     const chunkRes = await fetch(`${baseUrl}?${params}`, {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         "Content-Type": chunkContentType,
//         "Content-Length": chunkBody.length.toString(),
//       },
//       body: chunkBody,
//     });

//     const chunkResult = await chunkRes.json();
//     if (!chunkRes.ok) throw new Error(`Chunk ${chunkNum} failed: ${chunkResult?.error?.message || chunkRes.status}`);

//     currentOffset = parseInt(
//       chunkResult.start_offset ?? chunkResult.end_offset ?? (chunkEnd + 1),
//       10
//     );
//     chunkNum++;
//   }

//   // Phase 3 – Finish
//   const finishRes = await fetch(
//     `${baseUrl}?upload_phase=finish&upload_session_id=${sessionId}`,
//     { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
//   );
//   const finishData = await finishRes.json();
//   if (!finishRes.ok) throw new Error(`Resumable finish failed: ${finishData?.error?.message || finishRes.status}`);

//   videoId = finishData.id || videoId;
//   if (!videoId) throw new Error("Resumable upload finished but no video ID returned by Meta.");

//   return { video_id: videoId, upload_method: "resumable" };
// }

// // ============================================================
// // POST  /api/meta/copy-asset
// //
// // Request body (JSON):
// // {
// //   "sourceAccountId": "<prisma id>",
// //   "targetAccountId": "<prisma id>",
// //   "assetType":       "image" | "video",
// //   "assetUrl":        "<any meta cdn or graph url>",
// //   "assetName":       "my_video.mp4"    // optional filename hint
// // }
// // ============================================================
// export async function POST(request) {
//   log.start("POST /api/meta/copy-asset");

//   // ── Auth ─────────────────────────────────────────────────
//   const session = await getServerSession(authOptions);
//   if (!session?.user?.id) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   // ── Parse body ───────────────────────────────────────────
//   let body;
//   try {
//     body = await request.json();
//   } catch {
//     return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
//   }

//   const { sourceAccountId, targetAccountId, assetType, assetUrl, assetName } = body;

//   // ── Validate ─────────────────────────────────────────────
//   if (!sourceAccountId || !targetAccountId || !assetType || !assetUrl) {
//     return NextResponse.json(
//       { error: "Missing required fields: sourceAccountId, targetAccountId, assetType, assetUrl" },
//       { status: 400 }
//     );
//   }
//   if (!["image", "video"].includes(assetType)) {
//     return NextResponse.json({ error: "assetType must be 'image' or 'video'" }, { status: 400 });
//   }
//   if (sourceAccountId === targetAccountId) {
//     return NextResponse.json(
//       { error: "sourceAccountId and targetAccountId must be different" },
//       { status: 400 }
//     );
//   }

//   log.info("Request", { sourceAccountId, targetAccountId, assetType, assetUrl });

//   try {
//     // ── Resolve & verify accounts ─────────────────────────
//     const { source, target } = await resolveAccounts(
//       sourceAccountId,
//       targetAccountId,
//       session.user.id
//     );

//     if (!source) return NextResponse.json(
//       { error: "Source ad account not found or access denied" }, { status: 404 }
//     );
//     if (!target) return NextResponse.json(
//       { error: "Target ad account not found or access denied" }, { status: 404 }
//     );

//     const targetMetaId = normalizeMetaId(target.metaAccountId);

//     log.info("Accounts resolved", {
//       source: `${source.name} (${source.metaAccountId})`,
//       target: `${target.name} (${targetMetaId})`,
//     });

//     // ── Download asset ────────────────────────────────────
//     log.step("Downloading asset...");
//     let { buffer, contentType } = await downloadAsset(assetUrl, source.accessToken);
//     const originalSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
//     log.info("Downloaded", { contentType, sizeMB: originalSizeMB });

//     // ── Validate content-type ─────────────────────────────
//     if (assetType === "image" && !isValidImageType(contentType)) {
//       return NextResponse.json(
//         { error: `URL did not return an image. Received content-type: ${contentType}` },
//         { status: 400 }
//       );
//     }
//     if (assetType === "video" && !isValidVideoType(contentType)) {
//       log.warn(`Unexpected content-type for video: ${contentType}. Proceeding with video/mp4.`);
//     }

//     // ── Remux fMP4 → standalone MP4 if needed ────────────
//     // Meta CDN serves fragmented MP4 (DASH). These have valid
//     // video/mp4 content-type but Meta's upload API rejects them
//     // because the moov atom is absent or misplaced.
//     // ffmpeg remux fixes this in seconds with zero re-encoding.
//     let remuxed = false;
//     if (assetType === "video") {
//       if (isFragmentedMP4(buffer)) {
//         log.warn("Buffer is a fragmented MP4 (fMP4/DASH) — remuxing to standalone MP4 via ffmpeg...");

//         const ffmpegAvailable = await isFfmpegAvailable();
//         if (!ffmpegAvailable) {
//           return NextResponse.json(
//             {
//               error:
//                 "ffmpeg is required to remux this video but was not found on the server. " +
//                 "Please install ffmpeg: https://ffmpeg.org/download.html — " +
//                 "On Windows: winget install ffmpeg  |  On Linux: apt install ffmpeg",
//             },
//             { status: 500 }
//           );
//         }

//         buffer = await remuxToStandaloneMP4(buffer);
//         contentType = "video/mp4";
//         remuxed = true;
//         log.info("Remux complete", { sizeMB: (buffer.length / 1024 / 1024).toFixed(2) });
//       } else {
//         log.info("Buffer is a standard standalone MP4 — no remux needed.");
//       }
//     }

//     // ── Build filename ────────────────────────────────────
//     const filename = assetName
//       ? assetName.replace(/[^a-zA-Z0-9._-]/g, "_")
//       : deriveFilename(assetUrl, contentType);

//     // Ensure video filename ends in .mp4
//     const finalFilename =
//       assetType === "video" && !filename.toLowerCase().endsWith(".mp4")
//         ? filename.replace(/\.[^.]+$/, "") + ".mp4" || filename + ".mp4"
//         : filename;

//     log.step(`Uploading "${finalFilename}" → ${target.name}`);

//     // ── Upload to target account ──────────────────────────
//     let uploadResult;

//     if (assetType === "image") {
//       uploadResult = await uploadImageToAccount(
//         buffer, finalFilename, contentType, targetMetaId, target.accessToken
//       );
//     } else {
//       uploadResult = await uploadVideoToAccount(
//         buffer, finalFilename, "video/mp4", targetMetaId, target.accessToken
//       );
//     }

//     log.success("Asset copied successfully", uploadResult);

//     const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);

//     return NextResponse.json({
//       success: true,
//       message: `${assetType === "image" ? "Image" : "Video"} copied successfully`,
//       asset_type: assetType,
//       filename: finalFilename,
//       file_size_bytes: buffer.length,
//       file_size_mb: parseFloat(fileSizeMB),
//       remuxed,
//       source_account: {
//         internal_id: source.id,
//         name: source.name,
//         meta_id: source.metaAccountId,
//       },
//       target_account: {
//         internal_id: target.id,
//         name: target.name,
//         meta_id: targetMetaId,
//       },
//       result: uploadResult,
//     });

//   } catch (error) {
//     log.error("Copy asset failed", error);

//     return NextResponse.json(
//       {
//         error: "Failed to copy asset",
//         details: error.message,
//         ...(error?.metaError ? { meta_error: error.metaError } : {}),
//       },
//       { status: 500 }
//     );
//   }
// }

// ============================================================
// app/api/meta/copy-asset/route.js
// Copy images or videos from one Meta Ad Account to another
// ============================================================

import { NextResponse }                from "next/server";
import { prisma }                      from "@/lib/prisma";
import { withAuth }                    from "@/lib/middleware/withAuth";
import { spawn }                       from "child_process";
import { tmpdir }                      from "os";
import { join }                        from "path";
import { writeFile, readFile, unlink } from "fs/promises";
import { randomUUID }                  from "crypto";

const API_VERSION = "v24.0";

// ============================================================
// LOGGER
// ============================================================

const log = {
  start:   (msg, d = null) => console.log(`\n🔁 COPY-ASSET START → ${msg}`, d ? JSON.stringify(d, null, 2) : ""),
  step:    (msg, d = null) => console.log(`📌 STEP → ${msg}`,    d ? JSON.stringify(d, null, 2) : ""),
  info:    (msg, d = null) => console.log(`ℹ️  INFO → ${msg}`,    d ? JSON.stringify(d, null, 2) : ""),
  success: (msg, d = null) => console.log(`✅ SUCCESS → ${msg}`, d ? JSON.stringify(d, null, 2) : ""),
  warn:    (msg, d = null) => console.warn(`⚠️  WARN → ${msg}`,  d ? JSON.stringify(d, null, 2) : ""),
  error:   (msg, err = null) => {
    console.error(`\n❌ ERROR → ${msg}`);
    if (err) {
      console.error("   MESSAGE:", err?.message || err);
      if (err?.response?.error) console.error("   META ERROR:", JSON.stringify(err.response.error, null, 2));
      if (err?.stack) console.error("   STACK:", err.stack);
    }
    console.error("\n");
  },
};

// ============================================================
// HELPER: Fetch both ad account records.
// NO userId filter — access is already proven via canAccess()
// before this function is called. Using findUnique with only
// the id field so Prisma generates a simple WHERE id = $1
// query without any ownership constraint.
// ============================================================
async function resolveAccounts(sourceAccountId, targetAccountId) {
  const [source, target] = await Promise.all([
    prisma.metaAdAccount.findUnique({
      where:  { id: sourceAccountId },
      select: { id: true, name: true, metaAccountId: true, accessToken: true },
    }),
    prisma.metaAdAccount.findUnique({
      where:  { id: targetAccountId },
      select: { id: true, name: true, metaAccountId: true, accessToken: true },
    }),
  ]);
  return { source, target };
}

// ============================================================
// HELPER: Normalize Meta account ID → "act_XXXXXXXXX"
// ============================================================
function normalizeMetaId(rawId) {
  return `act_${rawId.toString().trim().replace(/^act_/, "")}`;
}

// ============================================================
// HELPER: Check if ffmpeg is available on this system
// ============================================================
async function isFfmpegAvailable() {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

// ============================================================
// HELPER: Remux a fragmented MP4 (fMP4/DASH) buffer into a
// standalone MP4 using ffmpeg.
// -c copy       → no re-encoding, just container remux (fast)
// -movflags faststart → moves moov atom to front (required)
// ============================================================
async function remuxToStandaloneMP4(inputBuffer) {
  const id         = randomUUID();
  const inputPath  = join(tmpdir(), `admigo_in_${id}.mp4`);
  const outputPath = join(tmpdir(), `admigo_out_${id}.mp4`);

  try {
    await writeFile(inputPath, inputBuffer);
    log.step(`ffmpeg remux: ${(inputBuffer.length / 1024 / 1024).toFixed(2)} MB → standalone MP4`);

    await new Promise((resolve, reject) => {
      const args = [
        "-y",
        "-i", inputPath,
        "-c", "copy",
        "-movflags", "faststart",
        "-f", "mp4",
        outputPath,
      ];

      const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      proc.on("error", (err) => reject(new Error(`ffmpeg spawn error: ${err.message}`)));
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}. stderr: ${stderr.slice(-500)}`));
        }
      });
    });

    const outputBuffer = await readFile(outputPath);
    log.success(`ffmpeg remux complete: ${(outputBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    return outputBuffer;

  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

// ============================================================
// HELPER: Download asset bytes from a URL
// ============================================================
async function downloadAsset(url, accessToken = null) {
  const headers = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download asset: HTTP ${response.status} from ${url}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const buffer      = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}

// ============================================================
// HELPER: Detect fragmented/DASH MP4
// ============================================================
function isFragmentedMP4(buffer) {
  const head = buffer.slice(0, Math.min(buffer.length, 1024));
  const str  = head.toString("binary");

  if (str.includes("moof")) return true;

  const moovPos = str.indexOf("moov");
  const mdatPos = str.indexOf("mdat");

  if (str.includes("moov") && str.includes("mdat") && moovPos > mdatPos) return true;
  if (!str.includes("moov") && str.includes("mdat")) return true;

  return false;
}

// ============================================================
// HELPER: Derive a safe filename from URL + content-type
// ============================================================
function deriveFilename(url, contentType) {
  try {
    const pathname = new URL(url).pathname;
    const base     = pathname.split("/").pop() || "asset";
    const clean    = base.split("?")[0];
    if (clean && clean.includes(".")) return clean;
  } catch (_) { /* ignore */ }

  const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
  return `asset_${Date.now()}.${ext}`;
}

// ============================================================
// HELPERS: MIME type validation
// ============================================================
function isValidImageType(ct) {
  return ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    .some(t => ct.startsWith(t));
}

function isValidVideoType(ct) {
  return ["video/mp4", "video/quicktime", "video/mov", "video/avi", "video/mpeg"]
    .some(t => ct.startsWith(t));
}

// ============================================================
// HELPER: Build multipart/form-data body safely with
// Buffer.concat — zero string-to-binary conversion.
// ============================================================
function buildMultipartBody(fields = [], file = null) {
  const boundary =
    "----FormBoundary" + Date.now().toString(16) + Math.random().toString(16).slice(2);
  const parts = [];

  for (const { name, value } of fields) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        "utf8"
      )
    );
  }

  if (file) {
    const header =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.mime}\r\n\r\n`;
    parts.push(Buffer.from(header, "utf8"));
    parts.push(file.buffer);
    parts.push(Buffer.from("\r\n", "utf8"));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));

  const body = Buffer.concat(parts);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

// ============================================================
// CORE: Upload image buffer → target Meta Ad Account
// Returns { image_hash }
// ============================================================
async function uploadImageToAccount(buffer, filename, mimeType, metaAccountId, accessToken) {
  const uploadUrl = `https://graph.facebook.com/${API_VERSION}/${metaAccountId}/adimages`;

  const { body, contentType } = buildMultipartBody(
    [],
    { name: "filename", filename, mime: mimeType, buffer }
  );

  const response = await fetch(uploadUrl, {
    method:  "POST",
    headers: {
      Authorization:    `Bearer ${accessToken}`,
      "Content-Type":   contentType,
      "Content-Length": body.length.toString(),
    },
    body,
  });

  const result = await response.json();

  if (!response.ok) {
    throw Object.assign(
      new Error(`Meta image upload failed: ${result?.error?.message || response.status}`),
      { metaError: result?.error }
    );
  }

  let imageHash = null;
  if (result.images) {
    const key = Object.keys(result.images)[0];
    imageHash  = result.images[key]?.hash || null;
  } else if (result.hash) {
    imageHash = result.hash;
  }

  if (!imageHash) throw new Error("Upload succeeded but no image hash returned by Meta.");
  return { image_hash: imageHash };
}

// ============================================================
// CORE: Upload video buffer → target Meta Ad Account
// ≤ 100 MB → direct upload
// > 100 MB → resumable (start / transfer chunks / finish)
// Returns { video_id, upload_method }
// ============================================================
async function uploadVideoToAccount(buffer, filename, mimeType, metaAccountId, accessToken) {
  const baseUrl    = `https://graph-video.facebook.com/${API_VERSION}/${metaAccountId}/advideos`;
  const DIRECT_MAX = 100 * 1024 * 1024;

  // ── Direct upload ─────────────────────────────────────────
  if (buffer.length <= DIRECT_MAX) {
    log.step(`Direct video upload (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    const { body, contentType } = buildMultipartBody(
      [],
      { name: "source", filename, mime: mimeType, buffer }
    );

    const response = await fetch(baseUrl, {
      method:  "POST",
      headers: {
        Authorization:    `Bearer ${accessToken}`,
        "Content-Type":   contentType,
        "Content-Length": body.length.toString(),
      },
      body,
    });

    const result = await response.json();

    if (!response.ok) {
      throw Object.assign(
        new Error(`Meta video upload failed: ${result?.error?.message || response.status}`),
        { metaError: result?.error }
      );
    }

    if (!result.id) throw new Error("Upload succeeded but no video ID returned by Meta.");
    return { video_id: result.id, upload_method: "direct" };
  }

  // ── Resumable upload ──────────────────────────────────────
  log.step(`Resumable video upload (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  // Phase 1 – Start
  const startRes  = await fetch(
    `${baseUrl}?upload_phase=start&file_size=${buffer.length}`,
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const startData = await startRes.json();
  if (!startRes.ok) {
    throw new Error(`Resumable start failed: ${startData?.error?.message || startRes.status}`);
  }

  const { upload_session_id: sessionId } = startData;
  let videoId       = startData.video_id   || null;
  let currentOffset = parseInt(startData.start_offset || "0", 10);

  // Phase 2 – Transfer chunks (50 MB each)
  const CHUNK_SIZE  = 50 * 1024 * 1024;
  let chunkNum      = 1;
  const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);

  while (currentOffset < buffer.length) {
    const chunkEnd  = Math.min(currentOffset + CHUNK_SIZE - 1, buffer.length - 1);
    const chunkData = buffer.slice(currentOffset, chunkEnd + 1);

    log.step(`Chunk ${chunkNum}/${totalChunks} → bytes ${currentOffset}–${chunkEnd}`);

    const { body: chunkBody, contentType: chunkContentType } = buildMultipartBody(
      [],
      { name: "video_file_chunk", filename: "chunk.mp4", mime: "video/mp4", buffer: chunkData }
    );

    const params = new URLSearchParams({
      upload_phase:      "transfer",
      upload_session_id: sessionId,
      start_offset:      currentOffset.toString(),
    });

    const chunkRes    = await fetch(`${baseUrl}?${params}`, {
      method:  "POST",
      headers: {
        Authorization:    `Bearer ${accessToken}`,
        "Content-Type":   chunkContentType,
        "Content-Length": chunkBody.length.toString(),
      },
      body: chunkBody,
    });
    const chunkResult = await chunkRes.json();
    if (!chunkRes.ok) {
      throw new Error(`Chunk ${chunkNum} failed: ${chunkResult?.error?.message || chunkRes.status}`);
    }

    currentOffset = parseInt(
      chunkResult.start_offset ?? chunkResult.end_offset ?? (chunkEnd + 1),
      10
    );
    chunkNum++;
  }

  // Phase 3 – Finish
  const finishRes  = await fetch(
    `${baseUrl}?upload_phase=finish&upload_session_id=${sessionId}`,
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const finishData = await finishRes.json();
  if (!finishRes.ok) {
    throw new Error(`Resumable finish failed: ${finishData?.error?.message || finishRes.status}`);
  }

  videoId = finishData.id || videoId;
  if (!videoId) throw new Error("Resumable upload finished but no video ID returned by Meta.");
  return { video_id: videoId, upload_method: "resumable" };
}

// ============================================================
// POST  /api/meta/copy-asset
//
// Request body (JSON):
// {
//   "sourceAccountId": "<prisma DB uuid>",
//   "targetAccountId": "<prisma DB uuid>",
//   "assetType":       "image" | "video",
//   "assetUrl":        "<any meta cdn or graph url>",
//   "assetName":       "my_video.mp4"   // optional filename hint
// }
// ============================================================
export const POST = withAuth(async (request, routeContext, ctx) => {
  log.start("POST /api/meta/copy-asset");
  log.info("Session validated", { userId: ctx.userId });

  // ── Parse body ───────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sourceAccountId, targetAccountId, assetType, assetUrl, assetName } = body;

  // ── Validate required fields ─────────────────────────────
  if (!sourceAccountId || !targetAccountId || !assetType || !assetUrl) {
    return NextResponse.json(
      { error: "Missing required fields: sourceAccountId, targetAccountId, assetType, assetUrl" },
      { status: 400 }
    );
  }
  if (!["image", "video"].includes(assetType)) {
    return NextResponse.json(
      { error: "assetType must be 'image' or 'video'" },
      { status: 400 }
    );
  }
  if (sourceAccountId === targetAccountId) {
    return NextResponse.json(
      { error: "sourceAccountId and targetAccountId must be different" },
      { status: 400 }
    );
  }

  log.info("Request", { sourceAccountId, targetAccountId, assetType, assetUrl });

  // ── Access check — source account ────────────────────────
  // Reading from source only requires canAccess().
  // Returns true for admins (['*']), owners, and any member.
  if (!ctx.adAccountAccess.canAccess(sourceAccountId)) {
    log.warn("Access denied to source account", {
      userId:          ctx.userId,
      sourceAccountId,
      allAccessibleIds: ctx.adAccountAccess.allIds,
    });
    return NextResponse.json(
      { error: "Source ad account not found or access denied" },
      { status: 403 }
    );
  }

  // ── Access check — target account ────────────────────────
  if (!ctx.adAccountAccess.canAccess(targetAccountId)) {
    log.warn("Access denied to target account", {
      userId:          ctx.userId,
      targetAccountId,
      allAccessibleIds: ctx.adAccountAccess.allIds,
    });
    return NextResponse.json(
      { error: "Target ad account not found or access denied" },
      { status: 403 }
    );
  }

  // ── Permission check — create_campaigns on target ────────
  // Writing an asset INTO an account is a creative action.
  // Members need explicit 'create_campaigns' permission on the
  // target account. Owners and admins have ['*'] so this passes
  // automatically for them.
  if (!ctx.adAccountAccess.hasPermission(targetAccountId, "create_campaigns")) {
    log.warn("Permission denied — create_campaigns required on target account", {
      userId:          ctx.userId,
      targetAccountId,
      accessType:      ctx.adAccountAccess.getAccount(targetAccountId)?.accessType,
      userPermissions: ctx.adAccountAccess.getAccount(targetAccountId)?.permissions,
    });
    return NextResponse.json(
      {
        error:              "You do not have permission to copy assets into this ad account",
        requiredPermission: "create_campaigns",
        targetAccountId,
      },
      { status: 403 }
    );
  }

  log.info("Access and permission verified", {
    userId:           ctx.userId,
    sourceAccountId,
    targetAccountId,
    sourceAccessType: ctx.adAccountAccess.getAccount(sourceAccountId)?.accessType,
    targetAccessType: ctx.adAccountAccess.getAccount(targetAccountId)?.accessType,
  });

  try {
    // ── Resolve accounts from DB ──────────────────────────
    // No userId filter — access already proven above via
    // canAccess(). resolveAccounts does a plain findUnique
    // by id only, so both owners and members can resolve
    // accounts they have access to.
    const { source, target } = await resolveAccounts(sourceAccountId, targetAccountId);

    if (!source) {
      log.warn("Source account record not found in DB", { sourceAccountId });
      return NextResponse.json(
        { error: "Source ad account not found" },
        { status: 404 }
      );
    }
    if (!target) {
      log.warn("Target account record not found in DB", { targetAccountId });
      return NextResponse.json(
        { error: "Target ad account not found" },
        { status: 404 }
      );
    }

    const targetMetaId = normalizeMetaId(target.metaAccountId);

    log.info("Accounts resolved", {
      source: `${source.name} (${source.metaAccountId})`,
      target: `${target.name} (${targetMetaId})`,
    });

    // ── Download asset ────────────────────────────────────
    log.step("Downloading asset...");
    let { buffer, contentType } = await downloadAsset(assetUrl, source.accessToken);
    log.info("Downloaded", {
      contentType,
      sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
    });

    // ── Validate content-type ─────────────────────────────
    if (assetType === "image" && !isValidImageType(contentType)) {
      return NextResponse.json(
        { error: `URL did not return an image. Received content-type: ${contentType}` },
        { status: 400 }
      );
    }
    if (assetType === "video" && !isValidVideoType(contentType)) {
      log.warn(`Unexpected content-type for video: ${contentType}. Proceeding with video/mp4.`);
    }

    // ── Remux fMP4 → standalone MP4 if needed ────────────
    // Meta CDN serves fragmented MP4 (DASH). These have valid
    // video/mp4 content-type but Meta's upload API rejects them
    // because the moov atom is absent or misplaced.
    let remuxed = false;
    if (assetType === "video") {
      if (isFragmentedMP4(buffer)) {
        log.warn("Buffer is a fragmented MP4 (fMP4/DASH) — remuxing to standalone MP4 via ffmpeg...");

        const ffmpegAvailable = await isFfmpegAvailable();
        if (!ffmpegAvailable) {
          return NextResponse.json(
            {
              error:
                "ffmpeg is required to remux this video but was not found on the server. " +
                "Please install ffmpeg: https://ffmpeg.org/download.html — " +
                "On Windows: winget install ffmpeg  |  On Linux: apt install ffmpeg",
            },
            { status: 500 }
          );
        }

        buffer      = await remuxToStandaloneMP4(buffer);
        contentType = "video/mp4";
        remuxed     = true;
        log.info("Remux complete", { sizeMB: (buffer.length / 1024 / 1024).toFixed(2) });
      } else {
        log.info("Buffer is a standard standalone MP4 — no remux needed.");
      }
    }

    // ── Build filename ────────────────────────────────────
    const filename = assetName
      ? assetName.replace(/[^a-zA-Z0-9._-]/g, "_")
      : deriveFilename(assetUrl, contentType);

    const finalFilename =
      assetType === "video" && !filename.toLowerCase().endsWith(".mp4")
        ? filename.replace(/\.[^.]+$/, "") + ".mp4" || filename + ".mp4"
        : filename;

    log.step(`Uploading "${finalFilename}" → ${target.name}`);

    // ── Upload to target account ──────────────────────────
    let uploadResult;

    if (assetType === "image") {
      uploadResult = await uploadImageToAccount(
        buffer, finalFilename, contentType, targetMetaId, target.accessToken
      );
    } else {
      uploadResult = await uploadVideoToAccount(
        buffer, finalFilename, "video/mp4", targetMetaId, target.accessToken
      );
    }

    log.success("Asset copied successfully", uploadResult);

    return NextResponse.json({
      success:         true,
      message:         `${assetType === "image" ? "Image" : "Video"} copied successfully`,
      asset_type:      assetType,
      filename:        finalFilename,
      file_size_bytes: buffer.length,
      file_size_mb:    parseFloat((buffer.length / 1024 / 1024).toFixed(2)),
      remuxed,
      source_account: {
        internal_id: source.id,
        name:        source.name,
        meta_id:     source.metaAccountId,
      },
      target_account: {
        internal_id: target.id,
        name:        target.name,
        meta_id:     targetMetaId,
      },
      result: uploadResult,
    });

  } catch (error) {
    log.error("Copy asset failed", error);
    return NextResponse.json(
      {
        error:   "Failed to copy asset",
        details: error.message,
        ...(error?.metaError ? { meta_error: error.metaError } : {}),
      },
      { status: 500 }
    );
  }
});