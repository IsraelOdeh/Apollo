
/** @type {import('next').NextConfig} */

import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";

const revision = randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
   additionalPrecacheEntries: [
    { url: "/~offline", revision },
    { url: "/", revision },
    { url: "/workspace", revision },
     { url: "/devices", revision },
     { url: "/settings", revision },
     { url: "/model", revision },
     { url: "/recordings", revision },
     { url: "/reports", revision },
     { url: "/repository", revision },
     { url: "/screening", revision },
    {url: "/settings", revision},
  ],
});

export default withSerwist({
  // const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
// };
});


// module.exports = nextConfig;
