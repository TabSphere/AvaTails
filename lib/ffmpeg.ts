import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import type { RenderScene } from "./types";

// ffmpeg-static/ffprobe-static ship binaries (downloaded at install time);
// the env overrides are for local dev on filesystems without exec permissions.
const FFMPEG = process.env.FFMPEG_PATH || (ffmpegPath as unknown as string) || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || (ffprobe as unknown as { path: string }).path;

function run(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
}

/** Duration of an audio file in seconds. */
export function probeDuration(file: string): number {
  const out = execFileSync(
    FFPROBE,
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
    { encoding: "utf8" }
  );
  const d = parseFloat(out.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`Could not probe duration of ${file}`);
  return d;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Word-wrap a caption into lines that fit the video width. */
function wrapCaption(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

/**
 * Resize a scene image to the target frame and burn the caption
 * onto it (rounded dark box at the bottom, bold white text).
 */
export async function composeSceneImage(
  image: Buffer,
  caption: string,
  width: number,
  height: number,
  outFile: string
): Promise<void> {
  const lines = wrapCaption(caption, 18);
  const fontSize = lines.some((l) => l.length > 14) ? 56 : 64;
  const lineHeight = Math.round(fontSize * 1.25);
  const boxH = lines.length * lineHeight + 56;
  const boxY = height - boxH - 110;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="24" y="${boxY}" width="${width - 48}" height="${boxH}" rx="30" fill="rgba(15,15,25,0.55)"/>
  ${lines
    .map((l, i) => {
      const ty = boxY + 36 + fontSize * 0.75 + i * lineHeight;
      return `<text x="${width / 2}" y="${ty}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle" stroke="#1a1a2e" stroke-width="3" paint-order="stroke">${escapeXml(l)}</text>`;
    })
    .join("\n  ")}
</svg>`;

  await sharp(image)
    .resize(width, height, { fit: "cover", position: "attention" })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 84 })
    .toFile(outFile);
}

/** Render one scene: still image + gentle zoom (Ken Burns) + its voiceover. */
function renderScene(
  imageFile: string,
  audioFile: string,
  outFile: string,
  duration: number,
  width: number,
  height: number,
  crf: number
): void {
  const frames = Math.max(1, Math.ceil(duration * 30));
  const upW = width * 3;
  const upH = height * 3;
  const filter =
    `[0:v]scale=${upW}:${upH}:force_original_aspect_ratio=increase,crop=${upW}:${upH},` +
    `zoompan=z='min(1+0.0012*on,1.22)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=30,` +
    `setsar=1,format=yuv420p[v]`;
  run(FFMPEG, [
    "-y",
    "-i", imageFile,
    "-i", audioFile,
    "-filter_complex", filter,
    "-map", "[v]",
    "-map", "1:a",
    "-t", duration.toFixed(3),
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", String(crf),
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",
    outFile,
  ]);
}

/** Concatenate uniformly-encoded scene mp4s into the final episode. */
function concatScenes(sceneFiles: string[], outFile: string, workDir: string): void {
  const listFile = path.join(workDir, "concat.txt");
  fs.writeFileSync(listFile, sceneFiles.map((f) => `file '${f}'`).join("\n"));
  run(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", outFile]);
}

const dataUrlToBuffer = (dataUrl: string): Buffer =>
  Buffer.from(dataUrl.replace(/^data:[^;]+;base64,/, ""), "base64");

/** Response size guard for serverless platforms (~4.5MB body limit). */
const MAX_RESPONSE_BYTES = 3.8 * 1024 * 1024;

const ATTEMPTS: Array<{ width: number; height: number; crf: number }> = [
  { width: 720, height: 1280, crf: 26 },
  { width: 640, height: 1136, crf: 30 },
  { width: 540, height: 960, crf: 33 },
];

/**
 * Full episode render: caption burn-in -> per-scene video -> concat.
 * Returns the finished MP4 as a Buffer. Retries at lower quality if the
 * result would exceed the serverless response-size limit.
 */
export async function renderEpisode(scenes: RenderScene[]): Promise<Buffer> {
  if (!scenes.length) throw new Error("No scenes to render");
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "avatails-"));
  try {
    const prepared: Array<{ img: string; audio: string; dur: number }> = [];
    for (let i = 0; i < scenes.length; i++) {
      const audioFile = path.join(workDir, `voice-${i}.mp3`);
      fs.writeFileSync(audioFile, dataUrlToBuffer(scenes[i].audio));
      const dur = probeDuration(audioFile);
      prepared.push({ img: "", audio: audioFile, dur });
    }

    for (const attempt of ATTEMPTS) {
      const sceneFiles: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const imgFile = path.join(workDir, `scene-${i}-${attempt.width}.jpg`);
        await composeSceneImage(dataUrlToBuffer(scenes[i].image), scenes[i].caption, attempt.width, attempt.height, imgFile);
        const sceneMp4 = path.join(workDir, `scene-${i}-${attempt.width}.mp4`);
        renderScene(imgFile, prepared[i].audio, sceneMp4, prepared[i].dur, attempt.width, attempt.height, attempt.crf);
        sceneFiles.push(sceneMp4);
      }
      const finalFile = path.join(workDir, `final-${attempt.width}.mp4`);
      concatScenes(sceneFiles, finalFile, workDir);
      const buf = fs.readFileSync(finalFile);
      if (buf.byteLength <= MAX_RESPONSE_BYTES) return buf;
    }
    throw new Error(
      "Rendered video exceeds the serverless response limit even at lowest quality. " +
        "Shorten the episode or add object storage (e.g. Vercel Blob) for delivery."
    );
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
