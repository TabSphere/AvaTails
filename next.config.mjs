/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["sharp", "ffmpeg-static", "ffprobe-static"],
  },
};

export default nextConfig;
