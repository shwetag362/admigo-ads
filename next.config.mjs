/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the ngrok tunnel to load /_next/* assets in dev (OAuth testing).
  // The wildcard covers any ngrok URL, so you don't edit this on ngrok restart.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
};

export default nextConfig;
