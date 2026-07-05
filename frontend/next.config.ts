import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Allow dev origins for local network testing */
  allowedDevOrigins: ['192.168.0.109', 'localhost', '*'],
};

export default nextConfig;
