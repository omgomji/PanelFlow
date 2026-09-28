import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Allow dev origins for local network testing */
  allowedDevOrigins: ['192.168.0.109', '172.20.81.136', 'localhost', '*'],
};

export default nextConfig;
