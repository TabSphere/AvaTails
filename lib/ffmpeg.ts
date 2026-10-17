import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import type { RenderInput, RenderOptions } from "./types";

// ffmpeg-static/ffprobe-static ship binaries (downloaded at install time);
// the env overrides are for local dev on filesystems without exec permissions.
const FFMPEG = process.env.FFMPEG_PATH || (ffmpegPath as unknown as string) || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || (ffprobe as unknown as { path: string }).path;

const FADE = 0.5; // seconds, crossfade between scenes

function run(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

/** Duration of a media file in seconds. */
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

/**
 * Render one scene: still image + gentle zoom (Ken Burns) + voiceover.
 * Audio is loudness-normalized so every scene sits at the same volume.
 */
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
    "-af", "loudnorm=I=-15:TP=-1.5:LRA=11",
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

/** Join scenes with crossfade transitions (video xfade + audio acrossfade). */
function joinWithTransitions(sceneFiles: string[], durations: number[], outFile: string): void {
  const inputs = sceneFiles.flatMap((f) => ["-i", f]);
  const parts: string[] = [];
  let vLabel = "0:v";
  let aLabel = "0:a";
  let offset = durations[0] - FADE;
  for (let k = 1; k < sceneFiles.length; k++) {
    parts.push(`[${vLabel}][${k}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[v${k}]`);
    parts.push(`[${aLabel}][${k}:a]acrossfade=d=${FADE}:c1=tri:c2=tri[a${k}]`);
    vLabel = `v${k}`;
    aLabel = `a${k}`;
    offset += durations[k] - FADE;
  }
  run(FFMPEG, [
    "-y",
    ...inputs,
    "-filter_complex", parts.join(";"),
    "-map", `[${vLabel}]`,
    "-map", `[${aLabel}]`,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "24",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outFile,
  ]);
}

/** Join scenes with plain cuts (concat demuxer, stream copy). */
function joinWithCuts(sceneFiles: string[], outFile: string, workDir: string): void {
  const listFile = path.join(workDir, "concat.txt");
  fs.writeFileSync(listFile, sceneFiles.map((f) => `file '${f}'`).join("\n"));
  run(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", outFile]);
}

/** Mix a looped background music bed under the voiceover. */
function mixMusic(videoFile: string, musicFile: string, outFile: string, totalDuration: number): void {
  const fadeOutStart = Math.max(0, totalDuration - 2);
  run(FFMPEG, [
    "-y",
    "-i", videoFile,
    "-stream_loop", "-1",
    "-i", musicFile,
    "-filter_complex",
    `[1:a]volume=0.12,afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=2[mus];` +
      `[0:a][mus]amix=inputs=2:duration=first:dropout_transition=0[aout]`,
    "-map", "0:v",
    "-map", "[aout]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outFile,
  ]);
}

/** Response size guard for the data-URL fallback path (~4.5MB body limit). */
const MAX_RESPONSE_BYTES = 3.8 * 1024 * 1024;

const ATTEMPTS: Array<{ width: number; height: number; crf: number }> = [
  { width: 720, height: 1280, crf: 26 },
  { width: 640, height: 1136, crf: 30 },
  { width: 540, height: 960, crf: 33 },
];

/**
 * Full episode render: caption burn-in -> per-scene video (Ken Burns + loudnorm)
 * -> transitions or cuts -> optional music bed -> finished MP4 buffer.
 * Retries at lower quality if the result exceeds `sizeGuard`.
 */
export async function renderEpisode(
  scenes: RenderInput[],
  opts: RenderOptions = {},
  sizeGuard: number = MAX_RESPONSE_BYTES
): Promise<Buffer> {
  if (!scenes.length) throw new Error("No scenes to render");
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "avatails-"));
  try {
    const prepared = scenes.map((s, i) => {
      const audioFile = path.join(workDir, `voice-${i}.mp3`);
      fs.writeFileSync(audioFile, s.audio);
      return { audioFile, dur: probeDuration(audioFile) };
    });

    const musicFile = opts.music ? path.join(workDir, "music.mp3") : null;
    if (musicFile && opts.music) fs.writeFileSync(musicFile, opts.music);

    for (const attempt of ATTEMPTS) {
      const sceneFiles: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const imgFile = path.join(workDir, `scene-${i}-${attempt.width}.jpg`);
        await composeSceneImage(scenes[i].image, scenes[i].caption, attempt.width, attempt.height, imgFile);
        const sceneMp4 = path.join(workDir, `scene-${i}-${attempt.width}.mp4`);
        renderScene(imgFile, prepared[i].audioFile, sceneMp4, prepared[i].dur, attempt.width, attempt.height, attempt.crf);
        sceneFiles.push(sceneMp4);
      }

      let joined = path.join(workDir, `joined-${attempt.width}.mp4`);
      if (opts.transitions && sceneFiles.length > 1) {
        joinWithTransitions(sceneFiles, prepared.map((p) => p.dur), joined);
      } else {
        joinWithCuts(sceneFiles, joined, workDir);
      }

      if (musicFile) {
        const total = prepared.reduce((a, p) => a + p.dur, 0) - (opts.transitions ? FADE * (scenes.length - 1) : 0);
        const mixed = path.join(workDir, `mixed-${attempt.width}.mp4`);
        mixMusic(joined, musicFile, mixed, total);
        joined = mixed;
      }

      const buf = fs.readFileSync(joined);
      if (buf.byteLength <= sizeGuard) return buf;
    }
    throw new Error(
      "Rendered video exceeds the response-size limit even at lowest quality. " +
        "Enable Vercel Blob storage (BLOB_READ_WRITE_TOKEN) to lift the limit."
    );
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
