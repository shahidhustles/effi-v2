import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@effi/design-tokens", "@effi/ui-web", "@effi/auth-contracts"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.convex.cloud", pathname: "/api/storage/**" },
      { protocol: "https", hostname: "**.convex.site", pathname: "/api/storage/**" },
    ],
  },
};
export default nextConfig;
