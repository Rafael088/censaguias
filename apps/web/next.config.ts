import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:8787";

const config: NextConfig = {
  transpilePackages: ["@censaguias/shared"],
  // El navegador siempre llama a /api/*; Next lo reenvía a Hono. Así la cookie del estudiante es de primera parte (ADR 0002).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
};

export default config;
