import type { NextConfig } from "next";

const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";
const repositoryBasePath =
  process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "/tiktok-daily-video-analysis";

const nextConfig: NextConfig = isGitHubPagesBuild
  ? {
      assetPrefix: repositoryBasePath,
      basePath: repositoryBasePath,
      images: {
        unoptimized: true,
      },
      output: "export",
      trailingSlash: true,
    }
  : {};

export default nextConfig;
