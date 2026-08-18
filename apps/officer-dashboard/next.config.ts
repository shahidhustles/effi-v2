import type { NextConfig } from "next";

const nextConfig: NextConfig = { transpilePackages: ["@effi/design-tokens", "@effi/ui-web", "@effi/auth-contracts"] };
export default nextConfig;
