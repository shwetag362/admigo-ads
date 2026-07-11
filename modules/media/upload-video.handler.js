// // app/api/media/upload-video/route.js
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

const API_VERSION = "v24.0"; // Use latest version

const log = {
  start: (msg) => console.log(`\n🎥 VIDEO UPLOAD START → ${msg}`),
  info: (msg, data = null) => console.log(`ℹ️ INFO → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  progress: (msg, data = null) => console.log(`📈 PROGRESS → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  success: (msg, data = null) => console.log(`✅ SUCCESS → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  warning: (msg, data = null) => console.warn(`⚠️ WARNING → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  error: (msg, err = null) => {
    console.error(`\n❌ ERROR → ${msg}`);
    if (err) {
      console.error("   MESSAGE:", err?.message || err);
      if (err?.error) console.error("   FACEBOOK ERROR:", JSON.stringify(err.error, null, 2));
      console.error("   FULL RESULT:", JSON.stringify(err, null, 2));
      console.error("   STACK →", err?.stack || "No stack", "\n");
    }
  },
};

export async function POST(request) {
  log.start("Video Upload Request");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    log.error("Unauthorized access");
    return NextResponse.json({ 
      error: "Unauthorized access. Please log in." 
    }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    log.error("Invalid Content-Type", { received: contentType });
    return NextResponse.json({ 
      error: "Content-Type must be multipart/form-data" 
    }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("video");
    const accountId = formData.get("accountId");

    // Validation
    if (!file || !accountId) {
      log.error("Missing required fields", { 
        hasFile: !!file, 
        hasAccountId: !!accountId 
      });
      return NextResponse.json({ 
        error: "Missing 'video' file or 'accountId' parameter" 
      }, { status: 400 });
    }

    if (!(file instanceof File)) {
      log.error("Invalid file type");
      return NextResponse.json({ 
        error: "Invalid file upload - must be a valid File object" 
      }, { status: 400 });
    }

    // File type validation
    const allowedTypes = ["video/mp4", "video/quicktime", "video/mov", "video/avi"];
    if (!allowedTypes.includes(file.type)) {
      log.error("Invalid video type", { type: file.type });
      return NextResponse.json({
        error: `Invalid video type: ${file.type}. Allowed: mp4, mov, quicktime, avi`,
      }, { status: 400 });
    }

    // File size validation (4GB max)
    const maxSize = 4 * 1024 * 1024 * 1024;
    if (file.size > maxSize) {
      log.error("Video exceeds size limit", { size: file.size });
      return NextResponse.json({ 
        error: "Video too large (max 4GB)" 
      }, { status: 400 });
    }

    log.info("Video received", {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2),
    });

    // Get ad account
    const adAccount = await prisma.metaAdAccount.findUnique({
      where: { id: accountId, userId: session.user.id },
      select: { metaAccountId: true, accessToken: true, name: true },
    });

    if (!adAccount) {
      log.error("Ad account not found", { accountId });
      return NextResponse.json({ 
        error: "Ad account not found or not accessible" 
      }, { status: 404 });
    }

    log.info(`Uploading video to: ${adAccount.name} (${adAccount.metaAccountId})`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const accessToken = adAccount.accessToken;

    // Use graph-video.facebook.com for video uploads
    const baseUrl = `https://graph-video.facebook.com/${API_VERSION}/${adAccount.metaAccountId}/advideos`;

    let videoId = null;

    // Choose upload method based on file size
    const DIRECT_UPLOAD_MAX_MB = 100;
    const useDirectUpload = file.size <= DIRECT_UPLOAD_MAX_MB * 1024 * 1024;

    if (useDirectUpload) {
      // ========================================
      // DIRECT UPLOAD (< 100MB)
      // ========================================
      log.info(`Starting direct upload (file ≤ ${DIRECT_UPLOAD_MAX_MB}MB)`);

      const boundary = "----WebKitFormBoundary" + Date.now().toString(16);
      let body = `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="source"; filename="${file.name}"\r\n`;
      body += `Content-Type: ${file.type || "video/mp4"}\r\n\r\n`;
      body += buffer.toString("binary");
      body += `\r\n--${boundary}--`;

      const uploadResponse = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: Buffer.from(body, "binary"),
      });

      const text = await uploadResponse.text();
      let result = {};
      
      if (text) {
        try { 
          result = JSON.parse(text); 
        } catch (e) {
          log.error("Failed to parse direct response", { text });
          return NextResponse.json({ 
            error: "Invalid response from Meta" 
          }, { status: 500 });
        }
      }

      if (!uploadResponse.ok) {
        log.error("Direct upload failed", result);
        return NextResponse.json({
          error: "Direct upload failed",
          meta_error: result.error || result,
        }, { status: uploadResponse.status });
      }

      videoId = result.id;
      log.success(`Direct upload successful! Video ID: ${videoId}`);

    } else {
      // ========================================
      // RESUMABLE UPLOAD (> 100MB)
      // ========================================
      log.info("Starting resumable upload (> 100MB)");

      // PHASE 1: Start session
      const startUrl = `${baseUrl}?upload_phase=start&file_size=${file.size}`;

      const startResponse = await fetch(startUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });

      const startText = await startResponse.text();
      let startResult = {};
      
      if (startText) {
        try { 
          startResult = JSON.parse(startText); 
        } catch (e) {
          log.error("Failed to parse start response", { startText });
          return NextResponse.json({ 
            error: "Failed to start resumable session" 
          }, { status: 500 });
        }
      }

      if (!startResponse.ok) {
        log.error("Start session failed", startResult);
        return NextResponse.json({
          error: "Failed to start resumable session",
          meta_error: startResult.error || startResult,
        }, { status: startResponse.status });
      }

      const uploadSessionId = startResult.upload_session_id;
      videoId = startResult.video_id || null;
      let currentOffset = parseInt(startResult.start_offset || "0", 10);
      const endOffset = parseInt(startResult.end_offset || file.size, 10);

      log.info("Session started", {
        uploadSessionId,
        videoId,
        startOffset: currentOffset,
        endOffset,
      });

      // PHASE 2: Transfer chunks
      const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks
      let chunkNumber = 1;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let retryCount = 0;
      const MAX_RETRIES = 3;

      while (currentOffset < file.size) {
        const chunkEnd = Math.min(currentOffset + CHUNK_SIZE - 1, file.size - 1);
        const chunk = buffer.slice(currentOffset, chunkEnd + 1);

        log.progress(`Uploading chunk ${chunkNumber}/${totalChunks}`, {
          offset: currentOffset,
          size: chunk.length,
          progress: `${((currentOffset / file.size) * 100).toFixed(2)}%`,
        });

        const boundary = "----WebKitFormBoundary" + Date.now().toString(16);
        let chunkBody = `--${boundary}\r\n`;
        chunkBody += `Content-Disposition: form-data; name="video_file_chunk"; filename="chunk.mp4"\r\n`;
        chunkBody += `Content-Type: video/mp4\r\n\r\n`;
        chunkBody += chunk.toString("binary");
        chunkBody += `\r\n--${boundary}--`;

        const transferParams = new URLSearchParams({
          upload_phase: "transfer",
          upload_session_id: uploadSessionId,
          start_offset: currentOffset.toString(),
        });

        const transferUrl = `${baseUrl}?${transferParams.toString()}`;

        const chunkResponse = await fetch(transferUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: Buffer.from(chunkBody, "binary"),
        });

        const chunkText = await chunkResponse.text();
        let chunkResult = {};
        
        if (chunkText) {
          try { 
            chunkResult = JSON.parse(chunkText); 
          } catch (e) {
            log.error(`Chunk ${chunkNumber} parse error`, { chunkText });
          }
        }

        if (!chunkResponse.ok) {
          log.error(`Chunk ${chunkNumber} failed`, chunkResult);
          
          // Retry logic with exponential backoff
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            const waitTime = 1000 * Math.pow(2, retryCount);
            log.warning(`Retrying chunk ${chunkNumber} after ${waitTime}ms (attempt ${retryCount}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Retry same chunk
          } else {
            return NextResponse.json({
              error: `Chunk upload failed after ${MAX_RETRIES} retries`,
              chunk: chunkNumber,
              meta_error: chunkResult.error || chunkResult,
            }, { status: 500 });
          }
        }

        // Success - reset retry counter and update offset
        retryCount = 0;
        currentOffset = parseInt(
          chunkResult.end_offset || 
          chunkResult.start_offset || 
          (chunkEnd + 1), 
          10
        );
        
        log.success(`Chunk ${chunkNumber}/${totalChunks} uploaded`);
        chunkNumber++;
      }

      // PHASE 3: Finish session
      log.info("Finishing upload session");

      const finishUrl = `${baseUrl}?upload_phase=finish&upload_session_id=${uploadSessionId}`;

      const finishResponse = await fetch(finishUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });

      const finishText = await finishResponse.text();
      let finishResult = {};
      
      if (finishText) {
        try { 
          finishResult = JSON.parse(finishText); 
        } catch (e) {
          log.error("Finish parse error", { finishText });
        }
      }

      if (!finishResponse.ok) {
        log.error("Finish failed", finishResult);
        return NextResponse.json({
          error: "Failed to finish upload",
          meta_error: finishResult.error || finishResult,
        }, { status: finishResponse.status });
      }

      videoId = finishResult.id || videoId;
      log.success(`Resumable upload completed! Video ID: ${videoId}`);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: "Video uploaded successfully to Meta Ad Account",
      video_id: videoId,
      account: adAccount.name,
      account_id: adAccount.metaAccountId,
      file_name: file.name,
      file_size: file.size,
      upload_method: useDirectUpload ? "direct" : "resumable",
    });

  } catch (error) {
    log.error("Video upload process failed", error);
    return NextResponse.json({
      error: "Upload failed",
      details: error.message,
      suggestion: "Check server logs. Common issues: network, rate limits, or permissions.",
    }, { status: 500 });
  }
}