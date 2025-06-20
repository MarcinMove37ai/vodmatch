import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    APP_PASSWORD: process.env.APP_PASSWORD,
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
    KDB_AI_API_KEY: process.env.KDB_AI_API_KEY,
    KDB_AI_ENDPOINT: process.env.KDB_AI_ENDPOINT,
  }
};

export default nextConfig;