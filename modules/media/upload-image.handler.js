// ========================================
// app/api/media/upload-image/route.js
// ========================================

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

const API_VERSION = "v24.0"; // Use latest version

const log = {
  start: (msg) => console.log(`\n📸 IMAGE UPLOAD START → ${msg}`),
  info: (msg, data = null) => console.log(`ℹ️ INFO → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  success: (msg, data = null) => console.log(`✅ SUCCESS → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  error: (msg, err) => {
    console.error(`\n❌ ERROR → ${msg}`);
    console.error("   MESSAGE:", err?.message || err);
    if (err?.error) console.error("   FACEBOOK ERROR:", JSON.stringify(err.error, null, 2));
    if (err) console.error("   FULL RESULT:", JSON.stringify(err, null, 2));
    console.error("   STACK →", err?.stack || "No stack", "\n");
  },
};

export async function POST(request) {
  log.start("Image Upload Request");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    log.error("Unauthorized access");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ 
      error: "Content-Type must be multipart/form-data" 
    }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const accountId = formData.get("accountId");

    // Validation
    if (!file || !accountId) {
      return NextResponse.json({ 
        error: "Missing 'image' file or 'accountId'" 
      }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ 
        error: "Invalid file upload" 
      }, { status: 400 });
    }

    // File type validation
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: `Invalid image type: ${file.type}. Allowed: jpg, png, gif, webp`,
      }, { status: 400 });
    }

    // File size validation (30MB max for images)
    const maxSize = 30 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        error: "Image too large (max 30MB)",
      }, { status: 400 });
    }

    log.info("File received", {
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
      return NextResponse.json({ 
        error: "Ad account not found or not accessible" 
      }, { status: 404 });
    }

    log.info(`Uploading to: ${adAccount.name} (${adAccount.metaAccountId})`);

    // Prepare multipart form data
    const buffer = Buffer.from(await file.arrayBuffer());
    const boundary = "----WebKitFormBoundary" + Date.now().toString(16);
    
    let body = `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="filename"; filename="${file.name}"\r\n`;
    body += `Content-Type: ${file.type || "image/jpeg"}\r\n\r\n`;
    body += buffer.toString("binary");
    body += `\r\n--${boundary}--`;

    // Upload to Meta
    const uploadUrl = `https://graph.facebook.com/${API_VERSION}/${adAccount.metaAccountId}/adimages`;

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adAccount.accessToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: Buffer.from(body, "binary"),
    });

    const result = await uploadResponse.json();
    log.info("Raw upload response", result);

    // Check for errors FIRST
    if (!uploadResponse.ok) {
      log.error("Meta upload failed", result);
      return NextResponse.json({
        error: "Meta upload failed",
        meta_error: result.error || result,
      }, { status: uploadResponse.status });
    }

    // Extract hash from response
    let imageHash = null;
    if (result.images) {
      // Try exact filename first
      const uploadedFileName = file.name;
      if (result.images[uploadedFileName]?.hash) {
        imageHash = result.images[uploadedFileName].hash;
      } else {
        // Fallback to first image
        const keys = Object.keys(result.images);
        if (keys.length > 0) {
          imageHash = result.images[keys[0]].hash;
        }
      }
    } else if (result.hash) {
      // Direct hash in response
      imageHash = result.hash;
    }

    if (!imageHash) {
      log.error("No hash found in response", result);
      return NextResponse.json({
        error: "Upload succeeded but no hash returned",
        raw_response: result,
      }, { status: 500 });
    }

    log.success(`Image uploaded successfully! Hash: ${imageHash}`);

    return NextResponse.json({
      success: true,
      message: "Image uploaded successfully",
      image_hash: imageHash,
      account: adAccount.name,
      account_id: adAccount.metaAccountId,
      file_name: file.name,
      file_size: file.size,
    });

  } catch (error) {
    log.error("Image upload process failed", error);
    return NextResponse.json({ 
      error: "Upload failed", 
      details: error.message 
    }, { status: 500 });
  }
}
