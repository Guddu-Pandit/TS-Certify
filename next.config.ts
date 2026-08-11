import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages load native binaries (@napi-rs/canvas) or do dynamic requires
  // (googleapis, nodemailer). Bundling them breaks the build, so leave them
  // external and let Node require them at runtime.
  serverExternalPackages: ["@napi-rs/canvas", "nodemailer", "googleapis"],

  // The certificate template and TTF fonts are read from disk with fs, which the
  // Vercel file tracer cannot see. Without this they are missing from the Lambda:
  // renders fine locally, ENOENT in production.
  outputFileTracingIncludes: {
    "/api/certificates/**": ["./assets/**/*"],
    "/admin/template": ["./assets/**/*"],
  },
};

export default nextConfig;
