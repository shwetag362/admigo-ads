// app/dashboard/ads-manager/components/BatchCreationDrawer.jsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Upload, Search, Check, Play } from "lucide-react";
import { Drawer, Box, IconButton, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Loader from "@/app/components/Loader";


export default function BatchCreationDrawer({ open, onClose, mediaType, format, onSelect }) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [mediaFiles, setMediaFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [playingId, setPlayingId] = useState(null);
    const [uploadProgress, setUploadProgress] = useState({});
    const fileInputRef = useRef(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [previewMedia, setPreviewMedia] = useState(null);
    // { url, type }


    const searchParams = useSearchParams();
    const adAccountId = searchParams.get("adAccountId");

    const truncateName = (text, limit = 18) => {
        if (!text) return "";
        return text.length > limit ? text.slice(0, limit) + "..." : text;
    };


    const handleDone = () => {
        console.log("🟢 Sending selected items:", selectedFiles);
        onSelect(selectedFiles);
        onClose();
    };


    // COOKIE HELPER (unchanged)
    const getSessionCookie = () => {
        if (typeof document !== "undefined") {
            const token = document.cookie
                .split("; ")
                .find((row) => row.startsWith("authjs.session-token="))
                ?.split("=")[1];
            return token ? `authjs.session-token=${token}` : "";
        }
        return "";
    };

    // ✅ IMAGE UPLOAD (unchanged)
    const uploadImage = async (file, accountId) => {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("accountId", accountId);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    setUploadProgress(prev => ({
                        ...prev,
                        [file.name]: percent,
                    }));
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    setUploadProgress(prev => {
                        const copy = { ...prev };
                        delete copy[file.name];
                        return copy;
                    });
                    const response = JSON.parse(xhr.responseText);
                    console.log("✅ Image Upload Success:", response);
                    resolve(response);
                } else {
                    console.error("❌ Image Upload Failed:", xhr.status, xhr.responseText);
                    reject(new Error("Upload failed"));
                }
            };

            xhr.onerror = () => {
                console.error("❌ Image Upload Network Error");
                reject(new Error("Upload failed"));
            };
            
            xhr.open("POST", "/api/media/upload-image");
            xhr.withCredentials = true;
            xhr.send(formData);
        });
    };

    // ✅ VIDEO UPLOAD
    const uploadVideo = async (file, accountId) => {
        console.log("📹 Starting video upload:", file.name, "Size:", (file.size / 1024 / 1024).toFixed(2), "MB");
        
        // Validation: Max 4GB
        const MAX_SIZE = 4 * 1024 * 1024 * 1024; // 4GB in bytes
        if (file.size > MAX_SIZE) {
            console.error("❌ File too large:", file.size);
            throw new Error("Video file size exceeds 4GB limit");
        }

        // Validation: File type
        const validTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v'];
        if (!validTypes.includes(file.type)) {
            console.error("❌ Invalid file type:", file.type);
            throw new Error("Invalid video format. Only .mp4, .mov files are supported");
        }

        const formData = new FormData();
        formData.append("video", file);
        formData.append("accountId", accountId);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    console.log(`📊 Upload Progress: ${percent}%`);
                    setUploadProgress(prev => ({
                        ...prev,
                        [file.name]: percent,
                    }));
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    setUploadProgress(prev => {
                        const copy = { ...prev };
                        delete copy[file.name];
                        return copy;
                    });
                    const response = JSON.parse(xhr.responseText);
                    console.log("✅ Video Upload Success:", response);
                    resolve(response);
                } else {
                    console.error("❌ Video Upload Failed:", xhr.status, xhr.responseText);
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error || "Upload failed"));
                    } catch {
                        reject(new Error("Upload failed"));
                    }
                }
            };

            xhr.onerror = () => {
                console.error("❌ Video Upload Network Error");
                reject(new Error("Upload failed"));
            };
            
            xhr.open("POST", "/api/media/upload-video");
            xhr.withCredentials = true;
            xhr.send(formData);
        });
    };


    // FETCH AD ASSETS (support video URLs)
    useEffect(() => {
        if (!adAccountId || !mediaType || !open) return;

        const fetchAssets = async () => {
            setLoading(true);
            console.log(`🔍 Fetching ${mediaType} assets for account:`, adAccountId);
            
            try {
                const res = await fetch(`/api/meta/ad-assets?adAccountId=${adAccountId}`, {
                    headers: { "Content-Type": "application/json", Cookie: getSessionCookie() },
                });

                const data = await res.json();
                console.log("📦 Fetched assets:", data);
                
                if (!data.success) {
                    console.warn("⚠️ Assets fetch failed:", data);
                    return;
                }

                if (mediaType === "image") {
                    const images = data.assets.images.map((img) => ({
                        id: img.id,
                        name: img.name,
                                hash: img.hash,  
                        thumbnail: img.url,
                        url: img.url,
                        width: img.width,
                        height: img.height,
                        type: "image",
                    }));
                    console.log("🖼️ Loaded images:", images.length);
                    setMediaFiles(images);
                }

                if (mediaType === "video") {
                    const videos = data.assets.videos.map((vid) => ({
                        id: vid.id,
                        name: vid.title,
                    thumbnail: vid.thumbnail_url || "",
        url: vid.thumbnail_url || "", 
                        hash: vid.id,
                        width: "—",
                        height: "—",
                        type: "video",
                    }));
                    console.log("🎥 Loaded videos:", videos.length);
                    setMediaFiles(videos);
                }

            } catch (err) {
                console.error("❌ Failed to fetch ad assets:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAssets();
    }, [adAccountId, mediaType, open]);

    const handleSelect = (item) => {
        setSelectedFiles((prev) => {
            const exists = prev.find((x) => x.id === item.id);

            // 🔹 SINGLE
            if (format === "single") {
                return exists ? [] : [item];
            }

            // 🔹 CAROUSEL
            if (format === "carousel") {
                return exists
                    ? prev.filter((x) => x.id !== item.id)
                    : [...prev, item];
            }

            return prev;
        });
    };


    // ✅ UNIFIED FILE UPLOAD HANDLER
    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (!files.length) return;

        console.log(`📤 Starting upload of ${files.length} file(s)`);

        for (const file of files) {
            const tempId = `temp-${Date.now()}-${file.name}`;
            console.log(`🔄 Processing file: ${file.name} (${mediaType})`);

            // ⬇️ show card immediately with local preview
            setMediaFiles(prev => [
                {
                    id: tempId,
                    name: file.name,
                    thumbnail: URL.createObjectURL(file),
                    url: URL.createObjectURL(file),
                    width: "—",
                    height: "—",
                    type: mediaType,
                    isUploading: true,
                    progressKey: file.name,
                },
                ...prev,
            ]);

            try {
                let result;

                // ✅ Call appropriate upload function based on mediaType
                if (mediaType === "video") {
                    result = await uploadVideo(file, adAccountId);
                } else {
                    result = await uploadImage(file, adAccountId);
                }

                console.log("🎉 Upload completed, result:", result);

                // ⬇️ replace temp card with real data
               setMediaFiles(prev =>
                    prev.map(item => {
                        if (item.id === tempId) {
                            const updatedItem = {
                                ...item,
                                id: result.video_id || result.image_hash,
                                hash: result.video_id || result.image_hash,
                                name: result.title || result.name || file.name,
                                thumbnail: result.thumbnail_url || item.thumbnail,
                                url: result.thumbnail_url || result.url || item.url,
                                isUploading: false,
                            };
                            console.log("✅ Updated item in list:", updatedItem);
                            return updatedItem;
                        }
                        return item;
                    })
                );
            } catch (err) {
                console.error("❌ Upload error:", err);
                alert(err.message || "Upload failed");

                // Remove failed upload card
                setMediaFiles(prev => prev.filter(x => x.id !== tempId));

                // Clear progress
                setUploadProgress(prev => {
                    const copy = { ...prev };
                    delete copy[file.name];
                    return copy;
                });
            }
        }

        event.target.value = "";
    };


    const filteredMediaFiles = mediaFiles.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );



    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{ sx: { width: "50%", borderTopLeftRadius: 12, borderBottomLeftRadius: 12 } }}
        >
            <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                {/* Header */}
                <Box sx={{ display: "flex", justifyContent: "space-between", px: 3, py: 2, borderBottom: "1px solid #e5e7eb" }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Select advertisement material</Typography>
                    <IconButton onClick={onClose}><X size={24} /></IconButton>
                </Box>

                {/* Search + Upload */}
                <Box sx={{ display: "flex", gap: 1.5, px: 3, py: 2, borderBottom: "1px solid #f3f4f6" }}>
                    <div className="flex items-center w-[70%] border border-gray-300 rounded-md px-3 py-[9px] bg-white">
                        <Search size={18} className="text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Search keywords"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full outline-none text-sm"
                        />
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 border px-4 py-2 cursor-pointer hover:bg-gray-50 active:bg-white rounded-md text-sm w-[40%]"
                    >
                        <Upload size={18} /> Upload new
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={mediaType === "image" ? "image/*" : "video/mp4,video/quicktime,video/x-m4v"}
                        multiple
                        hidden
                        onChange={handleFileUpload}
                    />
                </Box>

                {/* Media Grid */}
                <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
                    {loading ? (
                        <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Loader />
                        </Box>
                    ) : (
                        <div className="grid grid-cols-7 gap-4">
                            {filteredMediaFiles.map(item => (
                                <div key={item.id} className="cursor-pointer">

                                    <div
                                        onClick={() => handleSelect(item)}
                                        className={`relative w-full aspect-square rounded-lg overflow-hidden
    ${selectedFiles.some(x => x.id === item.id)
                                                ? "border-4 border-indigo-500"
                                                : "border border-gray-200"}`}
                                    >


                                        {item.type === "video" && playingId === item.id ? (
                                            <video
                                                src={item.url}
                                                autoPlay
                                                muted
                                                loop
                                                controls
                                                className="absolute inset-0 w-full h-full object-cover"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <Image
                                                src={item.thumbnail}
                                                alt={item.name}
                                                fill
                                                className="object-cover"
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewImage(item.url);
                                                }}
                                                unoptimized
                                            />

                                        )}

                                        {/* Upload overlay */}
                                        {item.isUploading && (
                                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-20">
                                                <p className="text-sm mb-1">Uploading...</p>
                                                <p className="text-lg font-semibold">
                                                    {uploadProgress[item.progressKey] || 0}%
                                                </p>
                                                <div className="w-4/5 h-1 bg-white/30 rounded mt-2">
                                                    <div
                                                        className="h-full bg-indigo-500 rounded transition-all"
                                                        style={{ width: `${uploadProgress[item.progressKey] || 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {/* 👁 Preview Icon */}
                                        {/* 👁 Preview Icon (Image + Video) */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewMedia({
                                                    url: item.url,
                                                    type: item.type,
                                                });
                                            }}
                                            className="absolute bottom-1 left-1 z-20 bg-black/60 text-white p-1 rounded-md hover:bg-black cursor-pointer"
                                            title="Preview"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="w-4 h-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5
         c4.478 0 8.268 2.943 9.542 7
         -1.274 4.057-5.064 7-9.542 7
         -4.477 0-8.268-2.943-9.542-7z"
                                                />
                                            </svg>
                                        </div>



                                        {/* Checkbox */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelect(item);
                                            }}
                                            className="absolute top-2 right-2 z-10"
                                        >
                                            <div className={`w-4 h-4 rounded-full flex items-center justify-center 
            ${selectedFiles.some(x => x.id === item.id) ? "bg-indigo-500" : "bg-white/80 border border-gray-300"}`}>
                                                {selectedFiles.some(x => x.id === item.id) && <Check size={10} className="text-white" />}
                                            </div>
                                        </div>

                                    </div>

                                    <p className="mt-1 text-center text-xs font-semibold text-gray-700 truncate">
                                        {truncateName(item.name, 18)}
                                    </p>
                                    <p className="text-center text-xs text-gray-500">
                                        {item.width} × {item.height}
                                    </p>
                                </div>
                            ))}
                        </div>

                    )}
                </Box>

                {/* Footer */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 3, py: 2, borderTop: "1px solid #e5e7eb" }}>
                    <Typography variant="body2" color="text.secondary">
                        Selected: {selectedFiles.length} / {mediaFiles.length}
                    </Typography>

                    <Box sx={{ display: "flex", gap: 2 }}>
                        <button onClick={onClose} className="border px-4 py-2 rounded-md text-sm">
                            Cancel
                        </button>
                        <button
                            onClick={handleDone}

                            disabled={selectedFiles.length === 0}
                            className={`px-5 py-2 rounded-md text-sm text-white ${selectedFiles.length === 0 ? "bg-gray-400" : "bg-indigo-600 cursor-pointer hover:bg-indigo-700"}`}
                        >
                            Create Ad
                        </button>
                    </Box>
                </Box>
            </Box>
            {previewMedia && (
                <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
                    <button
                        onClick={() => setPreviewMedia(null)}
                        className="absolute top-5 right-5 text-white bg-black/60 rounded-full p-2 hover:bg-black"
                    >
                        <X size={22} />
                    </button>

                    {previewMedia.type === "image" ? (
                        <Image
                            src={previewMedia.url}
                            alt="Preview"
                            width={1200}
                            height={1200}
                            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-lg"
                            priority
                            unoptimized
                        />
                    ) : (
                        <video
                            src={previewMedia.url}
                            controls
                            autoPlay
                            muted
                            playsInline
                            preload="metadata"
                            crossOrigin="anonymous"
                            className="max-w-[90%] max-h-[90%] rounded-lg shadow-lg bg-black"
                        />
                    )}
                </div>
            )}


        </Drawer>
    );
}