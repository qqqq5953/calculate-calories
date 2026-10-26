import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone 輸出讓 Dockerfile 可以只複製必要檔案
  output: "standalone",
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
