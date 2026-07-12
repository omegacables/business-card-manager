import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // iOS が取得する正式パスを AASA ルートハンドラへ転送
        source: "/.well-known/apple-app-site-association",
        destination: "/apple-app-site-association",
      },
    ];
  },
};

export default nextConfig;
