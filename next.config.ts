import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // There is a stray package-lock.json in C:\Users\HP, above this project.
  // Without pinning the root, Next walks up and adopts that directory, which
  // changes how files are traced into the deployment bundle.
  turbopack: { root: path.resolve(__dirname) },

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
