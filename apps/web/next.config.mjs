const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.KIRO_NEXT_DIST_DIR || ".next",
  devIndicators: false,
  transpilePackages: ["@kiro/shared"],
};

export default nextConfig;
