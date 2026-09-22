import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Separate localhost/loopback cookies allow two-player local browser tests.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        // Content-Security-Policy is set in src/proxy.ts instead: it needs a fresh
        // nonce per request so the App Router's inline hydration scripts can run.
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
