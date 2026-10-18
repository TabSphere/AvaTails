/** @type {import('next').NextConfig} */

// ffmpeg/ffprobe are spawned via child_process, so Next's output file tracing
// never sees the binaries — they must be listed explicitly or the lambda ships
// without them (spawnSync .../ffmpeg-static/ffmpeg ENOENT at render time).
const FFMPEG_BINS = [
  "./node_modules/ffmpeg-static/ffmpeg",
  "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
];

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["sharp", "ffmpeg-static", "ffprobe-static"],
    outputFileTracingIncludes: {
      "/api/queue/run": FFMPEG_BINS,
      "/api/cron/run-queue": FFMPEG_BINS,
      "/api/render": FFMPEG_BINS,
      "/api/episodes": FFMPEG_BINS,
    },
  },
};

export default nextConfig;
