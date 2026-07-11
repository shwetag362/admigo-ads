// app/api/media/upload-image/route.ts — DRIVER (thin adapter).
// Logic lives in modules/media/upload-image.handler.js (Meta upload; relocated
// verbatim, migrates to the layered service incrementally).
export { POST } from "@/modules/media/upload-image.handler";
